import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import Field from '../components/Field.jsx'
import { friendlyError } from '../lib/errors.js'

const FR = {
  'Invalid login credentials': 'Adresse e-mail ou mot de passe incorrect.',
  'Email not confirmed': 'Adresse non confirmée : ouvrez le message reçu à l’inscription.',
  'User already registered': 'Un compte existe déjà avec cette adresse.',
}
const message = (e) => FR[e?.message] ?? friendlyError(e)

const TITLES = {
  signin: 'Connexion enseignant',
  signup: 'Créer un compte enseignant',
  reset: 'Mot de passe oublié',
  newpass: 'Choisir un nouveau mot de passe',
}

export default function LoginPage() {
  const [mode, setMode] = useState(() => (/type=recovery/.test(window.location.hash) ? 'newpass' : 'signin')) // signin | signup | reset | newpass
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
        setInfo('Compte créé. Il reste une étape : ouvrez votre boîte mail. Un message de confirmation vient de vous être envoyé (regardez aussi dans les courriers indésirables). Cliquez sur le lien du message, puis revenez ici pour vous connecter.')
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
      {mode === 'signin' && <p className="hub-help" style={{ marginBottom: '1rem' }}>Cet espace est réservé aux enseignants. Vos élèves n’ont pas besoin de compte : ils utilisent des codes. Première visite ? Cliquez sur « Créer un compte ».</p>}
      {mode === 'signup' && (
        <ol className="hub-steps" style={{ marginBottom: '1rem' }}>
          <li>Saisissez votre adresse professionnelle et choisissez un mot de passe.</li>
          <li>Vous recevez un e-mail : cliquez sur le lien pour confirmer votre adresse.</li>
          <li>Revenez ici, cliquez sur « J’ai déjà un compte » et connectez-vous.</li>
        </ol>
      )}
      {mode === 'reset' && <p className="hub-help" style={{ marginBottom: '1rem' }}>Saisissez votre adresse : nous vous envoyons un lien pour choisir un nouveau mot de passe.</p>}
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
        <div className={error ? 'plai-error' : undefined} role="alert">{error}</div>
        <div className={info ? 'plai-success' : undefined} role="status" aria-live="polite">{info}</div>
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
      {mode !== 'newpass' && (
        <p className="hub-help" style={{ marginTop: '1rem' }}>Besoin d’aide ? <Link to="/aide">Lisez l’aide pas à pas</Link>.</p>
      )}
    </div>
  )
}
