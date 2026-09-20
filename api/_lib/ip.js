// IP du client, dans l'ordre de confiance : en-têtes posés par la plateforme, puis la DERNIÈRE entrée
// de x-forwarded-for (celle ajoutée par le proxy ; la première est fournie par le client, donc falsifiable).
export function clientIp(req) {
  const h = req?.headers ?? {}
  const single = (v) => String(Array.isArray(v) ? v[0] : (v ?? '')).trim()
  const vercel = single(h['x-vercel-forwarded-for']).split(',')[0].trim()
  if (vercel) return vercel
  const real = single(h['x-real-ip'])
  if (real) return real
  const parts = single(h['x-forwarded-for']).split(',').map((s) => s.trim()).filter(Boolean)
  if (parts.length) return parts[parts.length - 1]
  return req?.socket?.remoteAddress || 'unknown'
}
