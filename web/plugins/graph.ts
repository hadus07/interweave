import process from 'node:process'
import type { Plugin } from 'vite'
import { buildGraph } from '../../src/buildGraph.js'
import { highlightFile, resolveInside } from '../../src/server.js'

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
        const real = await resolveInside(root, url.searchParams.get('path') ?? '')
        if (!real) {
          res.statusCode = 403
          res.end('Forbidden')
          return
        }
        try {
          res.setHeader('Content-Type', 'text/html')
          res.end(await highlightFile(real))
        } catch {
          next()
        }
      })
    },
  }
}
