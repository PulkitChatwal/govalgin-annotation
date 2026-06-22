// LawDocuments — dropdown button listing PDF docs for the current country.
// Fetches signed URLs from Supabase Storage on open. Opens PDF in new tab.
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function LawDocuments({ country }) {
  const [open, setOpen] = useState(false)
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const wrapperRef = useRef(null)

  // Lazy-load docs the first time the dropdown is opened.
  useEffect(() => {
    if (!open || hasLoaded) return
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
        // Fetch signed URLs for each document.
        // If is_external_url is true, just use the storage_path as the URL.
        const withUrls = await Promise.all(
          (data || []).map(async (doc) => {
            if (doc.is_external_url) {
              return { ...doc, signed_url: doc.storage_path }
            }
            const { data: signed } = await supabase.storage
              .from('law-docs')
              .createSignedUrl(doc.storage_path, 3600)
            return { ...doc, signed_url: signed?.signedUrl || null }
          })
        )
        setDocs(withUrls)
      }
      setLoading(false)
      setHasLoaded(true)
    })()
  }, [country, open, hasLoaded])

  // If country changes, refetch
  useEffect(() => {
    setHasLoaded(false)
    setDocs([])
  }, [country])

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

  return (
    <div className="law-docs" ref={wrapperRef}>
      <button
        type="button"
        className="btn btn-ghost law-docs-toggle"
        onClick={() => setOpen((v) => !v)}
        disabled={loading}
      >
        {loading
          ? 'Loading…'
          : `📄 Law documents (${hasLoaded ? docs.length : '…'}) ${open ? '▴' : '▾'}`}
      </button>
      {open && (
        <ul className="law-docs-list">
          {!hasLoaded && (
            <li className="muted small">Loading…</li>
          )}
          {hasLoaded && docs.length === 0 && (
            <li className="muted small">No law documents uploaded yet.</li>
          )}
          {hasLoaded && docs.map((doc) => (
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