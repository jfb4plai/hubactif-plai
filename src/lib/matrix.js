export const STATUS_LABEL = { assigned: 'Assigné', started: 'Commencé', completed: 'Terminé' }
// L'icône accompagne toujours le texte : le statut ne repose jamais sur la couleur seule.
export const STATUS_ICON = { assigned: '○', started: '◐', completed: '●' }

export const formatDate = (iso) => new Date(iso).toLocaleDateString('fr-BE')

// « En retard » est calculé, jamais stocké.
export function isLate(now, dueAt, status) {
  return Boolean(dueAt) && status !== 'completed' && new Date(dueAt).getTime() < now.getTime()
}

export function filterAssignmentsByDomain(assignments, domainId) {
  return domainId ? assignments.filter((a) => a.domain_id === domainId) : assignments
}

// Grille classe × tâches. cells[i] = cible de l'élève pour la tâche i, ou null si non assignée.
export function buildMatrix({ students, assignments, targets }) {
  const byKey = new Map(targets.map((t) => [`${t.student_id}:${t.assignment_id}`, t]))
  return {
    columns: assignments,
    rows: students.map((student) => ({
      student,
      cells: assignments.map((a) => byKey.get(`${student.id}:${a.id}`) ?? null),
    })),
  }
}

// Fiche élève : cibles (avec hub_assignments.hub_domains imbriqués) regroupées par domaine.
export function groupByDomain(targets) {
  const NONE = 'Sans domaine'
  const groups = new Map()
  for (const t of targets) {
    const label = t.hub_assignments?.hub_domains?.label ?? NONE
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label).push(t)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === NONE) - (b === NONE) || a.localeCompare(b, 'fr'))
    .map(([domain, items]) => ({ domain, targets: items }))
}

export const formatDuration = (s) => (s < 60 ? `${s} s` : `${Math.round(s / 60)} min`)
