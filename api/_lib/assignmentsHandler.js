import { validateAssignmentInput, isUuid } from '../../shared/assignmentSchema.js'
import { clientIp } from './ip.js'

const KNOWN_ERRORS = {
  class_not_owned: [403, 'Classe introuvable.'],
  no_students: [400, 'Aucun élève actif dans la classe. Ajoutez d’abord des codes élèves.'],
  domain_not_allowed: [400, 'Domaine invalide.'],
}

export function createAssignmentsHandler({ requireUser, findApp, createAssignment, rateCheck }) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' })

    if (!(await rateCheck(`assign:ip:${clientIp(req)}`, 120, 60))) return res.status(429).json({ error: 'Trop de requêtes.' })

    const user = await requireUser(req, res)
    if (!user) return
    if (!(await rateCheck(`assign:${user.id}`, 60, 60))) return res.status(429).json({ error: 'Trop de requêtes.' })

    const body = typeof req.body === 'string' ? safeParse(req.body) : req.body
    if (!isUuid(body?.app_id)) return res.status(400).json({ error: 'App invalide.' })
    const app = await findApp(body.app_id)
    if (!app || app.revoked) return res.status(400).json({ error: 'App inconnue.' })

    const parsed = validateAssignmentInput(body, app)
    if (!parsed.ok) return res.status(400).json({ error: parsed.error })

    try {
      const rows = await createAssignment({ ...parsed.value, teacher: user.id, app: body.app_id })
      if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: KNOWN_ERRORS.no_students[1] })
      return res.status(200).json({
        assignment_id: rows[0].out_assignment_id,
        links: rows.map((r) => ({ student_code: r.out_student_code, link_id: r.out_link_id })),
      })
    } catch (e) {
      const known = Object.entries(KNOWN_ERRORS).find(([code]) => String(e?.message).includes(code))
      if (known) return res.status(known[1][0]).json({ error: known[1][1] })
      throw e
    }
  }
}

function safeParse(text) {
  try { return JSON.parse(text) } catch { return null }
}
