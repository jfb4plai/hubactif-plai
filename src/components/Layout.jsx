import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'

export default function Layout({ children }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const signOut = async () => { await supabase.auth.signOut(); navigate('/') }

  return (
    <>
      <nav className="plai-nav hub-noprint">
        <Link to="/" className="plai-nav-logo">
          <img src="/plai-logo.jpg" alt="PLAI" style={{ height: 32, width: 'auto' }} />
          HubActif
        </Link>
        <div className="plai-nav-actions">
          <Link className="plai-nav-link" to="/">Espace élève</Link>
          <Link className="plai-nav-link" to="/enseignant">Espace enseignant</Link>
          <Link className="plai-nav-link" to="/aide">Aide</Link>
          {user && <button className="plai-nav-link" onClick={signOut}>Se déconnecter</button>}
        </div>
      </nav>
      <main className="plai-container" style={{ paddingTop: '1.5rem', paddingBottom: '2rem' }}>{children}</main>
      <footer className="plai-footer hub-noprint">
        <div className="plai-container">
          <img src="/plai-logo.jpg" alt="PLAI" style={{ height: 40, width: 'auto' }} />
          <p>HubActif · Pôle Territorial de la Ville de Liège · PLAI</p>
          <p>
            Code :{' '}
            <a href="https://polyformproject.org/licenses/noncommercial/1.0.0" target="_blank" rel="noopener noreferrer">PolyForm Noncommercial 1.0.0</a>
            {' · '}Contenus :{' '}
            <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.fr" target="_blank" rel="noopener noreferrer">CC BY-NC-SA 4.0</a>
            {' · '}Jean-François Beguin, jfb4plai.com
          </p>
        </div>
      </footer>
    </>
  )
}
