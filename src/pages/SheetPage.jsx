import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { must } from '../lib/db.js'
import QrImage from '../components/QrImage.jsx'
import Callout from '../components/Callout.jsx'
import { pickLiveLink } from '../lib/links.js'
import { friendlyError } from '../lib/errors.js'

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
          .select('id, hub_students(code), hub_links(id, revoked, created_at, expires_at)').eq('assignment_id', assignmentId))
        const now = new Date()
        const all = targets.map((t) => ({ code: t.hub_students.code, linkId: pickLiveLink(t.hub_links, now)?.id }))
        const cards = all.filter((c) => c.linkId).sort((a, b) => a.code.localeCompare(b.code))
        const missing = all.filter((c) => !c.linkId).map((c) => c.code).sort()
        setData({ assignment, cards, missing })
      } catch (e) { setError(friendlyError(e)) }
    })()
  }, [assignmentId])

  if (error) return <div className="plai-error" role="alert">{error}</div>
  if (!data) return <p className="plai-empty">Chargement…</p>
  const { assignment, cards, missing } = data
  const origin = window.location.origin

  return (
    <div className="hub-stack">
      <div className="hub-noprint hub-row">
        <Link to={`/enseignant/classes/${assignment.class_id}`}>← Retour à la classe</Link>
        <button className="plai-btn" onClick={() => window.print()}>Imprimer</button>
      </div>
      {missing.length > 0 && (
        <div className="plai-error hub-noprint" role="alert">
          {missing.length} élève(s) sans lien valide : régénérez leur lien depuis leur fiche. Codes : {missing.join(', ')}.
        </div>
      )}
      <Callout title="Comment utiliser cette feuille">
        <ol className="hub-steps">
          <li>Cliquez sur « Imprimer ».</li>
          <li>Découpez chaque carte le long des pointillés.</li>
          <li>Donnez une carte à chaque élève. Il scanne le QR code avec l’appareil photo d’une tablette ou d’un téléphone, ou tape l’adresse écrite sous le QR code.</li>
        </ol>
        <p><strong>Attention :</strong> chaque carte est personnelle. Ne l’affichez pas au tableau et ne mélangez pas les cartes de plusieurs classes. Si une carte est perdue, ouvrez la fiche de l’élève et cliquez sur « Nouveau lien / QR ».</p>
      </Callout>
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
