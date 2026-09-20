import { normalizeCode } from '../../shared/codes.js'
import { clientIp } from './ip.js'

const NOT_FOUND = { error: 'Codes non reconnus.' }

export function createStudentHandler({ studentTasks, rateCheck }) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' })

    // 300 essais / 5 min / IP : une classe entière derrière l'IP de l'école passe, une attaque par
    // dictionnaire sur 31^8 codes non.
    if (!(await rateCheck(`student:${clientIp(req)}`, 300, 300))) {
      return res.status(429).json({ error: 'Trop d’essais. Réessaie dans quelques minutes.' })
    }

    const body = typeof req.body === 'string' ? safeParse(req.body) : req.body
    const classCode = normalizeCode(body?.class_code)
    const studentCode = normalizeCode(body?.student_code)
    if (!classCode || !studentCode) return res.status(400).json({ error: 'Renseigne les deux codes.' })
    if (classCode.length > 12 || studentCode.length > 32) return res.status(404).json(NOT_FOUND)

    const tasks = await studentTasks(classCode, studentCode)
    if (tasks === null) return res.status(404).json(NOT_FOUND)
    return res.status(200).json({ tasks })
  }
}

function safeParse(text) {
  try { return JSON.parse(text) } catch { return null }
}
