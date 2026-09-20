import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { must } from '../lib/db.js'
import { apiPost } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import Field from '../components/Field.jsx'
import Callout from '../components/Callout.jsx'
import { friendlyError } from '../lib/errors.js'

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
  const [ready, setReady] = useState(false)
  const errorRef = useRef(null)
  const resultRef = useRef(null)

  useEffect(() => { if (result) resultRef.current?.focus() }, [result])
  useEffect(() => { if (error) errorRef.current?.focus() }, [error])

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
      } catch (e) { setError(friendlyError(e)) } finally { setReady(true) }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setPicked(new Set())
    if (!classId) { setStudents([]); return }
    supabase.from('hub_students').select('id, code').eq('class_id', classId).eq('active', true).order('code')
      .then((r) => { try { setStudents(must(r)) } catch (e) { setError(friendlyError(e)) } })
  }, [classId])

  async function addDomain() {
    const label = newDomain.trim()
    if (!label) return
    setError('')
    if (domains.some((d) => d.label.toLowerCase() === label.toLowerCase())) return setError('Ce domaine existe déjà.')
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
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  if (!ready) return <p className="plai-empty">Chargement…</p>

  if (apps.length === 0) {
    return (
      <div className="plai-card hub-stack">
        <h1 style={{ fontFamily: "'DM Serif Display', serif" }}>Assigner une tâche</h1>
        <Callout title="Aucune app PLAI n’est encore branchée à HubActif">
          <p>Une app « branchée » affiche un bouton <strong>« Assigner via HubActif »</strong> : un clic, et la tâche est donnée à votre classe. Les premières apps sont branchées une à une.</p>
          <p>En attendant, préparez vos classes et vos codes : vous n’aurez rien à refaire.</p>
        </Callout>
        <div><Link className="plai-btn-ghost" style={{ textDecoration: 'none' }} to="/enseignant">Retour à mes classes</Link></div>
      </div>
    )
  }

  if (result) {
    return (
      <div className="plai-card hub-stack">
        <h1 ref={resultRef} tabIndex={-1} style={{ fontFamily: "'DM Serif Display', serif" }}>Tâche assignée</h1>
        <div className="plai-success" role="status" aria-live="polite">Tâche assignée à {result.links.length} élève(s).</div>
        <p>Il reste une chose à faire : <strong>faire parvenir la tâche à vos élèves</strong>. Deux possibilités, au choix :</p>
        <ol className="hub-steps">
          <li><strong>Avec du papier.</strong> Imprimez la feuille : chaque élève reçoit une carte avec son QR code personnel, qu’il scanne avec l’appareil photo d’une tablette ou d’un téléphone.</li>
          <li><strong>Sans papier.</strong> Dictez le code de classe et demandez à chaque élève de taper son code personnel sur la page d’accueil de HubActif : il y retrouve sa tâche.</li>
        </ol>
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
      <Callout title="Le plus simple : passer par l’app">
        <p>Dans l’app PLAI qui contient la tâche, cliquez sur <strong>« Assigner via HubActif »</strong> : cette page s’ouvre alors déjà remplie, il ne reste qu’à choisir la classe.</p>
        <p>Vous pouvez aussi la remplir vous-même. Il vous faut alors le lien de la tâche (voir plus bas comment le trouver).</p>
      </Callout>
      <div ref={errorRef} tabIndex={-1} className={error ? 'plai-error' : undefined} role="alert">{error}</div>
      {apps.length > 0 && !appId && params.get('app') && (
        <div className="plai-error" role="alert">L’app « {params.get('app')} » n’est pas enregistrée dans HubActif. Choisissez-en une dans la liste.</div>
      )}

      <Field id="app" label="App d’origine" help="L’app PLAI qui contient la tâche. Le lien de la tâche doit venir de cette app : HubActif refuse les autres adresses, par sécurité.">
        <select id="app" className="plai-input" required aria-describedby="app-help" value={appId} onChange={(e) => setAppId(e.target.value)}>
          <option value="">Choisir…</option>
          {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>
      <Field id="title" label="Titre de la tâche" help="Ce que l’élève lira sur sa carte de tâche. Court et concret : il doit reconnaître de quoi il s’agit.">
        <input id="title" className="plai-input" required maxLength={120} aria-describedby="title-help"
          placeholder="Ex. Dictée n°3 : les accords du participe passé" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field id="link" label="Lien de la tâche" help="Comment la trouver : dans l’app, ouvrez la tâche que vous voulez donner, puis copiez l’adresse qui s’affiche tout en haut de la fenêtre du navigateur (touches Ctrl et C) et collez-la ici (Ctrl et V). Elle commence par https://. Elle est déjà remplie si vous arrivez depuis l’app.">
        <input id="link" type="url" className="plai-input" required aria-describedby="link-help"
          placeholder="https://…/dictee/3" value={link} onChange={(e) => setLink(e.target.value)} />
      </Field>
      <Field id="type" label="Type de tâche (facultatif)" help="Facultatif. Un mot pour vous y retrouver (dictée, exercice, révision…). L’élève ne le voit pas.">
        <input id="type" className="plai-input" maxLength={40} aria-describedby="type-help" placeholder="Ex. dictée"
          value={taskType} onChange={(e) => setTaskType(e.target.value)} />
      </Field>
      <Field id="class" label="Classe" help="Les élèves de cette classe pourront ouvrir la tâche avec leur code habituel : vous n’avez rien à leur redonner.">
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

      <Field id="due" label="Pour le (facultatif)" help="Après cette date, la tâche apparaît « en retard » dans votre grille. Les liens restent valables 30 jours de plus. Sans date, le lien reste valable jusqu’à la remise à zéro annuelle.">
        <input id="due" type="date" className="plai-input" style={{ maxWidth: 220 }} aria-describedby="due-help" value={due} onChange={(e) => setDue(e.target.value)} />
      </Field>
      <Field id="domain" label="Domaine (facultatif)" help="Facultatif. Le thème de la tâche (orthographe, vocabulaire…). Dans la fiche d’un élève, vous verrez ensemble tout ce qu’il a fait sur un même thème, même dans des apps différentes.">
        <select id="domain" className="plai-input" aria-describedby="domain-help" value={domainId} onChange={(e) => setDomainId(e.target.value)}>
          <option value="">Sans domaine</option>
          {domains.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
      </Field>
      <Field id="new-domain" label="Ajouter un domaine à la liste" help="Facultatif. Si votre thème n’est pas dans la liste (ex. Conjugaison), ajoutez-le ici : il sera proposé la prochaine fois. Il n’est visible que par vous.">
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
