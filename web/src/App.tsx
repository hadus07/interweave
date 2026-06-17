import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  type Node,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Graph } from '~shared/graph'
import type { ExpandDirection, FileCardData } from '~shared/toReactFlow'
import { toReactFlow } from '~shared/toReactFlow'
import FileCardNode from './FileCardNode'
import FilePalette from './FilePalette'
import GradientEdge from './GradientEdge'

const nodeTypes = { fileCard: FileCardNode }
const edgeTypes = { gradient: GradientEdge }

function readSeeds(): Set<string> {
  const params = new URLSearchParams(window.location.search)
  const raw = params.get('seeds')
  return raw ? new Set(raw.split(',')) : new Set<string>()
}

export default function App() {
  const [graph, setGraph] = useState<Graph | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(readSeeds)
  const [sourceExpanded, setSourceExpanded] = useState<Set<string>>(new Set())
  const [paletteOpen, setPaletteOpen] = useState(() => readSeeds().size === 0)
  const { fitView } = useReactFlow()

  useEffect(() => {
    fetch('/graph')
      .then((r) => r.json())
      .then(setGraph)
      .catch((err) => console.error('failed to load graph', err))
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const expand = useCallback(
    (path: string, direction: ExpandDirection) => {
      if (!graph) return
      setExpanded((prev) => {
        const next = new Set(prev)
        const related = direction === 'imports' ? graph.forward[path] : graph.reverse[path]
        for (const target of related ?? []) next.add(target)
        return next
      })
    },
    [graph],
  )

  const toggleSource = useCallback((path: string) => {
    setSourceExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FileCardData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  // Pass 1 — node/edge existence + data. Preserves prior position and measured
  // size for surviving nodes so an expand doesn't reset the laid-out canvas.
  useEffect(() => {
    if (!graph) return
    toReactFlow(graph, expanded, sourceExpanded)
      .then(({ nodes: layoutNodes, edges: layoutEdges }) => {
        setNodes((prev) => {
          const prevById = new Map(prev.map((n) => [n.id, n]))
          return layoutNodes.map((n) => {
            const old = prevById.get(n.id)
            return {
              ...n,
              position: old?.position ?? n.position,
              measured: old?.measured ?? n.measured,
              data: { ...n.data, onExpand: expand, onToggleSource: toggleSource },
            }
          })
        })
        setEdges(layoutEdges)
      })
      .catch((err) => console.error('layout failed', err))
  }, [graph, expanded, sourceExpanded, expand, toggleSource, setNodes, setEdges])

  // Pass 2 — re-layout with the sizes React Flow actually measured, so cards
  // never overlap regardless of external rows or expanded source length.
  const laidOutSig = useRef('')
  useEffect(() => {
    if (!graph || nodes.length === 0) return
    const sizes = new Map<string, { width: number; height: number }>()
    for (const n of nodes) {
      const { width, height } = n.measured ?? {}
      if (!width || !height) return // wait until every node is measured
      sizes.set(n.id, { width, height })
    }
    const sig = [...sizes]
      .map(([id, s]) => `${id}:${s.width}:${s.height}`)
      .sort()
      .join('|')
    if (sig === laidOutSig.current) return
    laidOutSig.current = sig
    toReactFlow(graph, expanded, sourceExpanded, sizes)
      .then(({ nodes: laid }) => {
        const pos = new Map(laid.map((n) => [n.id, n.position]))
        setNodes((prev) => prev.map((n) => ({ ...n, position: pos.get(n.id) ?? n.position })))
        fitView({ padding: 0.2, duration: 300 })
      })
      .catch((err) => console.error('layout failed', err))
  }, [nodes, graph, expanded, sourceExpanded, setNodes, fitView])

  if (!graph) return <div className="loading">loading…</div>

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} color="#1a1c2c" gap={24} size={1} />
        <Controls />
      </ReactFlow>
      <FilePalette
        graph={graph}
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelect={(path) => setExpanded((prev) => new Set([...prev, path]))}
      />
    </div>
  )
}
