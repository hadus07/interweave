import { useEffect, useState } from 'react'

// Live-fetches server-side Shiki-highlighted HTML for a file and injects it.
export default function SourceView({ path, className = '' }: { path: string; className?: string }) {
  const [html, setHtml] = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'error' | 'idle'>('loading')

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setHtml(null)
    fetch(`/file?path=${encodeURIComponent(path)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.text()
      })
      .then((h) => {
        if (cancelled) return
        setHtml(h)
        setStatus('idle')
      })
      .catch((err) => {
        if (cancelled) return
        console.error('failed to load source', err)
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [path])

  return (
    // nowheel: lets trackpad scroll the code instead of panning the canvas
    <div className={`iw-source-panel nowheel ${className}`}>
      {status === 'loading' && <div className="iw-source-loading">loading…</div>}
      {status === 'error' && <div className="iw-source-error">failed to load source</div>}
      {html != null && (
        // biome-ignore lint/security/noDangerouslySetInnerHtml: server returns trusted Shiki-highlighted HTML
        <div dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </div>
  )
}
