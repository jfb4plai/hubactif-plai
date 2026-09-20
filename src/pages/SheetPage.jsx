import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { must } from '../lib/db.js'
import QrImage from '../components/QrImage.jsx'

export default function SheetPage() {
  const { assignmentId } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const assignment = must(await supabase.from('hub_assignments')
          .select('id, title, due_at, class_id, hub_classes(name, class_code)').eq('id', assignmentId).single())
        const targets = must(await supabase.from('hub_targets')
          .select('id, hub_students(code), hub_links(id, revoked, created_at)').eq('assignment_id', assignmentId))
        const cards = targets.map((t) => {
          const live = (t.hub_links ?? []).filter((l) => !l.revoked).sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
          return { code: t.hub_students.code, linkId: live?.id }
        }).filter((c) => c.linkId).sort((a, b) => a.code.localeCompare(b.code))
        setData({ assignment, cards })
      } catch (e) { setError(e.message || 'Chargement impossible.') }
    })()
  }, [assignmentId])

  if (error) return <div className="plai-error" role="alert">{error}</div>
  if (!data) return <p className="plai-empty">Chargement…</p>
  const { assignment, cards } = data
  const origin = window.location.origin

  return (
    <div className="hub-stack">
      <div className="hub-noprint hub-row">
        <Link to={`/enseignant/classes/${assignment.class_id}`}>← Retour à la classe</Link>
        <button className="plai-btn" onClick={() => window.print()}>Imprimer</button>
      </div>
      <h1 style={{ fontFamily: "'DM Serif Display', serif" }}>{assignment.title}</h1>
      <p>Espace élève : <strong>{origin}</strong> · code de classe <span className="hub-code">{assignment.hub_classes.class_code}</span></p>
      <div className="hub-sheet hub-student">
        {cards.map((c) => (
          <div className="hub-sheet-card" key={c.code}>
            <p><strong>{assignment.title}</strong></p>
            <QrImage text={`${origin}/a/${c.linkId}`} size={170} alt={`QR code de la tâche pour l’élève ${c.code}`} />
            <p>Code : <span className="hub-code">{c.code}</span></p>
            <p>{origin}/a/{c.linkId}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
