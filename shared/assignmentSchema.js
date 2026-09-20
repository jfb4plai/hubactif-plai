const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (v) => typeof v === 'string' && UUID.test(v)

const isWeb = (u) => u.protocol === 'http:' || u.protocol === 'https:'

// `app` = { base_url }. Le lien profond doit rester sur le domaine de l'app choisie
// (empêche le hub de servir de redirection ouverte).
export function validateAssignmentInput(body, app) {
  const err = (error) => ({ ok: false, error })
  if (!body || typeof body !== 'object') return err('Corps invalide.')

  const title = String(body.title ?? '').trim()
  if (title.length < 1 || title.length > 120) return err('Titre : 1 à 120 caractères.')
  if (!isUuid(body.class_id)) return err('Classe invalide.')

  let link
  let base
  try {
    link = new URL(body.deep_link)
    base = new URL(app.base_url)
  } catch {
    return err('Lien de la tâche invalide.')
  }
  // Origines opaques (data:, javascript:...) : "null" === "null" tromperait la comparaison.
  if (!isWeb(link) || !isWeb(base)) return err('Lien de la tâche invalide.')
  if (link.username || link.password) return err('Lien de la tâche invalide.')
  if (link.origin !== base.origin) return err('Le lien ne correspond pas au domaine de l’app choisie.')

  const taskType = body.task_type ? String(body.task_type).trim() : null
  if (taskType && taskType.length > 40) return err('Type de tâche trop long.')

  if (body.domain_id != null && !isUuid(body.domain_id)) return err('Domaine invalide.')

  let due = null
  if (body.due_at != null) {
    const d = new Date(body.due_at)
    if (Number.isNaN(d.getTime())) return err('Échéance invalide.')
    due = d.toISOString()
  }

  let studentIds = null
  if (body.student_ids != null && body.student_ids !== 'all') {
    const ids = body.student_ids
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 200 || !ids.every(isUuid)) return err('Élèves invalides.')
    studentIds = ids
  }

  return {
    ok: true,
    value: {
      class_id: body.class_id, title, deep_link: link.toString(), task_type: taskType,
      domain_id: body.domain_id ?? null, due_at: due, student_ids: studentIds,
    },
  }
}
