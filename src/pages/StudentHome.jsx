import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiPost } from '../lib/api.js'
import Field from '../components/Field.jsx'
import QrImage from '../components/QrImage.jsx'
import { STATUS_ICON, STATUS_LABEL, formatDate } from '../lib/matrix.js'

const STORE = 'hub_student_codes'
const read = () => { try { return JSON.parse(localStorage.getItem(STORE)) } catch { return null } }
const write = (v) => { try { v ? localStorage.setItem(STORE, JSON.stringify(v)) : localStorage.removeItem(STORE) } catch { /* stockage indisponible : on continue sans */ } }

export default function StudentHome() {
  // ?c=<code de classe> vient du QR de classe : le code de classe est prérempli.
  const [classCode, setClassCode] = useState(() => (new URLSearchParams(window.location.search).get('c') ?? '').toUpperCase())
  const [studentCode, setStudentCode] = useState('')
  const [remember, setRemember] = useState(false)
  const [tasks, setTasks] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function load(codes, keep) {
    setBusy(true); setError('')
    try {
      const res = await apiPost('/api/student', { class_code: codes.classCode, student_code: codes.studentCode }, { auth: false })
      setTasks(res.tasks)
      write(keep ? codes : null)
    } catch (e) {
      setTasks(null)
      setError(e.status === 404 ? 'Je ne reconnais pas ces codes. Regarde bien chaque lettre et chaque chiffre, puis réessaie. Sinon, demande à ton enseignant.' : e.status === 429 ? 'Trop d’essais. Attends quelques minutes.' : 'Un problème est survenu. Réessaie.')
      if (e.status === 404) write(null) // on ne purge que si les codes sont réellement inconnus
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    const saved = read()
    if (saved?.classCode && saved?.studentCode) {
      setClassCode(saved.classCode); setStudentCode(saved.studentCode); setRemember(true)
      load(saved, true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = (e) => { e.preventDefault(); load({ classCode, studentCode }, remember) }
  const leave = () => { write(null); setTasks(null); setStudentCode(''); setRemember(false) }
  const origin = window.location.origin

  if (tasks) {
    return (
      <div className="hub-student hub-stack">
        <h1 style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>Mes tâches</h1>
        {tasks.length === 0 && <p>Tu n’as pas de tâche pour le moment. Reviens plus tard, ou demande à ton enseignant.</p>}
        {tasks.length > 0 && <p className="hub-help">Appuie sur « Ouvrir » : l’exercice s’ouvre dans l’application choisie par ton enseignant.</p>}
        {tasks.map((t) => (
          <div className="plai-card hub-stack" key={t.link_id}>
            <strong>{t.title}</strong>
            <span>{t.app}{t.due_at ? ` · pour le ${formatDate(t.due_at)}` : ''}</span>
            <span className="hub-status"><span aria-hidden="true">{STATUS_ICON[t.status]}</span>{STATUS_LABEL[t.status]}</span>
            <div><a className="plai-btn" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }} href={`/a/${t.link_id}`}>Ouvrir</a></div>
            <details>
              <summary>Afficher le QR code</summary>
              <QrImage text={`${origin}/a/${t.link_id}`} size={200} alt={`QR code de la tâche ${t.title}`} />
            </details>
          </div>
        ))}
        <div><button className="plai-btn-ghost" onClick={leave}>Changer d’élève</button></div>
      </div>
    )
  }

  return (
    <form className="plai-card hub-student hub-stack" style={{ maxWidth: 520, margin: '2rem auto' }} onSubmit={submit}>
      <h1 style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>Retrouve tes tâches</h1>
      {error && <div className="plai-error" role="alert">{error}</div>}
      <Field id="class-code" label="Code de la classe" help="Ton enseignant te l’a donné. Il est écrit au tableau ou sur ta feuille.">
        <input id="class-code" className="plai-input" required autoComplete="off" autoCapitalize="characters" aria-describedby="class-code-help"
          placeholder="Ex. K7Q2MX" value={classCode} onChange={(e) => setClassCode(e.target.value)} />
      </Field>
      <Field id="student-code" label="Ton code" help="C’est ton code à toi. Ne le donne à personne d’autre.">
        <input id="student-code" className="plai-input" required autoComplete="off" autoCapitalize="characters" aria-describedby="student-code-help"
          placeholder="Ex. ABCD2345" value={studentCode} onChange={(e) => setStudentCode(e.target.value)} />
      </Field>
      <label className="hub-row">
        <input type="checkbox" aria-describedby="remember-help" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        Retenir mes codes sur cet appareil
      </label>
      <p id="remember-help" className="hub-help">Coche seulement sur ton appareil personnel, pas sur un ordinateur partagé.</p>
      <button className="plai-btn" disabled={busy}>Voir mes tâches</button>
      <details>
        <summary>Je ne trouve pas mes codes</summary>
        <p className="hub-help">Ton enseignant te les a donnés sur une carte ou une feuille. Le code de la classe est le même pour tous les élèves. Ton code à toi est différent de celui des autres. Si tu l’as perdu, demande à ton enseignant : il peut t’en donner un nouveau.</p>
      </details>
      <p className="hub-help">Vous êtes enseignant ? <Link to="/enseignant">Espace enseignant</Link> · <Link to="/aide">Aide pas à pas</Link></p>
    </form>
  )
}
