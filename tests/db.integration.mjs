import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { generateCode } from '../shared/codes.js'

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env
assert.ok(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY, 'Variables Supabase manquantes (.env.local)')

const opts = { auth: { persistSession: false } }
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, opts)
const stamp = Date.now()
const users = []
const results = []
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`) }

async function makeTeacher(label) {
  const email = `${label}-${stamp}@hubactif.test`
  const password = `Pw-${stamp}-${label}!`
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  assert.ifError(error)
  users.push(data.user.id)
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opts)
  const { error: e2 } = await client.auth.signInWithPassword({ email, password })
  assert.ifError(e2)
  return { id: data.user.id, client }
}

let appId
try {
  const A = await makeTeacher('a')
  const B = await makeTeacher('b')
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opts)

  // --- RLS classes ---
  const { data: cls, error: e1 } = await A.client.from('hub_classes')
    .insert({ teacher_id: A.id, name: 'Classe test A', class_code: generateCode(6) }).select().single()
  assert.ifError(e1)
  const { data: seenByB } = await B.client.from('hub_classes').select('*')
  check('B ne lit pas les classes de A', (seenByB ?? []).length === 0)
  await B.client.from('hub_classes').update({ name: 'piraté' }).eq('id', cls.id)
  await B.client.from('hub_classes').delete().eq('id', cls.id)
  const { data: still } = await admin.from('hub_classes').select('name').eq('id', cls.id).single()
  check('B ne modifie ni ne supprime la classe de A', still?.name === 'Classe test A')
  const { error: eForge } = await B.client.from('hub_classes')
    .insert({ teacher_id: A.id, name: 'usurpation', class_code: generateCode(6) })
  check('B ne crée pas de classe au nom de A', !!eForge)
  const { data: anonRows, error: eAnon } = await anon.from('hub_classes').select('*')
  check('anonyme ne lit aucune classe', !!eAnon || (anonRows ?? []).length === 0)

  // --- RLS élèves ---
  const studentCode = generateCode(8)
  const { data: st, error: e2 } = await A.client.from('hub_students').insert({ class_id: cls.id, code: studentCode }).select().single()
  assert.ifError(e2)
  const { error: eStB } = await B.client.from('hub_students').insert({ class_id: cls.id, code: generateCode(8) })
  check('B n’ajoute pas d’élève dans la classe de A', !!eStB)
  const { error: eDup } = await A.client.from('hub_students').insert({ class_id: cls.id, code: studentCode })
  check('code élève unique globalement', eDup?.code === '23505')

  // --- Fonctions réservées au service ---
  const { error: eRecAnon } = await anon.rpc('hub_rate_check', { p_key: 'x', p_max: 1, p_window_seconds: 60 })
  check('anonyme ne peut pas appeler hub_rate_check', !!eRecAnon)
  const { error: ePurgeB } = await B.client.rpc('hub_purge_stale')
  check('enseignant ne peut pas appeler hub_purge_stale', !!ePurgeB)
  const { error: eResetB } = await B.client.rpc('hub_reset_class', { p_class: cls.id })
  check('B ne remet pas à zéro la classe de A', !!eResetB)

  // --- Assignation, lien, événements ---
  const key = `k-${stamp}`
  const { data: app, error: eApp } = await admin.from('hub_apps').insert({
    slug: `test-${stamp}`, name: 'App test', base_url: 'https://test.example.org', key_hash: `hash-${stamp}`, indicator_labels: ['essais'],
  }).select().single()
  assert.ifError(eApp)
  appId = app.id

  const { data: rows, error: eCreate } = await admin.rpc('hub_create_assignment', {
    p_teacher: A.id, p_app: app.id, p_class: cls.id, p_title: 'Tâche test', p_deep_link: 'https://test.example.org/t/1',
    p_task_type: null, p_domain: null, p_due: null, p_student_ids: null,
  })
  assert.ifError(eCreate)
  check('assignation : 1 ligne par élève avec lien court', rows.length === 1 && /^[a-f0-9]{16}$/.test(rows[0].out_link_id))

  const { error: eNoStudents } = await admin.rpc('hub_create_assignment', {
    p_teacher: A.id, p_app: app.id, p_class: cls.id, p_title: 'x', p_deep_link: 'https://test.example.org/t/1',
    p_task_type: null, p_domain: null, p_due: null, p_student_ids: ['00000000-0000-4000-8000-000000000000'],
  })
  check('assignation sans élève ciblé refusée', !!eNoStudents && /no_students/.test(eNoStudents.message))

  const { data: seenAssignB } = await B.client.from('hub_assignments').select('*')
  check('B ne lit pas les assignations de A', (seenAssignB ?? []).length === 0)
  const { data: seenAssignA } = await A.client.from('hub_assignments').select('*')
  check('A lit ses assignations', seenAssignA.length === 1)
  const { error: eWriteAssign } = await A.client.from('hub_assignments').insert({
    teacher_id: A.id, class_id: cls.id, app_id: app.id, title: 'direct', deep_link: 'https://test.example.org/x',
  })
  check('écriture directe dans hub_assignments refusée', !!eWriteAssign)

  const linkId = rows[0].out_link_id
  const { data: opened } = await admin.rpc('hub_open_link', { p_link: linkId })
  check('ouverture du lien : renvoie code et app', opened?.length === 1 && opened[0].out_code === studentCode && opened[0].out_app_slug === app.slug)
  const targetId = opened[0].out_target
  const { data: t1 } = await admin.from('hub_targets').select('status').eq('id', targetId).single()
  check('ouverture du lien : statut « commencé »', t1.status === 'started')

  const evt = {
    p_target: targetId, p_assignment: opened[0].out_assignment, p_app_slug: app.slug,
    p_event_id: '44444444-4444-4444-8444-444444444444', p_status: 'completed', p_occurred: null,
    p_duration: 60, p_attempts: 1, p_indicators: [{ label: 'essais', value: 1 }], p_detail_url: null,
  }
  const r1 = await admin.rpc('hub_record_event', evt)
  const r2 = await admin.rpc('hub_record_event', evt)
  check('événement : enregistré puis doublon', r1.data === 'recorded' && r2.data === 'duplicate')
  const { count } = await admin.from('hub_events').select('*', { count: 'exact', head: true }).eq('target_id', targetId)
  check('événement : une seule ligne après renvoi', count === 1)
  const { data: t2 } = await admin.from('hub_targets').select('status').eq('id', targetId).single()
  check('événement terminé : statut « terminé »', t2.status === 'completed')
  const r3 = await admin.rpc('hub_record_event', { ...evt, p_event_id: '55555555-5555-4555-8555-555555555555', p_app_slug: 'autre-app' })
  check('événement d’une autre app refusé', r3.data === 'unknown_target')

  const { data: tasks } = await admin.rpc('hub_student_tasks', { p_class_code: cls.class_code, p_student_code: studentCode })
  check('espace élève : tâche et statut', tasks?.length === 1 && tasks[0].status === 'completed')
  const { data: none } = await admin.rpc('hub_student_tasks', { p_class_code: cls.class_code, p_student_code: 'INCONNU1' })
  check('espace élève : code inconnu => null', none === null)

  // --- Limitation de débit ---
  const rk = `rate-${stamp}`
  const rl = []
  for (let i = 0; i < 4; i++) rl.push((await admin.rpc('hub_rate_check', { p_key: rk, p_max: 3, p_window_seconds: 60 })).data)
  check('limitation : 3 autorisés puis refus', rl.join() === 'true,true,true,false')

  // --- Régénération et remise à zéro ---
  const { data: newLink, error: eRegen } = await A.client.rpc('hub_regenerate_link', { p_target: targetId })
  assert.ifError(eRegen)
  const { data: reopenOld } = await admin.rpc('hub_open_link', { p_link: linkId })
  check('ancien lien révoqué après régénération', (reopenOld ?? []).length === 0)
  const { data: reopenNew } = await admin.rpc('hub_open_link', { p_link: newLink })
  check('nouveau lien valide', reopenNew?.length === 1)
  const { error: eRegenB } = await B.client.rpc('hub_regenerate_link', { p_target: targetId })
  check('B ne régénère pas le lien de A', !!eRegenB)

  const { error: eReset } = await A.client.rpc('hub_reset_class', { p_class: cls.id })
  assert.ifError(eReset)
  const { count: nStudents } = await admin.from('hub_students').select('*', { count: 'exact', head: true }).eq('class_id', cls.id)
  const { count: nAssign } = await admin.from('hub_assignments').select('*', { count: 'exact', head: true }).eq('class_id', cls.id)
  const { data: clsAfter } = await admin.from('hub_classes').select('last_reset_at').eq('id', cls.id).single()
  check('remise à zéro : élèves et assignations supprimés, classe conservée', nStudents === 0 && nAssign === 0 && !!clsAfter.last_reset_at)

  // Classe créée à l'instant, avec un élève : la purge ne doit jamais la toucher.
  const { data: fresh, error: eFresh } = await A.client.from('hub_classes')
    .insert({ teacher_id: A.id, name: 'Classe test récente', class_code: generateCode(6) }).select().single()
  assert.ifError(eFresh)
  await A.client.from('hub_students').insert({ class_id: fresh.id, code: generateCode() })
  // Hors fenêtre (avant le 15 août) la purge refuse de s'exécuter : les deux issues sont normales.
  const { data: purged, error: ePurge } = await admin.rpc('hub_purge_stale')
  check('purge (service) s’exécute ou refuse hors fenêtre',
    (!ePurge && Number.isInteger(purged)) || /purge_window_closed/.test(ePurge?.message ?? ''))
  const { count: nFresh } = await admin.from('hub_students').select('*', { count: 'exact', head: true }).eq('class_id', fresh.id)
  check('purge : une classe créée à l’instant n’est pas purgée', nFresh === 1)
} finally {
  // Comptes d'abord (la cascade supprime les assignations), puis l'app de test (hub_assignments.app_id la référence).
  for (const id of users) await admin.auth.admin.deleteUser(id)
  if (appId) await admin.from('hub_apps').delete().eq('id', appId)
}

const failed = results.filter((r) => !r).length
console.log(`\n${results.length - failed}/${results.length} vérifications réussies`)
process.exit(failed ? 1 : 0)
