import { Handle, type NodeProps, Position } from '@xyflow/react'
import { useEffect, useState } from 'react'
import type { FileCardData } from '~shared/toReactFlow'

const extClass: Record<string, string> = {
  npm: 'iw-ext-npm',
  core: 'iw-ext-core',
  unresolved: 'iw-ext-unresolved',
}

export default function FileCardNode({ data }: NodeProps) {
  const { name, path, importCount, importedByCount, externals, sourceExpanded, onExpand, onToggleSource } =
    data as Required<FileCardData>

  const [sourceHtml, setSourceHtml] = useState<string | null>(null)
  const [sourceStatus, setSourceStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  useEffect(() => {
    if (!sourceExpanded) {
      setSourceHtml(null)
      setSourceStatus('idle')
      return
    }
    setSourceStatus('loading')
    fetch(`/file?path=${encodeURIComponent(path)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.text()
      })
      .then((html) => {
        setSourceHtml(html)
        setSourceStatus('idle')
      })
      .catch((err) => {
        console.error('failed to load source', err)
        setSourceStatus('error')
      })
  }, [sourceExpanded, path])

  return (
    <div className={`iw-card${sourceExpanded ? ' iw-card--expanded' : ''}`}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <button
        type="button"
        className="iw-card-header"
        onClick={() => onToggleSource(path)}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="iw-card-name">{name}</div>
        <div className="iw-card-path">{path}</div>
      </button>
      <div className="iw-chip-row">
        <button
          type="button"
          className="iw-chip iw-chip-imports"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onExpand(path, 'imports')}
        >
          ↗ imports {importCount}
        </button>
        <button
          type="button"
          className="iw-chip iw-chip-importedby"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onExpand(path, 'importedBy')}
        >
          ↙ imported by {importedByCount}
        </button>
      </div>
      {externals.length > 0 && (
        <div className="iw-ext-row">
          {externals.map((label) => (
            <span
              key={label.name}
              title={`${label.type}: ${label.name}`}
              className={`iw-ext-label ${extClass[label.type] ?? ''}`}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}
      {sourceExpanded && (
        // nowheel: lets trackpad scroll the code instead of panning the canvas
        <div className="iw-source-panel nowheel">
          {sourceStatus === 'loading' && <div className="iw-source-loading">loading…</div>}
          {sourceStatus === 'error' && <div className="iw-source-error">failed to load source</div>}
          {sourceHtml != null && (
            // biome-ignore lint/security/noDangerouslySetInnerHtml: server returns trusted Shiki-highlighted HTML
            <div dangerouslySetInnerHTML={{ __html: sourceHtml }} />
          )}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  )
}
