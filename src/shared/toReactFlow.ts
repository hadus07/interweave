import type { Edge, Node } from '@xyflow/react'
import type { ExternalLabel, Graph } from './graph.js'

export const CARD_WIDTH = 240
export const CARD_HEIGHT = 120

export type ExpandDirection = 'imports' | 'importedBy'

export interface FileCardData extends Record<string, unknown> {
  name: string
  path: string
  importCount: number
  importedByCount: number
  externals: ExternalLabel[]
  onExpand?(path: string, direction: ExpandDirection): void
  onShowSource?(path: string): void
  onRemove?(path: string): void
}

export async function toReactFlow(
  graph: Graph,
  visible: Set<string>,
  // Real DOM sizes measured by React Flow; cards are content-driven so the
  // CARD_* constants are only a first-paint fallback. Without this, elk packs
  // for the wrong box and rendered cards overlap.
  sizes?: Map<string, { width: number; height: number }>,
  excluded?: Set<string>,
) {
  const nodes: Node<FileCardData>[] = []
  for (const id of [...visible].sort()) {
    if (excluded?.has(id)) continue
    const node = graph.nodes[id]
    if (!node) continue

    nodes.push({
      id,
      type: 'fileCard',
      position: { x: 0, y: 0 },
      data: {
        ...node,
        importCount: (graph.forward[id] ?? []).filter((p) => !excluded?.has(p)).length,
        importedByCount: (graph.reverse[id] ?? []).filter((p) => !excluded?.has(p)).length,
        externals: graph.external[id] ?? [],
      },
      measured: { width: CARD_WIDTH, height: CARD_HEIGHT },
    })
  }

  const edges: Edge[] = []
  for (const [source, targets] of Object.entries(graph.forward)) {
    if (!visible.has(source) || excluded?.has(source)) continue
    for (const target of targets) {
      if (!visible.has(target) || excluded?.has(target)) continue
      edges.push({ id: `${source}->${target}`, source, target, type: 'gradient' })
    }
  }

  if (nodes.length === 0) return { nodes, edges }

  const { default: ELK } = await import('elkjs/lib/elk.bundled.js')
  const elk = new ELK()
  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      // LEFT so a node's imports render to its left (imports chip side) and its
      // importers to its right (imported-by chip side) — edges leave from the
      // matching chip, less crossing over the card.
      'elk.direction': 'LEFT',
      'elk.spacing.nodeNode': '40',
      'elk.layered.spacing.nodeNodeBetweenLayers': '60',
      // Honor the (alphabetical) input order within each layer instead of
      // letting elk reshuffle to minimize crossings — keeps cards in a stable
      // vertical order so the hierarchy doesn't jump around on each expansion.
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
    },
    children: nodes.map((n) => {
      const s = sizes?.get(n.id)
      return {
        id: n.id,
        width: s?.width ?? CARD_WIDTH,
        height: s?.height ?? n.measured?.height ?? CARD_HEIGHT,
      }
    }),
    edges: edges.map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  }

  const layout = await elk.layout(elkGraph)
  for (const child of layout.children ?? []) {
    const node = nodeById.get(child.id)
    if (node) {
      node.position = { x: child.x ?? 0, y: child.y ?? 0 }
    }
  }

  return { nodes, edges }
}
