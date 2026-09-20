// À copier dans api/hub-event.js de l'app (fonction serverless Vercel).
// Variables d'environnement de l'app (Vercel) : HUB_APP_KEY (secrète, jamais dans le frontend),
// HUB_URL (facultative, défaut ci-dessous).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' })
  if (!process.env.HUB_APP_KEY) return res.status(503).json({ error: 'Hub non configuré.' })

  const hub = process.env.HUB_URL || 'https://hubactif-plai.vercel.app'
  const upstream = await fetch(`${hub}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-app-key': process.env.HUB_APP_KEY },
    body: JSON.stringify(req.body),
  })
  const body = await upstream.json().catch(() => ({}))
  return res.status(upstream.status).json(body)
}
