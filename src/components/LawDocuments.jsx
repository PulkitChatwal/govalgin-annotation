// LawDocuments — dropdown button listing PDF docs for the current country.
// Fetches signed URLs from Supabase Storage on open. Opens PDF in new tab.
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function LawDocuments({ country }) {
  const [open, setOpen] = useState(false)
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(false)
  const wrapperRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setOpen(false) // will open after load
    setLoading(true)
    ;(async () => {
      const { data, error } = await supabase
        .from('law_documents')
        .select('*')
        .eq('country', country)
        .order('uploaded_at', { ascending: true })
      if (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to load law documents:', error)
        setDocs([])
      } else {
        // Fetch signed URLs for each document
        const withUrls = await Promise.all(
          (data || []).map(async (doc) => {
            const { data: signed } = await supabase.storage
              .from('law-docs')
              .createSignedUrl(doc.storage_path, 3600)
            return { ...doc, signed_url: signed?.signedUrl || null }
          })
        )
        setDocs(withUrls)
      }
      setLoading(false)
      setOpen(true)
    })()
  }, [country, open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (docs.length === 0 && !loading) {
    return <span className="no-docs muted small">No law documents uploaded yet</span>
  }

  return (
    <div className="law-docs" ref={wrapperRef}>
      <button
        type="button"
        className="btn btn-ghost law-docs-toggle"
        onClick={() => setOpen((v) => !v)}
        disabled={loading && docs.length === 0}
      >
        {loading ? 'Loading…' : `📄 Law documents (${docs.length}) ▾`}
      </button>
      {open && docs.length > 0 && (
        <ul className="law-docs-list">
          {docs.map((doc) => (
            <li key={doc.id}>
              <strong>{doc.law_name}</strong>
              {doc.description && <span className="muted small"> — {doc.description}</span>}
              <br />
              {doc.signed_url ? (
                <a
                  href={doc.signed_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="muted small"
                >
                  Download PDF ↗
                </a>
              ) : (
                <span className="muted small">(no signed URL)</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}