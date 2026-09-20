import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { must } from '../lib/db.js'
import { useAuth } from '../context/AuthContext.jsx'
import Field from '../components/Field.jsx'
import Callout from '../components/Callout.jsx'
import { friendlyError, userError } from '../lib/errors.js'
import { generateCode, CLASS_CODE_LENGTH } from '../../shared/codes.js'
import { needsReset } from '../../shared/dates.js'

export default function ClassesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [classes, setClasses] = useState(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('hub_classes').select('*').order('created_at', { ascending: false })
      .then((r) => { try { setClasses(must(r)) } catch (e) { setError(friendlyError(e)) } })
  }, [])

  async function create(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      for (let i = 0; i < 5; i++) {
        const { data, error } = await supabase.from('hub_classes')
          .insert({ teacher_id: user.id, name: name.trim(), class_code: generateCode(CLASS_CODE_LENGTH) }).select().single()
        if (!error) return navigate(`/enseignant/classes/${data.id}`)
        if (error.code !== '23505') throw error
      }
      throw userError('Impossible de générer un code de classe unique, réessayez.')
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const toReset = (classes ?? []).filter((c) =>
    needsReset(new Date(), { createdAt: c.created_at, lastResetAt: c.last_reset_at }))

  return (
    <div className="hub-stack">
      <h1 style={{ fontFamily: "'DM Serif Display', serif" }}>Mes classes</h1>
      {toReset.length > 0 && (
        <div className="plai-banner" role="region" aria-label="Remise à zéro de fin d’année" style={{ borderRadius: 6 }}>
          <p>
            Fin d’année : {toReset.length} classe(s) à remettre à zéro avant le 15 août, sans quoi leurs données seront supprimées automatiquement.
          </p>
          <ul>
            {toReset.map((c) => (
              <li key={c.id}><Link to={`/enseignant/classes/${c.id}`}>{c.name}</Link></li>
            ))}
          </ul>
        </div>
      )}
      {error && <div className="plai-error" role="alert">{error}</div>}
      {classes === null ? <p className="plai-empty">Chargement…</p> : classes.length === 0 ? (
        <Callout title="Bienvenue ! Pour démarrer, trois étapes">
          <ol className="hub-steps">
            <li><strong>Créez votre classe</strong> avec le formulaire ci-dessous (donnez-lui le nom que vous voulez).</li>
            <li><strong>Ajoutez vos élèves</strong> : HubActif fabrique un code par élève. Vous n’enregistrez aucun nom.</li>
            <li><strong>Donnez une tâche</strong> depuis une app PLAI branchée sur HubActif.</li>
          </ol>
          <p>Un doute ? <Link to="/aide">Lisez l’aide pas à pas</Link>.</p>
        </Callout>
      ) : classes.map((c) => (
        <div className="plai-card" key={c.id}>
          <Link to={`/enseignant/classes/${c.id}`}><strong>{c.name}</strong></Link>
          <span> · code de classe </span><span className="hub-code">{c.class_code}</span>
        </div>
      ))}
      <form className="plai-card" onSubmit={create}>
        <Field id="class-name" label="Nom de la classe"
          help="Visible uniquement par vous. Les élèves ne voient que le code de classe généré automatiquement.">
          <input id="class-name" className="plai-input" required maxLength={60} aria-describedby="class-name-help"
            placeholder="Ex. 2e secondaire B – français" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <button className="plai-btn" disabled={busy || !name.trim()}>Créer la classe</button>
      </form>
    </div>
  )
}
