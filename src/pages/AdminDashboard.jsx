// /admin — only the admin email (pulkitchatwal@gmail.com) can reach this.
// Tabs: Upload Dataset | Upload Law Documents | Annotator Management | Export Annotations.
import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Papa from 'papaparse'
import { supabase } from '../supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { COUNTRIES, COUNTRY_CONFIG } from '../config/countries'
import { rowsToCsv, downloadCsv } from '../lib/csv'
import { todayIso } from '../lib/time'

const TABS = [
  { key: 'dataset',    label: 'Upload Dataset' },
  { key: 'lawdocs',    label: 'Upload Law Documents' },
  { key: 'annotators', label: 'Annotator Management' },
  { key: 'export',     label: 'Export Annotations' },
]

function Toast({ message, kind = 'info' }) {
  const [visible, setVisible] = useState(!!message)
  useEffect(() => {
    setVisible(!!message)
    if (message) {
      const t = setTimeout(() => setVisible(false), 4000)
      return () => clearTimeout(t)
    }
  }, [message])
  if (!visible || !message) return null
  return <div className={`toast toast-${kind}`}>{message}</div>
}

// ── Tab 1: Upload Dataset ─────────────────────────────────────────────────────
function UploadDatasetTab({ showToast }) {
  const [country, setCountry] = useState(COUNTRIES[0])
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [counts, setCounts] = useState({})

  const refreshCounts = useCallback(async () => {
    const { data } = await supabase.from('prompts').select('country, id')
    const map = {}
    ;(data || []).forEach((r) => { map[r.country] = (map[r.country] || 0) + 1 })
    setCounts(map)
  }, [])

  useEffect(() => { refreshCounts() }, [refreshCounts])

  const onUpload = async () => {
    if (!file) {
      showToast('Pick a CSV file first', 'error')
      return
    }
    setBusy(true)
    setResult(null)
    const text = await file.text()
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
    if (parsed.errors?.length) {
      showToast(`CSV parse error: ${parsed.errors[0].message}`, 'error')
      setBusy(false)
      return
    }
    const required = ['prompt_id', 'jurisdiction', 'law_article', 'compliance_dimension', 'prompt_text', 'expected_behavior', 'violation_type', 'language']
    const headers = parsed.meta?.fields || []
    const missing = required.filter((c) => !headers.includes(c))
    if (missing.length) {
      showToast(`Missing columns: ${missing.join(', ')}`, 'error')
      setBusy(false)
      return
    }
    const rows = parsed.data.map((r) => ({
      ...r,
      country,
      uploaded_by: 'pulkitchatwal@gmail.com',
    }))
    let inserted = 0
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100)
      const { error } = await supabase
        .from('prompts')
        .upsert(batch, { onConflict: 'id' })
      if (error) {
        showToast(`Batch ${i / 100 + 1} failed: ${error.message}`, 'error')
        setBusy(false)
        return
      }
      inserted += batch.length
    }
    setResult({ inserted, total: rows.length })
    showToast(`Uploaded ${inserted} prompts for ${country}`, 'success')
    setFile(null)
    refreshCounts()
    setBusy(false)
  }

  return (
    <div className="tab-content">
      <h2>Upload Dataset</h2>
      <div className="form-card">
        <label className="field">
          <span>Country</span>
          <select value={country} onChange={(e) => setCountry(e.target.value)}>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{COUNTRY_CONFIG[c]?.flag} {c}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>CSV file (required columns: prompt_id, jurisdiction, law_article, compliance_dimension, prompt_text, expected_behavior, violation_type, language)</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onUpload}
            disabled={busy || !file}
          >
            {busy ? 'Uploading…' : 'Upload'}
          </button>
        </div>
        {result && (
          <p className="muted small">Inserted/updated {result.inserted} of {result.total} rows.</p>
        )}
      </div>

      <h3>Current prompts by country</h3>
      <table className="data-table">
        <thead><tr><th>Country</th><th>Prompts</th></tr></thead>
        <tbody>
          {COUNTRIES.map((c) => (
            <tr key={c}>
              <td>{COUNTRY_CONFIG[c]?.flag} {c}</td>
              <td>{counts[c] || 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Tab 2: Upload Law Documents ──────────────────────────────────────────────
function UploadLawDocsTab({ showToast }) {
  const [country, setCountry] = useState(COUNTRIES[0])
  const [lawName, setLawName] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [docs, setDocs] = useState([])

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from('law_documents')
      .select('*')
      .order('uploaded_at', { ascending: false })
    setDocs(data || [])
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const onUpload = async () => {
    if (!file || !lawName) {
      showToast('Law name and file are required', 'error')
      return
    }
    setBusy(true)
    const path = `${country}/${file.name}`
    const { error: upErr } = await supabase.storage
      .from('law-docs')
      .upload(path, file, { upsert: true })
    if (upErr) {
      showToast(`Upload failed: ${upErr.message}`, 'error')
      setBusy(false)
      return
    }
    const { error: insErr } = await supabase
      .from('law_documents')
      .insert({
        country,
        law_name: lawName,
        description,
        filename: file.name,
        storage_path: path,
      })
    if (insErr) {
      showToast(`DB insert failed: ${insErr.message}`, 'error')
      setBusy(false)
      return
    }
    showToast('Law document uploaded', 'success')
    setFile(null)
    setLawName('')
    setDescription('')
    refresh()
    setBusy(false)
  }

  const onDelete = async (doc) => {
    if (!confirm(`Delete "${doc.law_name}"?`)) return
    await supabase.storage.from('law-docs').remove([doc.storage_path])
    await supabase.from('law_documents').delete().eq('id', doc.id)
    showToast('Deleted', 'success')
    refresh()
  }

  return (
    <div className="tab-content">
      <h2>Upload Law Documents</h2>
      <div className="form-card">
        <label className="field">
          <span>Country</span>
          <select value={country} onChange={(e) => setCountry(e.target.value)}>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{COUNTRY_CONFIG[c]?.flag} {c}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Law name (e.g. DPDPA 2023)</span>
          <input
            type="text"
            value={lawName}
            onChange={(e) => setLawName(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Description</span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="field">
          <span>PDF file</span>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onUpload}
            disabled={busy || !file || !lawName}
          >
            {busy ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>

      <h3>All uploaded documents</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>Country</th>
            <th>Law name</th>
            <th>Description</th>
            <th>Filename</th>
            <th>Uploaded</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {docs.length === 0 && (
            <tr><td colSpan={6} className="muted">No documents yet.</td></tr>
          )}
          {docs.map((d) => (
            <tr key={d.id}>
              <td>{d.country}</td>
              <td>{d.law_name}</td>
              <td className="muted small">{d.description}</td>
              <td className="muted small">{d.filename}</td>
              <td className="muted small">{new Date(d.uploaded_at).toLocaleString()}</td>
              <td>
                <button type="button" className="btn btn-ghost" onClick={() => onDelete(d)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Tab 3: Annotator Management ──────────────────────────────────────────────
function AnnotatorManagementTab({ showToast }) {
  const [annotators, setAnnotators] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editCountries, setEditCountries] = useState([])

  const refresh = useCallback(async () => {
    setLoading(true)
    const [{ data: anns }, { data: counts }] = await Promise.all([
      supabase.from('annotators').select('*').order('created_at', { ascending: true }),
      supabase.from('annotations').select('annotator_email, country'),
    ])
    const tally = {}
    ;(counts || []).forEach((r) => {
      if (!tally[r.annotator_email]) tally[r.annotator_email] = { total: 0, byCountry: {} }
      tally[r.annotator_email].total++
      tally[r.annotator_email].byCountry[r.country] = (tally[r.annotator_email].byCountry[r.country] || 0) + 1
    })
    setAnnotators((anns || []).map((a) => ({ ...a, counts: tally[a.email] || { total: 0, byCountry: {} } })))
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const startEdit = (a) => {
    setEditingId(a.id)
    setEditCountries(a.countries || [])
  }
  const toggleCountry = (c) => {
    setEditCountries((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c])
  }
  const saveEdit = async (a) => {
    const { error } = await supabase
      .from('annotators')
      .update({ countries: editCountries })
      .eq('id', a.id)
    if (error) {
      showToast(`Update failed: ${error.message}`, 'error')
      return
    }
    showToast('Updated', 'success')
    setEditingId(null)
    refresh()
  }
  const removeAnnotator = async (a) => {
    if (!confirm(`Remove access for ${a.email}? This clears their countries.`)) return
    const { error } = await supabase
      .from('annotators')
      .update({ countries: [] })
      .eq('id', a.id)
    if (error) {
      showToast(`Remove failed: ${error.message}`, 'error')
      return
    }
    showToast('Removed', 'success')
    refresh()
  }

  if (loading) return <div className="page-loading">Loading annotators…</div>

  return (
    <div className="tab-content">
      <h2>Annotator Management</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Countries</th>
            <th>Annotations</th>
            <th>By country</th>
            <th>Joined</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {annotators.map((a) => (
            <tr key={a.id}>
              <td>{a.name}{a.is_admin && <span className="badge badge-admin"> admin</span>}</td>
              <td className="muted small">{a.email}</td>
              <td>
                {editingId === a.id ? (
                  <div className="edit-countries">
                    {COUNTRIES.map((c) => (
                      <label key={c} className="checkbox">
                        <input
                          type="checkbox"
                          checked={editCountries.includes(c)}
                          onChange={() => toggleCountry(c)}
                        />
                        <span>{c}</span>
                      </label>
                    ))}
                    <button type="button" className="btn btn-primary" onClick={() => saveEdit(a)}>Save</button>
                    <button type="button" className="btn btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                ) : (
                  <>{(a.countries || []).join(', ') || <span className="muted small">(none)</span>}</>
                )}
              </td>
              <td>{a.counts.total}</td>
              <td className="muted small">
                {Object.entries(a.counts.byCountry).map(([c, n]) => (
                  <div key={c}>{c}: {n}</div>
                ))}
              </td>
              <td className="muted small">{new Date(a.created_at).toLocaleDateString()}</td>
              <td>
                {editingId !== a.id && (
                  <>
                    <button type="button" className="btn btn-ghost" onClick={() => startEdit(a)}>
                      Edit countries
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => removeAnnotator(a)}>
                      Remove
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Tab 4: Export Annotations ────────────────────────────────────────────────
function ExportTab({ showToast }) {
  const [stats, setStats] = useState(null)
  const [busy, setBusy] = useState(false)

  const loadStats = useCallback(async () => {
    setBusy(true)
    let allRows = []
    let from = 0
    const PAGE = 1000
    while (true) {
      const { data, error } = await supabase
        .from('annotations')
        .select('*')
        .range(from, from + PAGE - 1)
      if (error) {
        showToast(`Failed to load annotations: ${error.message}`, 'error')
        setBusy(false)
        return
      }
      allRows = allRows.concat(data || [])
      if (!data || data.length < PAGE) break
      from += PAGE
    }

    const { data: prompts } = await supabase.from('prompts').select('id, country')
    const totalByCountry = {}
    ;(prompts || []).forEach((p) => { totalByCountry[p.country] = (totalByCountry[p.country] || 0) + 1 })
    const doneByCountry = {}
    allRows.forEach((r) => { doneByCountry[r.country] = (doneByCountry[r.country] || 0) + 1 })

    const byAnnotator = {}
    allRows.forEach((r) => {
      if (!byAnnotator[r.annotator_email]) byAnnotator[r.annotator_email] = { count: 0, time: 0, withTime: 0 }
      byAnnotator[r.annotator_email].count++
      if (r.time_spent_sec != null) {
        byAnnotator[r.annotator_email].time += r.time_spent_sec
        byAnnotator[r.annotator_email].withTime++
      }
    })

    const byPrompt = {}
    allRows.forEach((r) => {
      if (!byPrompt[r.prompt_id]) byPrompt[r.prompt_id] = []
      byPrompt[r.prompt_id].push(r)
    })
    const multi = Object.values(byPrompt).filter((arr) => arr.length >= 2)
    const iaa = { law_verified: 0, difficulty: 0, implicitness: 0 }
    if (multi.length > 0) {
      ;['law_verified', 'difficulty', 'implicitness'].forEach((field) => {
        const agree = multi.filter((arr) => new Set(arr.map((a) => a[field])).size === 1).length
        iaa[field] = Math.round((agree / multi.length) * 100)
      })
    }

    setStats({
      total: allRows.length,
      perCountry: COUNTRIES.map((c) => ({
        country: c,
        total: totalByCountry[c] || 0,
        done: doneByCountry[c] || 0,
        pct: totalByCountry[c] ? Math.round((doneByCountry[c] / totalByCountry[c]) * 100) : 0,
      })),
      byAnnotator: Object.entries(byAnnotator).map(([email, v]) => ({
        email,
        count: v.count,
        avgTime: v.withTime > 0 ? Math.round(v.time / v.withTime) : null,
      })),
      multi: multi.length,
      iaa,
    })
    setBusy(false)
  }, [showToast])

  useEffect(() => { loadStats() }, [loadStats])

  const downloadAll = async () => {
    setBusy(true)
    let all = []
    let from = 0
    const PAGE = 1000
    while (true) {
      const { data, error } = await supabase
        .from('annotations')
        .select('*, prompts(*)')
        .range(from, from + PAGE - 1)
      if (error) {
        showToast(`Export failed: ${error.message}`, 'error')
        setBusy(false)
        return
      }
      all = all.concat(data || [])
      if (!data || data.length < PAGE) break
      from += PAGE
    }
    if (all.length === 0) {
      showToast('No annotations to export', 'info')
      setBusy(false)
      return
    }
    const flat = all.map((r) => {
      const p = r.prompts || {}
      const { prompts, ...rest } = r
      return { ...rest, ...Object.fromEntries(Object.entries(p).map(([k, v]) => [`prompt_${k}`, v])) }
    })
    const csv = rowsToCsv(flat)
    downloadCsv(`govalign_annotations_${todayIso()}.csv`, csv)
    showToast(`Exported ${flat.length} rows`, 'success')
    setBusy(false)
  }

  const downloadCountry = async (country) => {
    setBusy(true)
    let all = []
    let from = 0
    const PAGE = 1000
    while (true) {
      const { data, error } = await supabase
        .from('annotations')
        .select('*, prompts(*)')
        .eq('country', country)
        .range(from, from + PAGE - 1)
      if (error) {
        showToast(`Export failed: ${error.message}`, 'error')
        setBusy(false)
        return
      }
      all = all.concat(data || [])
      if (!data || data.length < PAGE) break
      from += PAGE
    }
    if (all.length === 0) {
      showToast(`No annotations for ${country}`, 'info')
      setBusy(false)
      return
    }
    const flat = all.map((r) => {
      const p = r.prompts || {}
      const { prompts, ...rest } = r
      return { ...rest, ...Object.fromEntries(Object.entries(p).map(([k, v]) => [`prompt_${k}`, v])) }
    })
    const csv = rowsToCsv(flat)
    const slug = country.toLowerCase().replace(/\s+/g, '_')
    downloadCsv(`govalign_annotations_${slug}_${todayIso()}.csv`, csv)
    showToast(`Exported ${flat.length} rows for ${country}`, 'success')
    setBusy(false)
  }

  if (!stats) return <div className="page-loading">Loading stats…</div>

  return (
    <div className="tab-content">
      <h2>Export Annotations</h2>

      <section>
        <h3>Summary</h3>
        <p>Total annotations: <strong>{stats.total}</strong></p>
        <table className="data-table">
          <thead>
            <tr><th>Country</th><th>Total prompts</th><th>Annotated</th><th>% complete</th></tr>
          </thead>
          <tbody>
            {stats.perCountry.map((c) => (
              <tr key={c.country}>
                <td>{COUNTRY_CONFIG[c.country]?.flag} {c.country}</td>
                <td>{c.total}</td>
                <td>{c.done}</td>
                <td>{c.pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h3>Per annotator</h3>
        <table className="data-table">
          <thead>
            <tr><th>Email</th><th>Annotations</th><th>Avg time (sec)</th></tr>
          </thead>
          <tbody>
            {stats.byAnnotator.length === 0 && (
              <tr><td colSpan={3} className="muted">No annotations yet.</td></tr>
            )}
            {stats.byAnnotator.map((a) => (
              <tr key={a.email}>
                <td className="muted small">{a.email}</td>
                <td>{a.count}</td>
                <td>{a.avgTime ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h3>Inter-annotator agreement</h3>
        {stats.multi === 0 ? (
          <p className="muted small">No prompts have ≥2 annotations yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Field</th><th>Agreement</th></tr>
            </thead>
            <tbody>
              <tr><td>law_verified</td><td>{stats.iaa.law_verified}%</td></tr>
              <tr><td>difficulty</td><td>{stats.iaa.difficulty}%</td></tr>
              <tr><td>implicitness</td><td>{stats.iaa.implicitness}%</td></tr>
              <tr><td className="muted">Prompts with ≥2 annotations</td><td>{stats.multi}</td></tr>
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h3>Downloads</h3>
        <div className="downloads">
          <button type="button" className="btn btn-primary" onClick={downloadAll} disabled={busy}>
            {busy ? 'Working…' : 'Download All Annotations CSV'}
          </button>
          <h4>Per country</h4>
          <div className="download-list">
            {COUNTRIES.map((c) => (
              <button
                key={c}
                type="button"
                className="btn"
                onClick={() => downloadCountry(c)}
                disabled={busy}
              >
                {COUNTRY_CONFIG[c]?.flag} {c}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

// ── Dashboard shell ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { signOut, annotator } = useAuth()
  const [tab, setTab] = useState('dataset')
  const [toast, setToast] = useState({ message: '', kind: 'info' })

  const showToast = (message, kind = 'info') => {
    setToast({ message, kind })
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Admin Dashboard</h1>
        <nav className="page-nav">
          <span className="muted small">{annotator?.email}</span>
          <Link to="/annotate" className="btn btn-ghost">Annotate</Link>
          <button type="button" className="btn btn-ghost" onClick={signOut}>Sign out</button>
        </nav>
      </header>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`tab-button ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dataset' && <UploadDatasetTab showToast={showToast} />}
      {tab === 'lawdocs' && <UploadLawDocsTab showToast={showToast} />}
      {tab === 'annotators' && <AnnotatorManagementTab showToast={showToast} />}
      {tab === 'export' && <ExportTab showToast={showToast} />}

      <Toast message={toast.message} kind={toast.kind} />
    </div>
  )
}