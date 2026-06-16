import { describe, expect, it } from 'vitest'
import { buildGraph } from '../src/buildGraph.js'
import { fixtureRoot } from './helpers.js'

describe('buildGraph', () => {
  it('finds forward edges for relative imports', async () => {
    const graph = await buildGraph(fixtureRoot('relative-imports'))

    expect(Object.keys(graph.nodes).sort()).toEqual([
      'src/index.ts',
      'src/types.ts',
      'src/utils.ts',
    ])
    expect(graph.forward['src/index.ts']).toEqual(['src/types.ts', 'src/utils.ts'])
    expect(graph.forward['src/utils.ts']).toEqual(['src/types.ts'])
    expect(graph.forward['src/types.ts']).toEqual([])
    expect(graph.reverse['src/types.ts']).toEqual(['src/index.ts', 'src/utils.ts'])
    expect(graph.reverse['src/utils.ts']).toEqual(['src/index.ts'])
    expect(graph.reverse['src/index.ts']).toEqual([])
    expect(graph.external['src/index.ts']).toEqual([])
    expect(graph.external['src/utils.ts']).toEqual([])
  })

  it('labels external imports and skips node_modules', async () => {
    const graph = await buildGraph(fixtureRoot('external-deps'))

    expect(Object.keys(graph.nodes)).toContain('src/index.ts')
    expect(graph.forward['src/index.ts']).toEqual(['src/utils.ts'])
    expect(graph.external['src/index.ts']).toEqual(expect.arrayContaining(['fs', 'react']))
    expect(graph.external['src/utils.ts']).toContain('lodash')
    expect(Object.keys(graph.nodes).some((p) => p.includes('node_modules'))).toBe(false)
  })

  it('renders import cycles without dropping edges', async () => {
    const graph = await buildGraph(fixtureRoot('cycle'))

    expect(Object.keys(graph.nodes).sort()).toEqual(['src/a.ts', 'src/b.ts', 'src/c.ts'])
    expect(graph.forward['src/a.ts']).toEqual(['src/b.ts'])
    expect(graph.forward['src/b.ts']).toEqual(['src/c.ts'])
    expect(graph.forward['src/c.ts']).toEqual(['src/a.ts'])
    expect(graph.reverse['src/a.ts']).toEqual(['src/c.ts'])
    expect(graph.reverse['src/b.ts']).toEqual(['src/a.ts'])
    expect(graph.reverse['src/c.ts']).toEqual(['src/b.ts'])
  })
})
