import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { must } from '../lib/db.js'
import { useAuth } from '../context/AuthContext.jsx'
import Field from '../components/Field.jsx'
import NoScoreBanner from '../components/NoScoreBanner.jsx'
import { groupByDomain, isLate, formatDate, formatDuration, STATUS_ICON, STATUS_LABEL } from '../lib/matrix.js'
import { friendlyError } from '../lib/errors.js'

export default function StudentFilePage() {
  const { classId, studentId } = useParams()
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const [newLink, setNewLink] = useState('')
  const [busy, setBusy] = useState(false)

  // Cibles et événements : rechargés après une régénération, sans toucher à la note en cours de saisie.
  const loadTargets = useCallback(async () => {
    const student = must(await supabase.from('hub_students').select('*').eq('id', studentId).single())
    const targets = must(await supabase.from('hub_targets')
      .select('*, hub_assignments(id, title, due_at, app_id, hub_domains(label)), hub_events(*)')
      .eq('student_id', studentId))
    const apps = must(await supabase.from('hub_apps_public').select('*'))
    setData({ student, targets, apps })
  }, [studentId])

  // Première charge uniquement : la note n'est lue qu'ici.
  useEffect(() => {
    (async () => {
      try {
        await loadTargets()
        const noteRow = (await supabase.from('hub_notes').select('body').eq('student_id', studentId).maybeSingle()).data
        setNote(noteRow?.body ?? '')
      } catch (e) { setError(friendlyError(e)) }
    })()
  }, [loadTargets, studentId])

  async function saveNote() {
    setSaved(''); setError(''); setBusy(true)
    try {
      const { error } = await supabase.from('hub_notes').upsert(
        { teacher_id: user.id, student_id: studentId, body: note, updated_at: new Date().toISOString() },
        { onConflict: 'teacher_id,student_id' }
      )
      if (error) setError('Enregistrement impossible.')
      else setSaved('Note enregistrée.')
    } catch (e) { setError(friendlyError(e)) } finally { setBusy(false) }
  }

  async function regenerate(targetId) {
    if (!window.confirm('Créer un nouveau lien pour cette tâche ? L’ancien lien et son QR code cesseront de fonctionner.')) return
    const { data: id, error } = await supabase.rpc('hub_regenerate_link', { p_target: targetId })
    if (error) return setError('Régénération impossible.')
    setNewLink(`${window.location.origin}/a/${id}`)
    try { await loadTargets() } catch (e) { setError(friendlyError(e)) }
  }

  if (error && !data) return <div className="plai-error" role="alert">{error}</div>
  if (!data) return <p className="plai-empty">Chargement…</p>
  const { student, targets, apps } = data
  const appName = (id) => apps.find((a) => a.id === id)?.name ?? 'App'
  const now = new Date()

  return (
    <div className="hub-stack">
      <p><Link to={`/enseignant/classes/${classId}`}>← Retour à la classe</Link></p>
      <h1 style={{ fontFamily: "'DM Serif Display', serif" }}>Élève <span className="hub-code">{student.code}</span></h1>
      <p className="hub-help">Cette page rassemble tout ce que les apps ont signalé pour cet élève, tel quel et sans interprétation. Les tâches sont rangées par domaine (le thème que vous avez choisi en les donnant).</p>
      <NoScoreBanner />
      <div className={error ? 'plai-error' : undefined} role="alert">{error}</div>
      <div className={newLink ? 'plai-success' : undefined} role="status" aria-live="polite">{newLink && <>Nouveau lien : <span className="hub-code">{newLink}</span></>}</div>

      {targets.length === 0 && <p className="plai-empty">Aucune tâche assignée à cet élève.</p>}
      {groupByDomain(targets).map((group) => (
        <section key={group.domain} className="hub-stack">
          <h2>{group.domain}</h2>
          {group.targets.map((t) => {
            const a = t.hub_assignments
            const events = [...(t.hub_events ?? [])].sort((x, y) => x.occurred_at.localeCompare(y.occurred_at))
            return (
              <div className="plai-card hub-stack" key={t.id}>
                <div>
                  <strong>{a.title}</strong> · {appName(a.app_id)}{a.due_at ? ` · pour le ${formatDate(a.due_at)}` : ''}
                </div>
                <span className="hub-status">
                  <span aria-hidden="true">{STATUS_ICON[t.status]}</span>{STATUS_LABEL[t.status]}
                  {isLate(now, a.due_at, t.status) && ' · en retard'}
                </span>
                {events.length === 0 ? <p className="hub-help">Rien reçu de l’app pour l’instant : l’élève n’a peut-être pas encore commencé, ou l’app ne renvoie pas encore d’informations.</p> : (
                  <ul>
                    {events.map((ev) => (
                      <li key={ev.event_id}>
                        {formatDate(ev.occurred_at)} · {ev.status === 'completed' ? 'terminé' : 'commencé'}
                        {ev.duration_s != null && ` · ${formatDuration(ev.duration_s)}`}
                        {ev.attempts != null && ` · ${ev.attempts} essai(s)`}
                        {(ev.indicators ?? []).map((ind) => ` · ${ind.label} : ${ind.value}`)}
                        {ev.detail_url && <> · <a href={ev.detail_url} target="_blank" rel="noreferrer">Voir dans l’app</a></>}
                      </li>
                    ))}
                  </ul>
                )}
                <div>
                  <button className="plai-btn-ghost" onClick={() => regenerate(t.id)}>Nouveau lien / QR</button>
                  <p className="hub-help">À utiliser si l’élève a perdu sa carte ou si son lien a été partagé : l’ancien lien et l’ancien QR code s’arrêtent de fonctionner. Réimprimez ensuite la feuille de la tâche.</p>
                </div>
              </div>
            )
          })}
        </section>
      ))}

      <section className="plai-card hub-stack">
        <h2>Vos notes</h2>
        <Field id="note" label="Notes sur cet élève"
          help="Visibles par vous seul. HubActif n’en tire aucune conclusion : votre lecture compte. N’écrivez pas le nom de l’élève.">
          <textarea id="note" rows={5} maxLength={2000} className="plai-input" aria-describedby="note-help"
            placeholder="Ex. A besoin que les consignes soient lues à voix haute ; réussit mieux le matin."
            value={note} onChange={(e) => { setNote(e.target.value); setSaved('') }} />
        </Field>
        <div className="hub-row">
          <button className="plai-btn" onClick={saveNote} disabled={busy}>Enregistrer la note</button>
          <span role="status" aria-live="polite">{saved}</span>
        </div>
      </section>
    </div>
  )
}
