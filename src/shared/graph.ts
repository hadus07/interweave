export type ExternalLabelType = 'npm' | 'core' | 'unresolved'

export interface ExternalLabel {
  name: string
  type: ExternalLabelType
}

export interface GraphNode {
  path: string
  name: string
}

export interface Graph {
  root: string
  nodes: Record<string, GraphNode>
  forward: Record<string, string[]>
  reverse: Record<string, string[]>
  external: Record<string, ExternalLabel[]>
}
