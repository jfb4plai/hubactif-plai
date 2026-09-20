import { verifyToken, TokenError } from '../../shared/token.js'
import { validateEvent } from '../../shared/eventSchema.js'

// Dépendances injectées (voir api/events.js pour le câblage réel) pour tester sans réseau ni base.
export function createEventsHandler({ findAppByKeyHash, recordEvent, rateCheck, publicKey, hash, now = () => Date.now() }) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' })

    const appKey = req.headers['x-app-key']
    if (!appKey) return res.status(401).json({ error: 'Clé d’app requise.' })
    const app = await findAppByKeyHash(hash(String(appKey)))
    if (!app || app.revoked) return res.status(401).json({ error: 'Clé d’app invalide.' })

    // Débit par app (et non par IP) : les événements arrivent des relais serveur des apps, dont l'IP est partagée par toute une classe.
    if (!(await rateCheck(`events:${app.slug}`, 1200, 60))) return res.status(429).json({ error: 'Trop de requêtes.' })

    const body = typeof req.body === 'string' ? safeParse(req.body) : req.body
    let payload
    try {
      payload = await verifyToken(body?.token, publicKey, Math.floor(now() / 1000))
    } catch (e) {
      if (e instanceof TokenError) return res.status(401).json({ error: 'Jeton invalide ou expiré.' })
      throw e
    }
    if (payload.app !== app.slug) return res.status(403).json({ error: 'Jeton émis pour une autre app.' })

    const parsed = validateEvent(body, app)
    if (!parsed.ok) {
      // Journalisé sans donnée personnelle : app et motif seulement.
      console.warn('[events] rejeté', { app: app.slug, reason: parsed.error })
      return res.status(400).json({ error: parsed.error })
    }

    const status = await recordEvent({ target: payload.tid, assignment: payload.aid, appSlug: app.slug, ...parsed.value })
    if (status === 'unknown_target') return res.status(404).json({ error: 'Assignation introuvable.' })
    return res.status(200).json({ status })
  }
}

function safeParse(text) {
  try { return JSON.parse(text) } catch { return null }
}
