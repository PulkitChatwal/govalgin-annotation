// /login — single "Sign in with Google" button.
// Supabase handles the redirect; on return, AuthContext re-fetches the annotator row.
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

export default function Login() {
  const { annotator, loading, signInWithGoogle } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  if (loading) return <div className="page-loading">Loading…</div>
  if (annotator) return <Navigate to="/annotate" replace />

  const onClick = async () => {
    setError(null)
    setBusy(true)
    try {
      await signInWithGoogle()
    } catch (e) {
      setError(e?.message || 'Sign-in failed')
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">GovAlign Annotation Platform</h1>
        <p className="login-sub">AI Governance Compliance Dataset</p>
        <p className="login-blurb">
          Verify that each prompt in the GovAlign benchmark accurately reflects the
          jurisdiction-specific AI / data-governance law it cites.
        </p>
        <button
          type="button"
          className="btn btn-primary login-button"
          onClick={onClick}
          disabled={busy}
        >
          {busy ? 'Redirecting…' : 'Sign in with Google'}
        </button>
        {error && <p className="error-text">{error}</p>}
        <p className="muted small">
          First time? You'll be asked to pick which countries you want to annotate.
        </p>
      </div>
    </div>
  )
}