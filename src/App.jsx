import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import LoginPage from './pages/LoginPage.jsx'

export default function App() {
  return (
    <AuthProvider>
      <Layout>
        <Routes>
          <Route path="/enseignant/connexion" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/enseignant/connexion" replace />} />
        </Routes>
      </Layout>
    </AuthProvider>
  )
}
