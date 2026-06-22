// /annotate — the core annotation screen.
// State machine:
//   - activeCountry: comes from sessionStorage; falls back to first assigned country.
//   - prompt: the next unannotated prompt for the active country (via RPC).
//   - mode: 'save' (new annotation) or 'update' (editing previous via Previous button).
//   - editingPrevious: the prompt object being edited, when in update mode.
import { useEffect, useState, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../supabaseClient'
import { COUNTRY_CONFIG, COUNTRIES } from '../config/countries'
import PromptCard from '../components/PromptCard'
import AnnotationForm from '../components/AnnotationForm'
import ProgressBar from '../components/ProgressBar'

const STORAGE_KEY = 'govalgin.activeCountry'

function Toast({ message, kind = 'info' }) {
  if (!message) return null
  return <div className={`toast toast-${kind}`}>{message}</div>
}

export default function Annotate() {
  const { annotator, signOut } = useAuth()
  const navigate = useNavigate()
  const [toast, setToast] = useState({ message: '', kind: 'info' })

  const showToast = (message, kind = 'info') => {
    setToast({ message, kind })
    setTimeout(() => setToast({ message: '', kind: 'info' }), 3500)
  }

  // ── Active country (from sessionStorage) ──────────────────────────────
  const assignedCountries = (annotator?.countries || []).filter((c) => COUNTRIES.includes(c))
  const initialCountry = sessionStorage.getItem(STORAGE_KEY) || assignedCountries[0] || ''
  const [activeCountry, setActiveCountry] = useState(initialCountry)

  useEffect(() => {
    if (!activeCountry && assignedCountries.length > 0) {
      setActiveCountry(assignedCountries[0])
    }
  }, [assignedCountries, activeCountry])

  useEffect(() => {
    if (activeCountry) sessionStorage.setItem(STORAGE_KEY, activeCountry)
  }, [activeCountry])

  // First-login redirect to /select if no countries assigned.
  useEffect(() => {
    if (annotator && assignedCountries.length === 0) {
      navigate('/select')
    }
  }, [annotator, assignedCountries.length, navigate])

  // ── Prompt + form state ────────────────────────────────────────────────
  const [prompt, setPrompt] = useState(null)
  const [counts, setCounts] = useState({})   // { country: { total, done } }
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showExpected, setShowExpected] = useState(false)
  const [showViolation, setShowViolation] = useState(false)
  const [mode, setMode] = useState('save')
  const [editingPrompt, setEditingPrompt] = useState(null)

  const startedAtRef = useRef(Date.now())

  // ── Load counts (for the progress chips) ───────────────────────────────
  const loadCounts = useCallback(async () => {
    if (!annotator) return
    const { data, error } = await supabase.rpc('get_country_prompt_counts', {
      p_email: annotator.email,
    })
    if (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to load counts:', error)
      return
    }
    const map = {}
    ;(data || []).forEach((row) => {
      map[row.country] = { total: Number(row.total), done: Number(row.done) }
    })
    setCounts(map)
  }, [annotator])

  useEffect(() => {
    loadCounts()
  }, [loadCounts])

  // ── Load next prompt for the active country ────────────────────────────
  const loadNext = useCallback(async () => {
    if (!annotator || !activeCountry) {
      setPrompt(null)
      return
    }
    setLoading(true)
    setShowExpected(false)
    setShowViolation(false)
    setMode('save')
    setEditingPrompt(null)
    startedAtRef.current = Date.now()
    const { data, error } = await supabase.rpc('get_next_prompt', {
      p_country: activeCountry,
      p_email: annotator.email,
    })
    if (error) {
      showToast(error.message, 'error')
      setPrompt(null)
    } else {
      setPrompt(data && data.length > 0 ? data[0] : null)
    }
    setLoading(false)
  }, [annotator, activeCountry])

  useEffect(() => {
    loadNext()
  }, [loadNext])

  // ── Save / Update handler ──────────────────────────────────────────────
  const handleSubmit = async (formData) => {
    if (!annotator) return
    const targetPrompt = mode === 'update' && editingPrompt ? editingPrompt : prompt
    if (!targetPrompt) return
    setSubmitting(true)
    const elapsed = Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000))
    const row = {
      prompt_id: targetPrompt.id,
      annotator_email: annotator.email,
      annotator_name: annotator.name,
      country: targetPrompt.country,
      ...formData,
      time_spent_sec: elapsed,
    }
    const { error } = await supabase
      .from('annotations')
      .upsert(row, { onConflict: 'prompt_id,annotator_email' })
    setSubmitting(false)
    if (error) {
      showToast(`Save failed: ${error.message}`, 'error')
      return
    }
    showToast(mode === 'update' ? 'Updated' : 'Saved', 'success')
    await loadCounts()
    await loadNext()
  }

  // ── Skip: just advance to next prompt (no DB write) ────────────────────
  const handleSkip = () => {
    if (!prompt) return
    // Just reload the queue — since this prompt is unannotated, it will stay in
    // the queue and come back on the next session. We move on visually.
    showToast('Skipped — will return to queue', 'info')
    loadNext()
  }

  // ── Previous: fetch the most recent saved annotation, pre-fill form ────
  const handlePrevious = async () => {
    if (!annotator) return
    setLoading(true)
    const { data, error } = await supabase.rpc('get_previous_annotation', {
      p_email: annotator.email,
    })
    setLoading(false)
    if (error) {
      showToast(`Failed to load previous: ${error.message}`, 'error')
      return
    }
    if (!data || data.length === 0) {
      showToast('No previous annotation found', 'info')
      return
    }
    const row = data[0]
    const ann = row.annotation
    const prevPrompt = row.prompt
    setEditingPrompt(prevPrompt)
    setPrompt(prevPrompt)
    setMode('update')
    setShowExpected(false)
    setShowViolation(false)
    startedAtRef.current = Date.now()
    // Stash the pre-filled form on a ref-ish key for AnnotationForm to consume.
    setPreFilled({
      law_verified: ann.law_verified || '',
      law_note: ann.law_note || '',
      law_article_ok: ann.law_article_ok ?? null,
      dimension_ok: ann.dimension_ok ?? null,
      prompt_ok: ann.prompt_ok ?? null,
      expected_ok: ann.expected_ok ?? null,
      violation_ok: ann.violation_ok ?? null,
      alignment_note: ann.alignment_note || '',
      difficulty: ann.difficulty || '',
      implicitness: ann.implicitness || '',
    })
  }

  const [preFilled, setPreFilled] = useState(null)
  // Clear pre-filled when the next-prompt load fires.
  useEffect(() => {
    if (mode === 'save') setPreFilled(null)
  }, [mode])

  if (!annotator) return <div className="page-loading">Loading…</div>

  const countsForActive = counts[activeCountry] || { total: 0, done: 0 }

  return (
    <div className="page">
      <header className="page-header">
        <h1>GovAlign</h1>
        <nav className="page-nav">
          <span className="muted small">
            {annotator.name} · {annotator.email}
          </span>
          {annotator.is_admin && (
            <Link to="/admin" className="btn btn-ghost">Admin</Link>
          )}
          <Link to="/select" className="btn btn-ghost">Change countries</Link>
          <button type="button" className="btn btn-ghost" onClick={signOut}>
            Sign out
          </button>
        </nav>
      </header>

      {/* Country selector + progress chips */}
      <div className="country-bar">
        <label className="country-select-label">
          <span className="muted small">Country</span>
          <select
            className="country-select"
            value={activeCountry}
            onChange={(e) => setActiveCountry(e.target.value)}
          >
            {assignedCountries.map((c) => (
              <option key={c} value={c}>
                {COUNTRY_CONFIG[c]?.flag} {c}
              </option>
            ))}
          </select>
        </label>
        <div className="country-chips">
          {assignedCountries.map((c) => {
            const cc = counts[c] || { total: 0, done: 0 }
            const active = c === activeCountry
            return (
              <button
                key={c}
                type="button"
                className={`country-chip ${active ? 'active' : ''}`}
                onClick={() => setActiveCountry(c)}
              >
                {COUNTRY_CONFIG[c]?.flag} {c}: <strong>{cc.done}/{cc.total}</strong>
              </button>
            )
          })}
        </div>
      </div>

      <ProgressBar done={countsForActive.done} total={countsForActive.total} className="main-progress" />

      {mode === 'update' && editingPrompt && (
        <p className="mode-banner">
          Editing previous annotation: <strong>{editingPrompt.prompt_id}</strong>
        </p>
      )}

      {loading ? (
        <div className="page-loading">Loading prompt…</div>
      ) : !prompt ? (
        <div className="empty-state">
          <h2>All done for {activeCountry}!</h2>
          <p>
            You've annotated every prompt in this country.
            {countsForActive.done > 0 && (
              <> That's {countsForActive.done} prompt{countsForActive.done === 1 ? '' : 's'}.</>
            )}
          </p>
        </div>
      ) : (
        <>
          <PromptCard
            prompt={prompt}
            showExpected={showExpected}
            onToggleExpected={() => setShowExpected((v) => !v)}
            showViolation={showViolation}
            onToggleViolation={() => setShowViolation((v) => !v)}
          />
          <AnnotationForm
            initial={preFilled}
            mode={mode}
            onSubmit={handleSubmit}
            submitting={submitting}
          />
          <div className="footer-actions">
            <button
              type="button"
              className="btn"
              onClick={handlePrevious}
              disabled={submitting}
            >
              ← Previous
            </button>
            <button
              type="button"
              className="btn"
              onClick={handleSkip}
              disabled={submitting}
            >
              Skip this prompt
            </button>
          </div>
        </>
      )}

      <Toast message={toast.message} kind={toast.kind} />
    </div>
  )
}