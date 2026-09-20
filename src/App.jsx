import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import LoginPage from './pages/LoginPage.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import ClassesPage from './pages/ClassesPage.jsx'
import ClassPage from './pages/ClassPage.jsx'

export default function App() {
  return (
    <AuthProvider>
      <Layout>
        <Routes>
          <Route path="/enseignant/connexion" element={<LoginPage />} />
          <Route path="/enseignant" element={<ProtectedRoute><ClassesPage /></ProtectedRoute>} />
          <Route path="/enseignant/classes/:classId" element={<ProtectedRoute><ClassPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/enseignant" replace />} />
        </Routes>
      </Layout>
    </AuthProvider>
  )
}
