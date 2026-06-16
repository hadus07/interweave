import { Handle, type NodeProps, Position } from '@xyflow/react'
import type { FileCardData } from '~shared/toReactFlow'

const chipStyle = {
  padding: '2px 8px',
  border: '1px solid #ccc',
  borderRadius: 12,
  background: '#f5f5f5',
  fontSize: 11,
  color: '#333',
  cursor: 'pointer' as const,
  userSelect: 'none' as const,
}

export default function FileCardNode({ data }: NodeProps) {
  const { name, path, importCount, importedByCount, onExpand } = data as Required<FileCardData>

  return (
    <div
      style={{
        width: 240,
        padding: 12,
        border: '1px solid #ccc',
        borderRadius: 8,
        background: '#fff',
        fontFamily: 'sans-serif',
        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: '#111' }}>{name}</div>
      <div style={{ fontSize: 12, color: '#666', wordBreak: 'break-word', marginBottom: 8 }}>
        {path}
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
        <button
          type="button"
          style={chipStyle}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onExpand(path, 'imports')}
        >
          imports ({importCount}) ▶
        </button>
        <button
          type="button"
          style={chipStyle}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onExpand(path, 'importedBy')}
        >
          ◀ imported by ({importedByCount})
        </button>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  )
}
