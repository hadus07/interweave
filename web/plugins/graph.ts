import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { getSingletonHighlighter } from 'shiki'
import type { Plugin } from 'vite'
import { buildGraph } from '../../src/buildGraph.js'

const EXT_TO_LANG: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'tsx', '.js': 'javascript', '.jsx': 'jsx',
}

const highlighterPromise = getSingletonHighlighter({
  langs: ['typescript', 'javascript', 'tsx', 'jsx'],
  themes: ['github-dark'],
})

export default function graphPlugin(): Plugin {
  const root = process.env.INTERWEAVE_ROOT ?? process.cwd()

  return {
    name: 'interweave-graph',
    configureServer(server) {
      server.middlewares.use('/graph', async (_req, res, next) => {
        try {
          const graph = await buildGraph(root)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(graph))
        } catch (err) {
          next(err)
        }
      })

      server.middlewares.use('/file', async (req, res, next) => {
        const url = new URL(req.url ?? '', 'http://localhost')
        const rawPath = url.searchParams.get('path') ?? ''
        if (path.isAbsolute(rawPath)) { res.statusCode = 403; res.end('Forbidden'); return }
        const rootResolved = path.resolve(root)
        const requested = path.resolve(rootResolved, rawPath)
        const inside = requested === rootResolved || requested.startsWith(rootResolved + path.sep)
        if (!inside) { res.statusCode = 403; res.end('Forbidden'); return }
        try {
          const source = await fs.readFile(requested, 'utf8')
          const lang = EXT_TO_LANG[path.extname(requested).toLowerCase()] ?? 'typescript'
          const highlighter = await highlighterPromise
          const html = highlighter.codeToHtml(source, { lang, theme: 'github-dark' })
          res.setHeader('Content-Type', 'text/html')
          res.end(html)
        } catch {
          next()
        }
      })
    },
  }
}
