import { Check, Copy, ExternalLink, X } from 'lucide-react'
import { useState } from 'react'
import SourceView from './SourceView'

// Right-hand panel: header actions (copy path, open in editor, close) + live source.
export default function SourcePanel({ path, onClose }: { path: string; onClose(): void }) {
  const [copied, setCopied] = useState(false)

  const copyPath = () => {
    navigator.clipboard.writeText(path).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    })
  }

  // ponytail: server opens the file in the OS default app for its type; swap for
  // an explicit editor command / $EDITOR if "default app" isn't the editor.
  const openInEditor = () => {
    fetch(`/open?path=${encodeURIComponent(path)}`).catch((err) =>
      console.error('failed to open in editor', err),
    )
  }

  return (
    <div className="iw-source-side">
      <div className="iw-source-side-header">
        <div className="iw-source-side-path" title={path}>
          {path}
        </div>
        <div className="iw-source-side-actions">
          <button
            type="button"
            className="iw-card-action"
            title="Copy relative path"
            onClick={copyPath}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
          <button
            type="button"
            className="iw-card-action"
            title="Open in code editor"
            onClick={openInEditor}
          >
            <ExternalLink size={14} />
          </button>
          <button
            type="button"
            className="iw-card-action iw-card-action--remove"
            title="Close"
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <SourceView path={path} className="iw-source-side-body" />
    </div>
  )
}
