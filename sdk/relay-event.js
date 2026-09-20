// À copier dans api/hub-event.js de l'app (fonction serverless Vercel).
// Variables d'environnement de l'app (Vercel) : HUB_APP_KEY (secrète, jamais dans le frontend),
// HUB_URL (facultative, défaut ci-dessous).
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' })
  const key = (process.env.HUB_APP_KEY || '').trim()
  if (!key) return res.status(503).json({ error: 'Hub non configuré.' })

  const hub = (process.env.HUB_URL || '').trim().replace(/\/+$/, '') || 'https://hubactif-plai.vercel.app'
  try {
    const upstream = await fetch(`${hub}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-key': key },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(8000),
    })
    const body = await upstream.json().catch(() => ({}))
    return res.status(upstream.status).json(body)
  } catch {
    return res.status(502).json({ error: 'Hub injoignable.' })
  }
}
