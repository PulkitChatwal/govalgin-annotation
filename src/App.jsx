import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './lib/ProtectedRoute'
import AdminRoute from './lib/AdminRoute'
import Login from './pages/Login'
import CountrySelect from './pages/CountrySelect'
import Annotate from './pages/Annotate'
import AdminDashboard from './pages/AdminDashboard'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/annotate" replace />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/select"
        element={
          <ProtectedRoute>
            <CountrySelect />
          </ProtectedRoute>
        }
      />
      <Route
        path="/annotate"
        element={
          <ProtectedRoute>
            <Annotate />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        }
      />
      <Route path="*" element={<Navigate to="/annotate" replace />} />
    </Routes>
  )
}