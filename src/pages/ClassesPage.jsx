import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { must } from '../lib/db.js'
import { useAuth } from '../context/AuthContext.jsx'
import Field from '../components/Field.jsx'
import { generateCode, CLASS_CODE_LENGTH } from '../../shared/codes.js'

export default function ClassesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [classes, setClasses] = useState(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('hub_classes').select('*').order('created_at', { ascending: false })
      .then((r) => { try { setClasses(must(r)) } catch (e) { setError(e.message) } })
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
      throw new Error('Impossible de générer un code de classe unique, réessayez.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="hub-stack">
      <h1 style={{ fontFamily: "'DM Serif Display', serif" }}>Mes classes</h1>
      {error && <div className="plai-error" role="alert">{error}</div>}
      {classes === null ? <p className="plai-empty">Chargement…</p> : classes.length === 0 ? (
        <p className="plai-empty">Aucune classe pour l’instant. Créez la première ci-dessous.</p>
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
