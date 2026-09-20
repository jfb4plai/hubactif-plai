import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { must } from '../lib/db.js'
import ResetBanner from '../components/ResetBanner.jsx'
import StudentsPanel from '../components/StudentsPanel.jsx'
import ClassGrid from '../components/ClassGrid.jsx'
import NoScoreBanner from '../components/NoScoreBanner.jsx'
import QrImage from '../components/QrImage.jsx'
import NextStep from '../components/NextStep.jsx'
import Callout from '../components/Callout.jsx'
import { friendlyError } from '../lib/errors.js'

export default function ClassPage() {
  const { classId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const cls = must(await supabase.from('hub_classes').select('*').eq('id', classId).single())
      const students = must(await supabase.from('hub_students').select('*').eq('class_id', classId).order('code'))
      const assignments = must(await supabase.from('hub_assignments').select('*').eq('class_id', classId).order('created_at', { ascending: false }))
      const domains = must(await supabase.from('hub_domains').select('*').order('label'))
      const apps = must(await supabase.from('hub_apps_public').select('*'))
      const ids = assignments.map((a) => a.id)
      const targets = ids.length ? must(await supabase.from('hub_targets').select('*').in('assignment_id', ids)) : []
      setData({ cls, students, assignments, domains, apps, targets })
    } catch (e) {
      setError(friendlyError(e))
    }
  }, [classId])

  useEffect(() => { load() }, [load])

  async function deleteClass() {
    if (!window.confirm(`Supprimer la classe « ${data.cls.name} » ? Élèves, assignations et suivis seront supprimés définitivement.`)) return
    const { error } = await supabase.from('hub_classes').delete().eq('id', classId)
    if (error) setError('Suppression impossible.')
    else navigate('/enseignant')
  }

  if (error) return <div className="plai-error" role="alert">{error}</div>
  if (!data) return <p className="plai-empty">Chargement…</p>
  const { cls, students, assignments, domains, apps, targets } = data

  return (
    <div className="hub-stack">
      <p><Link to="/enseignant">← Mes classes</Link></p>
      <h1 style={{ fontFamily: "'DM Serif Display', serif" }}>{cls.name}</h1>
      <NextStep classId={classId} students={students} assignments={assignments} targets={targets} hasApps={apps.length > 0} />
      <ResetBanner cls={cls} onDone={load} />
      <div className="plai-card hub-stack">
        <h2 style={{ fontSize: 20 }}>Ce que vous dites à vos élèves</h2>
        <ol className="hub-steps">
          <li>Ouvrez l’adresse <strong>{window.location.host}</strong> (sur une tablette, un ordinateur ou un téléphone).</li>
          <li>Tapez le code de classe : <span className="hub-code">{cls.class_code}</span></li>
          <li>Tapez votre code personnel, celui de votre carte ou de votre feuille.</li>
        </ol>
        <details>
          <summary>Projeter ou imprimer le QR code de la classe</summary>
          <QrImage text={`${window.location.origin}/?c=${cls.class_code}`} size={180} alt="QR code d’accès de la classe" />
          <p className="hub-help">Un QR code est un carré que l’on scanne avec l’appareil photo. Celui-ci ouvre HubActif avec le code de classe déjà rempli : l’élève tape seulement son code personnel.</p>
        </details>
      </div>
      <StudentsPanel classId={classId} cls={cls} students={students} onChange={load} />
      <section className="hub-stack" id="taches">
        <h2>Tâches et suivi</h2>
        {apps.length > 0 ? (
          <div className="hub-row">
            <Link className="plai-btn" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
              to={`/enseignant/assigner?class=${classId}`}>Assigner une tâche</Link>
            <span className="hub-help">Astuce : depuis l’app PLAI, le bouton « Assigner via le hub » remplit ce formulaire à votre place.</span>
          </div>
        ) : (
          <Callout title="Aucune app PLAI n’est encore branchée à HubActif">
            <p>Une app « branchée » affiche un bouton <strong>« Assigner via le hub »</strong> : un clic, et la tâche est donnée à votre classe. Les premières apps sont branchées une à une.</p>
            <p>En attendant, votre classe et vos codes sont prêts : vous n’aurez rien à refaire.</p>
          </Callout>
        )}
        <NoScoreBanner />
        <ClassGrid classId={classId} students={students.filter((s) => s.active)} assignments={assignments} targets={targets} domains={domains} apps={apps} />
      </section>
      <div><button className="plai-btn-ghost" onClick={deleteClass}>Supprimer cette classe</button></div>
    </div>
  )
}
