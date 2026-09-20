import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { must } from '../lib/db.js'
import ResetBanner from '../components/ResetBanner.jsx'
import StudentsPanel from '../components/StudentsPanel.jsx'
import ClassGrid from '../components/ClassGrid.jsx'
import NoScoreBanner from '../components/NoScoreBanner.jsx'
import QrImage from '../components/QrImage.jsx'
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
      <div className="plai-card">
        <p>Code de classe à donner à vos élèves : <span className="hub-code">{cls.class_code}</span></p>
        <p className="hub-help">Sur la page d’accueil de HubActif, chaque élève saisit ce code et son code personnel pour retrouver ses tâches.</p>
        <details>
          <summary>QR code de la classe</summary>
          <QrImage text={`${window.location.origin}/?c=${cls.class_code}`} size={180} alt="QR code d’accès de la classe" />
          <p className="hub-help">Les élèves le scannent : le code de classe est déjà rempli, ils tapent seulement leur code personnel.</p>
        </details>
      </div>
      <ResetBanner cls={cls} onDone={load} />
      <StudentsPanel classId={classId} students={students} onChange={load} />
      <section className="hub-stack">
        <h2>Tâches et suivi</h2>
        <div className="hub-row">
          <Link className="plai-btn" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
            to={`/enseignant/assigner?class=${classId}`}>Assigner une tâche</Link>
        </div>
        <NoScoreBanner />
        <ClassGrid classId={classId} students={students} assignments={assignments} targets={targets} domains={domains} apps={apps} />
      </section>
      <div><button className="plai-btn-ghost" onClick={deleteClass}>Supprimer cette classe</button></div>
    </div>
  )
}
