import test from 'node:test'
import assert from 'node:assert/strict'
import { classJourney } from '../src/lib/journey.js'

const stu = (active = true) => ({ id: Math.random().toString(), active })

test('classe vide : première étape = ajouter les élèves', () => {
  const j = classJourney({ students: [], assignments: [], targets: [] })
  assert.equal(j.current, 'students')
  assert.deepEqual(j.steps.map((s) => s.done), [false, false, false, false])
})

test('des élèves retirés ne comptent pas', () => {
  assert.equal(classJourney({ students: [stu(false)], assignments: [], targets: [] }).current, 'students')
})

test('élèves ajoutés, pas de tâche : étape = assigner', () => {
  const j = classJourney({ students: [stu()], assignments: [], targets: [] })
  assert.equal(j.current, 'assign')
  assert.equal(j.steps[0].done, true)
})

test('tâche assignée mais personne ne l’a ouverte : étape = donner accès', () => {
  const j = classJourney({ students: [stu()], assignments: [{ id: 'a' }], targets: [{ status: 'assigned' }] })
  assert.equal(j.current, 'share')
})

test('au moins un élève a ouvert sa tâche : étape = suivre', () => {
  const j = classJourney({ students: [stu()], assignments: [{ id: 'a' }], targets: [{ status: 'assigned' }, { status: 'started' }] })
  assert.equal(j.current, 'follow')
  assert.equal(j.steps[2].done, true)
})
