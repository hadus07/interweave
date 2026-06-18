import { spawn } from 'node:child_process'
import path from 'node:path'
import { chromium } from 'playwright'

const root = process.env.TARGET_PROJECT
const port = Number(process.env.INTERWEAVE_PORT || 31718)
const outDir = process.env.OUT_DIR || path.resolve(process.cwd(), 'grill-out')

async function startIntertangle() {
  const bin = process.env.INTERWEAVE_BIN || 'npx'
  const args = process.env.INTERWEAVE_BIN ? [] : ['intertangle@latest']
  const proc = spawn(bin, args, {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, INTERWEAVE_NO_OPEN: '1', INTERWEAVE_PORT: String(port) },
  })
  let url
  await new Promise((resolve, reject) => {
    const onData = (data) => {
      const line = data.toString()
      const m = line.match(/http:\/\/127\.0\.0\.1:(\d+)\/?/)
      if (m) {
        url = `http://127.0.0.1:${m[1]}`
        proc.stdout.off('data', onData)
        resolve()
      }
    }
    proc.stdout.on('data', onData)
    proc.stderr.on('data', (d) => {
      // surface early errors only
      if (!url && d.toString().includes('Error')) console.error(d.toString())
    })
    setTimeout(() => reject(new Error('timeout waiting for intertangle url')), 60000)
  })
  return { proc, url }
}

async function run(browser, url, label) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  const errors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`)
  })
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
  page.on('response', (resp) => {
    if (resp.status() >= 400) errors.push(`http ${resp.status()}: ${resp.url()}`)
  })

  const screenshot = async (name) => {
    await page.screenshot({ path: path.join(outDir, `${label}-${name}.png`) })
  }

  // Fetch graph and pick a node with both forward and reverse edges for chip testing.
  let seedPath = ''
  try {
    const graph = await (await fetch(`${url.replace(/\/$/, '')}/graph`)).json()
    const candidates = Object.keys(graph.nodes).filter(
      (p) => graph.forward[p]?.length > 0 && graph.reverse[p]?.length > 0,
    )
    seedPath = candidates[0] || Object.keys(graph.nodes)[0] || ''
  } catch (e) {
    errors.push(`failed to fetch graph: ${e}`)
  }

  await page.goto(seedPath ? `${url}?seeds=${encodeURIComponent(seedPath)}` : url, {
    waitUntil: 'networkidle',
  })
  await page.waitForTimeout(2000)
  await screenshot('startup')

  const results = []

  // Flow 1: palette opens and can seed a file
  try {
    const searchBtn = page.locator('.iw-search-btn').first()
    if ((await searchBtn.count()) > 0) {
      await searchBtn.click()
      await page.waitForTimeout(500)
    }
    const hasPalette =
      (await page.locator('[cmdk-root], [role="dialog"], .iw-palette-dialog').count()) > 0
    if (!hasPalette) {
      results.push({
        flow: 'cold-start-palette',
        ok: false,
        detail: 'palette not visible after opening',
      })
    } else {
      const firstItem = page.locator('.iw-palette-item').first()
      if ((await firstItem.count()) > 0) {
        await firstItem.click()
        await page.waitForTimeout(1000)
        await screenshot('after-palette-seed')
        const nodes = await page.locator('.react-flow__node').count()
        results.push({
          flow: 'cold-start-palette',
          ok: nodes > 0,
          detail: `nodes after seed: ${nodes}`,
        })
      } else {
        results.push({ flow: 'cold-start-palette', ok: false, detail: 'palette open but no items' })
      }
    }
  } catch (e) {
    results.push({ flow: 'cold-start-palette', ok: false, detail: String(e) })
  }

  // Flow 2: seed via CLI (already seeded if root arg was a file)
  try {
    const nodes = await page.locator('.react-flow__node').count()
    results.push({ flow: 'initial-nodes', ok: nodes > 0, detail: `node count: ${nodes}` })
  } catch (e) {
    results.push({ flow: 'initial-nodes', ok: false, detail: String(e) })
  }

  // Re-seed with a rich node if current seed has no edges, so chip flows are meaningful.
  if (seedPath) {
    await page.goto(`${url}?seeds=${encodeURIComponent(seedPath)}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
    await screenshot('cli-seed')
  }

  // Flow 3 & 4: click chips
  const chip = page.locator('.iw-chip-imports').first()
  if ((await chip.count()) > 0) {
    const before = await page.locator('.react-flow__node').count()
    await chip.click()
    await page.waitForTimeout(1500)
    await screenshot('after-imports-click')
    const after = await page.locator('.react-flow__node').count()
    results.push({ flow: 'imports-chip', ok: after > before, detail: `nodes ${before} → ${after}` })
  } else {
    results.push({ flow: 'imports-chip', ok: false, detail: 'no imports chip found' })
  }

  const revChip = page.locator('.iw-chip-importedby').first()
  if ((await revChip.count()) > 0) {
    const before = await page.locator('.react-flow__node').count()
    await revChip.click()
    await page.waitForTimeout(1500)
    await screenshot('after-importedby-click')
    const after = await page.locator('.react-flow__node').count()
    results.push({
      flow: 'imported-by-chip',
      ok: after > before,
      detail: `nodes ${before} → ${after}`,
    })
  } else {
    results.push({ flow: 'imported-by-chip', ok: false, detail: 'no imported-by chip found' })
  }

  // Flow 5: expand card to view source
  try {
    const expandBtn = page.locator('.iw-card-action[title="View source"]').first()
    if ((await expandBtn.count()) > 0) {
      await expandBtn.click()
      await page.waitForTimeout(1000)
      await screenshot('source-expanded')
      const source = await page.locator('pre, .shiki, .iw-source-body').count()
      results.push({ flow: 'source-view', ok: source > 0, detail: `source containers: ${source}` })
    } else {
      results.push({ flow: 'source-view', ok: false, detail: 'no expand trigger found' })
    }
  } catch (e) {
    results.push({ flow: 'source-view', ok: false, detail: String(e) })
  }

  // Flow 6: external labels inert (no node with node_modules path)
  try {
    const badNodes = await page
      .locator('.react-flow__node')
      .filter({ hasText: /node_modules/ })
      .count()
    results.push({
      flow: 'external-inert',
      ok: badNodes === 0,
      detail: `node_modules nodes: ${badNodes}`,
    })
  } catch (e) {
    results.push({ flow: 'external-inert', ok: false, detail: String(e) })
  }

  await context.close()
  return { results, errors }
}

async function main() {
  const { proc, url } = await startIntertangle()
  const browser = await chromium.launch()
  let output
  try {
    output = await run(browser, url, path.basename(root))
  } finally {
    await browser.close()
    proc.kill('SIGINT')
  }
  console.log(JSON.stringify(output, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
