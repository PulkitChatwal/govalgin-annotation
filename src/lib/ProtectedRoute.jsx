// Gate any child route on a logged-in annotator. Redirects to /login otherwise.
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

export default function ProtectedRoute({ children }) {
  const { annotator, loading } = useAuth()
  if (loading) return <div className="page-loading">Loading…</div>
  if (!annotator) return <Navigate to="/login" replace />
  return children
}