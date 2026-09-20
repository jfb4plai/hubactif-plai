import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import StudentHome from './pages/StudentHome.jsx'
import LoginPage from './pages/LoginPage.jsx'
import ClassesPage from './pages/ClassesPage.jsx'
import ClassPage from './pages/ClassPage.jsx'
import StudentFilePage from './pages/StudentFilePage.jsx'
import AssignPage from './pages/AssignPage.jsx'
import SheetPage from './pages/SheetPage.jsx'
import HelpPage from './pages/HelpPage.jsx'

export default function App() {
  return (
    <AuthProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<StudentHome />} />
          <Route path="/aide" element={<HelpPage />} />
          <Route path="/enseignant/connexion" element={<LoginPage />} />
          <Route path="/enseignant" element={<ProtectedRoute><ClassesPage /></ProtectedRoute>} />
          <Route path="/enseignant/classes/:classId" element={<ProtectedRoute><ClassPage /></ProtectedRoute>} />
          <Route path="/enseignant/classes/:classId/eleves/:studentId" element={<ProtectedRoute><StudentFilePage /></ProtectedRoute>} />
          <Route path="/enseignant/assigner" element={<ProtectedRoute><AssignPage /></ProtectedRoute>} />
          <Route path="/enseignant/assignations/:assignmentId/feuille" element={<ProtectedRoute><SheetPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </AuthProvider>
  )
}
