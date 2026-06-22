// /select — pick which of the 7 countries the annotator wants to annotate.
// Shown on first login (when countries is empty) and on demand from the header.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../supabaseClient'
import { COUNTRY_CONFIG, COUNTRIES } from '../config/countries'

export default function CountrySelect() {
  const { annotator, refresh } = useAuth()
  const navigate = useNavigate()
  const [selected, setSelected] = useState(new Set(annotator?.countries || []))
  const [name, setName] = useState(annotator?.name || '')
  const [counts, setCounts] = useState({}) // { country: { total, done } }
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!annotator) return
    supabase
      .rpc('get_country_prompt_counts', { p_email: annotator.email })
      .then(({ data, error }) => {
        if (error) return
        const map = {}
        ;(data || []).forEach((row) => {
          map[row.country] = { total: Number(row.total), done: Number(row.done) }
        })
        setCounts(map)
      })
  }, [annotator])

  const toggle = (country) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(country)) next.delete(country)
      else next.add(country)
      return next
    })
  }

  const onSave = async () => {
    if (!annotator) return
    if (selected.size === 0) {
      setError('Pick at least one country.')
      return
    }
    setSaving(true)
    setError(null)
    const { error: err } = await supabase
      .from('annotators')
      .update({ countries: Array.from(selected), name: name.trim() || annotator.name })
      .eq('id', annotator.id)
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    await refresh()
    navigate('/annotate')
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Pick your countries</h1>
      </header>
      <section className="form-card">
        <label className="field">
          <span>Display name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </label>

        <h3>Which countries will you annotate?</h3>
        <div className="country-list">
          {COUNTRIES.map((country) => {
            const cfg = COUNTRY_CONFIG[country]
            const c = counts[country] || { total: 0, done: 0 }
            return (
              <label key={country} className="country-row">
                <input
                  type="checkbox"
                  checked={selected.has(country)}
                  onChange={() => toggle(country)}
                />
                <span className="country-flag">{cfg.flag}</span>
                <span className="country-name">{country}</span>
                <span className="country-counts muted small">
                  ({c.total} prompts available, {c.done} done by you)
                </span>
              </label>
            )
          })}
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save and Start Annotating'}
          </button>
        </div>
      </section>
    </div>
  )
}