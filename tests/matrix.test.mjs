import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMatrix, filterAssignmentsByDomain, groupByDomain, isLate, STATUS_LABEL, STATUS_ICON, formatDate } from '../src/lib/matrix.js'

const students = [{ id: 's1', code: 'AAAA2222' }, { id: 's2', code: 'BBBB3333' }]
const assignments = [{ id: 'a1', domain_id: 'd1' }, { id: 'a2', domain_id: 'd2' }]
const targets = [
  { student_id: 's1', assignment_id: 'a1', status: 'completed' },
  { student_id: 's2', assignment_id: 'a2', status: 'started' },
]

test('buildMatrix : une cellule par élève et par tâche, null si non assigné', () => {
  const { columns, rows } = buildMatrix({ students, assignments, targets })
  assert.equal(columns.length, 2)
  assert.equal(rows[0].cells[0].status, 'completed')
  assert.equal(rows[0].cells[1], null)
  assert.equal(rows[1].cells[0], null)
  assert.equal(rows[1].cells[1].status, 'started')
})

test('filterAssignmentsByDomain', () => {
  assert.equal(filterAssignmentsByDomain(assignments, '').length, 2)
  assert.deepEqual(filterAssignmentsByDomain(assignments, 'd2').map((a) => a.id), ['a2'])
})

test('isLate : échéance passée et pas terminé', () => {
  const now = new Date('2026-10-10T12:00:00Z')
  assert.equal(isLate(now, '2026-10-01T00:00:00Z', 'started'), true)
  assert.equal(isLate(now, '2026-10-01T00:00:00Z', 'completed'), false)
  assert.equal(isLate(now, '2026-11-01T00:00:00Z', 'assigned'), false)
  assert.equal(isLate(now, null, 'assigned'), false)
})

test('groupByDomain : regroupe, « Sans domaine » en dernier', () => {
  const t = (label) => ({ hub_assignments: { hub_domains: label ? { label } : null } })
  const groups = groupByDomain([t('Vocabulaire'), t(null), t('Orthographe'), t('Vocabulaire')])
  assert.deepEqual(groups.map((g) => [g.domain, g.targets.length]), [['Orthographe', 1], ['Vocabulaire', 2], ['Sans domaine', 1]])
})

test('libellés et icônes de statut couvrent les trois états', () => {
  for (const s of ['assigned', 'started', 'completed']) {
    assert.ok(STATUS_LABEL[s]); assert.ok(STATUS_ICON[s])
  }
})

test('formatDate en français de Belgique', () => {
  assert.match(formatDate('2026-10-01T12:00:00Z'), /^01\/10\/2026$/)
})
