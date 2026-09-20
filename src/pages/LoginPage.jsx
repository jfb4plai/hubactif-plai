import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import Field from '../components/Field.jsx'

const FR = {
  'Invalid login credentials': 'Adresse e-mail ou mot de passe incorrect.',
  'Email not confirmed': 'Adresse non confirmée : ouvrez le message reçu à l’inscription.',
  'User already registered': 'Un compte existe déjà avec cette adresse.',
}
const message = (e) => FR[e?.message] ?? e?.message ?? 'Une erreur est survenue.'

const TITLES = {
  signin: 'Connexion enseignant',
  signup: 'Créer un compte enseignant',
  reset: 'Mot de passe oublié',
  newpass: 'Choisir un nouveau mot de passe',
}

export default function LoginPage() {
  const [mode, setMode] = useState('signin') // signin | signup | reset | newpass
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const from = useLocation().state?.from
  const back = from ? from.pathname + from.search : '/enseignant'

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') setMode('newpass') })
    return () => data.subscription.unsubscribe()
  }, [])

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError(''); setInfo('')
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        navigate(back, { replace: true })
      } else if (mode === 'signup') {
        // emailRedirectTo obligatoire : sans lui le lien de confirmation renvoie vers une autre app du projet partagé.
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/enseignant` } })
        if (error) throw error
        setInfo('Compte créé. Ouvrez le message reçu pour confirmer votre adresse, puis connectez-vous.')
      } else if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/enseignant/connexion` })
        if (error) throw error
        setInfo('Si cette adresse existe, un lien de réinitialisation vient d’être envoyé.')
      } else {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        navigate('/enseignant', { replace: true })
      }
    } catch (err) {
      setError(message(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="plai-card" style={{ maxWidth: 480, margin: '2rem auto' }}>
      <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 26, marginBottom: '1rem' }}>{TITLES[mode]}</h1>
      <form onSubmit={submit}>
        {mode !== 'newpass' && (
          <Field id="email" label="Adresse e-mail professionnelle" help="Sert uniquement à vous connecter à vos classes. Les élèves n’ont pas de compte.">
            <input id="email" type="email" className="plai-input" required autoComplete="email" aria-describedby="email-help"
              placeholder="prenom.nom@ecole.be" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
        )}
        {mode !== 'reset' && (
          <Field id="password" label={mode === 'newpass' ? 'Nouveau mot de passe' : 'Mot de passe'}
            help="8 caractères minimum. Il donne accès à vos classes et aux codes de vos élèves : ne le réutilisez pas ailleurs.">
            <input id="password" type="password" className="plai-input" required minLength={8} aria-describedby="password-help"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              placeholder="8 caractères minimum" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        )}
        {error && <div className="plai-error" role="alert">{error}</div>}
        {info && <div className="plai-success" role="status">{info}</div>}
        <button className="plai-btn" type="submit" disabled={busy}>
          {{ signin: 'Se connecter', signup: 'Créer le compte', reset: 'Envoyer le lien', newpass: 'Enregistrer' }[mode]}
        </button>
      </form>
      {mode !== 'newpass' && (
        <div className="hub-row" style={{ marginTop: '1rem' }}>
          {mode !== 'signin' && <button type="button" className="plai-btn-ghost" onClick={() => setMode('signin')}>J’ai déjà un compte</button>}
          {mode !== 'signup' && <button type="button" className="plai-btn-ghost" onClick={() => setMode('signup')}>Créer un compte</button>}
          {mode === 'signin' && <button type="button" className="plai-btn-ghost" onClick={() => setMode('reset')}>Mot de passe oublié</button>}
        </div>
      )}
    </div>
  )
}
