// Parcours d'une classe pour guider l'enseignant : quelle est la prochaine étape ?
// L'étape « follow » (suivre) est continue : elle n'est jamais « terminée ».
export const JOURNEY_KEYS = ['students', 'assign', 'share', 'follow']

export function classJourney({ students, assignments, targets }) {
  const opened = targets.some((t) => t.status !== 'assigned')
  const done = {
    students: students.some((s) => s.active),
    assign: assignments.length > 0,
    share: opened,
    follow: false,
  }
  const steps = JOURNEY_KEYS.map((key) => ({ key, done: done[key] }))
  const current = steps.find((s) => !s.done)?.key ?? 'follow'
  return { steps, current }
}
