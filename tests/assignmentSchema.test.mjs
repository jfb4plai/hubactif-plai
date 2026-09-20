import test from 'node:test'
import assert from 'node:assert/strict'
import { validateAssignmentInput, isUuid } from '../shared/assignmentSchema.js'

const app = { base_url: 'https://dictee.example.org' }
const CLASS_ID = '22222222-2222-4222-8222-222222222222'
const STUDENT = '33333333-3333-4333-8333-333333333333'
const base = { class_id: CLASS_ID, title: '  Dictée n°3  ', deep_link: 'https://dictee.example.org/dictee/3?lang=fr' }

test('isUuid', () => {
  assert.ok(isUuid(CLASS_ID))
  assert.ok(!isUuid('x'))
})

test('assignation minimale valide : classe entière, titre nettoyé', () => {
  const r = validateAssignmentInput(base, app)
  assert.equal(r.ok, true)
  assert.equal(r.value.title, 'Dictée n°3')
  assert.equal(r.value.student_ids, null)
  assert.equal(r.value.due_at, null)
})

test('élèves choisis, échéance, domaine, type', () => {
  const r = validateAssignmentInput({
    ...base, student_ids: [STUDENT], due_at: '2026-10-01T12:00:00Z', domain_id: CLASS_ID, task_type: 'dictée',
  }, app)
  assert.equal(r.ok, true)
  assert.deepEqual(r.value.student_ids, [STUDENT])
  assert.equal(r.value.due_at, '2026-10-01T12:00:00.000Z')
})

test('student_ids "all" = classe entière', () => {
  assert.equal(validateAssignmentInput({ ...base, student_ids: 'all' }, app).value.student_ids, null)
})

test('refus : lien hors domaine de l’app (open redirect)', () => {
  assert.equal(validateAssignmentInput({ ...base, deep_link: 'https://evil.example.com/x' }, app).ok, false)
})

test('refus : origines opaques (data:, javascript:) même si base_url est opaque aussi', () => {
  const opaque = { base_url: 'data:text/html,x' }
  const r1 = validateAssignmentInput({ ...base, deep_link: 'data:text/html,x' }, opaque)
  assert.equal(r1.ok, false)
  assert.equal(r1.error, 'Lien de la tâche invalide.')
  const r2 = validateAssignmentInput({ ...base, deep_link: 'javascript:alert(1)' }, app)
  assert.equal(r2.ok, false)
  assert.equal(r2.error, 'Lien de la tâche invalide.')
  const r3 = validateAssignmentInput({ ...base, deep_link: 'data:text/html,x' }, app)
  assert.equal(r3.ok, false)
})

test('refus : lien avec identifiants (userinfo)', () => {
  const r = validateAssignmentInput({ ...base, deep_link: 'https://user:pw@dictee.example.org/x' }, app)
  assert.equal(r.ok, false)
  assert.equal(r.error, 'Lien de la tâche invalide.')
  assert.equal(validateAssignmentInput({ ...base, deep_link: 'https://user@dictee.example.org/x' }, app).ok, false)
})

test('refus : titre vide ou trop long, classe invalide, élèves invalides, échéance invalide', () => {
  assert.equal(validateAssignmentInput({ ...base, title: '   ' }, app).ok, false)
  assert.equal(validateAssignmentInput({ ...base, title: 'x'.repeat(121) }, app).ok, false)
  assert.equal(validateAssignmentInput({ ...base, class_id: 'nope' }, app).ok, false)
  assert.equal(validateAssignmentInput({ ...base, student_ids: [] }, app).ok, false)
  assert.equal(validateAssignmentInput({ ...base, student_ids: ['x'] }, app).ok, false)
  assert.equal(validateAssignmentInput({ ...base, due_at: 'demain' }, app).ok, false)
  assert.equal(validateAssignmentInput({ ...base, task_type: 'x'.repeat(41) }, app).ok, false)
})
