import { timingSafeEqual } from 'node:crypto'

function safeEqual(a, b) {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

export function createPurgeHandler({ purge, secret }) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' })
    // Vercel Cron envoie « Authorization: Bearer <CRON_SECRET> ». Comparaison en temps constant.
    const received = String(req.headers.authorization ?? '')
    if (!secret || !safeEqual(received, `Bearer ${secret}`)) {
      return res.status(401).json({ error: 'Non autorisé.' })
    }
    const purged = await purge()
    return res.status(200).json({ purged })
  }
}
