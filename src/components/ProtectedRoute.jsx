import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

// Redirige vers la connexion en gardant l'adresse demandée (utile pour /enseignant/assigner?...).
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <p className="plai-empty">Chargement…</p>
  if (!user) return <Navigate to="/enseignant/connexion" state={{ from: location }} replace />
  return children
}
