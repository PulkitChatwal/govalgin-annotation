// Gate any child route on admin status. Redirects non-admins to /annotate.
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

export default function AdminRoute({ children }) {
  const { annotator, loading } = useAuth()
  if (loading) return <div className="page-loading">Loading…</div>
  if (!annotator) return <Navigate to="/login" replace />
  if (!annotator.is_admin) return <Navigate to="/annotate" replace />
  return children
}