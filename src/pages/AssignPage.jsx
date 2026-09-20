import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { must } from '../lib/db.js'
import { apiPost } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import Field from '../components/Field.jsx'

export default function AssignPage() {
  const { user } = useAuth()
  const [params] = useSearchParams()
  const [apps, setApps] = useState([])
  const [classes, setClasses] = useState([])
  const [domains, setDomains] = useState([])
  const [students, setStudents] = useState([])
  const [appId, setAppId] = useState('')
  const [classId, setClassId] = useState(params.get('class') ?? '')
  const [title, setTitle] = useState(params.get('title') ?? '')
  const [link, setLink] = useState(params.get('link') ?? '')
  const [taskType, setTaskType] = useState(params.get('type') ?? '')
  const [domainId, setDomainId] = useState('')
  const [due, setDue] = useState('')
  const [mode, setMode] = useState('all')
  const [picked, setPicked] = useState(new Set())
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [newDomain, setNewDomain] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const a = must(await supabase.from('hub_apps_public').select('*'))
        const c = must(await supabase.from('hub_classes').select('id, name').order('name'))
        const d = must(await supabase.from('hub_domains').select('*').order('label'))
        setApps(a); setClasses(c); setDomains(d)
        const bySlug = a.find((x) => x.slug === params.get('app'))
        if (bySlug) setAppId(bySlug.id)
        const suggested = (params.get('domain') ?? '').toLowerCase()
        const byLabel = d.find((x) => x.label.toLowerCase() === suggested)
        if (byLabel) setDomainId(byLabel.id)
        if (!classId && c.length === 1) setClassId(c[0].id)
      } catch (e) { setError(e.message) }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setPicked(new Set())
    if (!classId) { setStudents([]); return }
    supabase.from('hub_students').select('id, code').eq('class_id', classId).eq('active', true).order('code')
      .then((r) => { try { setStudents(must(r)) } catch (e) { setError(e.message) } })
  }, [classId])

  async function addDomain() {
    const label = newDomain.trim()
    if (!label) return
    const { data, error } = await supabase.from('hub_domains').insert({ teacher_id: user.id, label }).select().single()
    if (error) return setError(error.code === '23505' ? 'Ce domaine existe déjà.' : 'Ajout impossible.')
    setDomains((d) => [...d, data].sort((a, b) => a.label.localeCompare(b.label, 'fr')))
    setDomainId(data.id)
    setNewDomain('')
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (mode === 'picked' && picked.size === 0) return setError('Cochez au moins un élève.')
    setBusy(true)
    try {
      const res = await apiPost('/api/assignments', {
        app_id: appId, class_id: classId, title, deep_link: link,
        task_type: taskType || null, domain_id: domainId || null,
        due_at: due ? new Date(`${due}T23:59:00`).toISOString() : null,
        student_ids: mode === 'all' ? 'all' : [...picked],
      })
      setResult(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    return (
      <div className="plai-card hub-stack">
        <div className="plai-success" role="status">Tâche assignée à {result.links.length} élève(s).</div>
        <p>Chaque élève a maintenant un lien court et un QR code. Imprimez la feuille ou laissez-les retrouver leur tâche sur HubActif avec leurs codes.</p>
        <div className="hub-row">
          <Link className="plai-btn" style={{ textDecoration: 'none' }} to={`/enseignant/assignations/${result.assignment_id}/feuille`}>Feuille à imprimer</Link>
          <Link className="plai-btn-ghost" style={{ textDecoration: 'none' }} to={`/enseignant/classes/${classId}`}>Retour à la classe</Link>
        </div>
      </div>
    )
  }

  return (
    <form className="plai-card hub-stack" onSubmit={submit}>
      <h1 style={{ fontFamily: "'DM Serif Display', serif" }}>Assigner une tâche</h1>
      {error && <div className="plai-error" role="alert">{error}</div>}
      {apps.length > 0 && !appId && params.get('app') && (
        <div className="plai-error" role="alert">L’app « {params.get('app')} » n’est pas enregistrée dans HubActif. Choisissez-en une dans la liste.</div>
      )}

      <Field id="app" label="App d’origine" help="L’app qui héberge la tâche. Le lien doit pointer vers cette app : HubActif refuse les autres adresses.">
        <select id="app" className="plai-input" required aria-describedby="app-help" value={appId} onChange={(e) => setAppId(e.target.value)}>
          <option value="">Choisir…</option>
          {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>
      <Field id="title" label="Titre de la tâche" help="Ce que l’élève lira sur sa carte de tâche. Court et concret.">
        <input id="title" className="plai-input" required maxLength={120} aria-describedby="title-help"
          placeholder="Ex. Dictée n°3 : les accords du participe passé" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field id="link" label="Lien de la tâche" help="Adresse de la tâche dans l’app. Elle est préremplie quand vous arrivez depuis l’app.">
        <input id="link" type="url" className="plai-input" required aria-describedby="link-help"
          placeholder="https://…/dictee/3" value={link} onChange={(e) => setLink(e.target.value)} />
      </Field>
      <Field id="type" label="Type de tâche (facultatif)" help="Simple repère pour vous (dictée, exercice, révision…).">
        <input id="type" className="plai-input" maxLength={40} aria-describedby="type-help" placeholder="Ex. dictée"
          value={taskType} onChange={(e) => setTaskType(e.target.value)} />
      </Field>
      <Field id="class" label="Classe" help="Les élèves de cette classe reçoivent la tâche. Ils gardent leurs codes.">
        <select id="class" className="plai-input" required aria-describedby="class-help" value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="">Choisir…</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>

      <fieldset className="plai-field">
        <legend className="plai-label">Pour qui ?</legend>
        <label className="hub-row"><input type="radio" name="mode" checked={mode === 'all'} onChange={() => setMode('all')} /> Toute la classe ({students.length} élève(s))</label>
        <label className="hub-row"><input type="radio" name="mode" checked={mode === 'picked'} onChange={() => setMode('picked')} /> Certains élèves seulement</label>
        <p className="hub-help">Choisir quelques élèves permet de différencier : chacun reçoit la tâche qui lui convient.</p>
        {mode === 'picked' && students.map((s) => (
          <label className="hub-row" key={s.id}>
            <input type="checkbox" checked={picked.has(s.id)}
              onChange={(e) => setPicked((p) => { const n = new Set(p); e.target.checked ? n.add(s.id) : n.delete(s.id); return n })} />
            <span className="hub-code">{s.code}</span>
          </label>
        ))}
      </fieldset>

      <Field id="due" label="Pour le (facultatif)" help="Après cette date, la tâche apparaît « en retard » dans votre grille. Les liens restent valables 30 jours de plus.">
        <input id="due" type="date" className="plai-input" style={{ maxWidth: 220 }} aria-describedby="due-help" value={due} onChange={(e) => setDue(e.target.value)} />
      </Field>
      <Field id="domain" label="Domaine (facultatif)" help="Étiquette qui regroupe cette tâche avec celles des autres apps dans la fiche de l’élève. C’est votre intention pédagogique.">
        <select id="domain" className="plai-input" aria-describedby="domain-help" value={domainId} onChange={(e) => setDomainId(e.target.value)}>
          <option value="">Sans domaine</option>
          {domains.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
      </Field>
      <Field id="new-domain" label="Ajouter un domaine à la liste" help="Pour un objectif absent de la liste (ex. Conjugaison). Il reste à vous seul et sera proposé la prochaine fois.">
        <div className="hub-row">
          <input id="new-domain" className="plai-input" style={{ maxWidth: 320 }} maxLength={60} aria-describedby="new-domain-help"
            placeholder="Ex. Conjugaison" value={newDomain} onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDomain() } }} />
          <button type="button" className="plai-btn-ghost" onClick={addDomain} disabled={!newDomain.trim()}>Ajouter</button>
        </div>
      </Field>

      <button className="plai-btn" disabled={busy || !appId || !classId}>Assigner</button>
    </form>
  )
}
