import { signToken, TOKEN_TTL_SECONDS } from '../../shared/token.js'
import { clientIp } from './ip.js'

const page = (title, text) => `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;font-size:20px;line-height:1.6;max-width:32rem;margin:3rem auto;padding:0 1rem">
<h1 style="font-size:26px">${title}</h1><p>${text}</p></body></html>`

const INVALID = page('Ce lien ne marche plus', 'Demande un nouveau lien ou un nouveau QR code à ton enseignant.')
const BUSY = page('Un instant', 'Trop de demandes en même temps. Réessaie dans une minute.')

function html(res, status, body) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
  return res.status(status).send(body)
}

export function createGoHandler({ openLink, rateCheck, privateKey, now = () => Date.now() }) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Referrer-Policy', 'no-referrer')
    // Limite large : toute une classe peut scanner en même temps derrière la même adresse IP d'école.
    let allowed
    try {
      allowed = await rateCheck(`go:${clientIp(req)}`, 300, 60)
    } catch {
      return html(res, 503, BUSY)
    }
    if (!allowed) return html(res, 429, BUSY)

    const id = String(req.query?.id ?? '')
    if (!/^[a-f0-9]{16}$/.test(id)) return html(res, 410, INVALID)

    const row = await openLink(id)
    if (!row) return html(res, 410, INVALID)

    const token = await signToken({
      tid: row.out_target, aid: row.out_assignment, code: row.out_code, app: row.out_app_slug,
      exp: Math.floor(now() / 1000) + TOKEN_TTL_SECONDS,
    }, privateKey)
    let url
    try { url = new URL(row.out_deep_link) } catch { return html(res, 410, INVALID) }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return html(res, 410, INVALID)
    url.searchParams.set('t', token)
    return res.redirect(302, url.toString())
  }
}
