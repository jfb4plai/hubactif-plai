import { admin } from './admin.js'

export function clientIp(req) {
  const fwd = String(req.headers?.['x-forwarded-for'] ?? '').split(',')[0].trim()
  return fwd || req.socket?.remoteAddress || 'unknown'
}

// true = autorisé. Échec de la RPC => exception (on ne laisse pas passer sans contrôle).
export async function rateCheck(key, max, windowSeconds) {
  const { data, error } = await admin().rpc('hub_rate_check', {
    p_key: key, p_max: max, p_window_seconds: windowSeconds,
  })
  if (error) throw error
  return data === true
}
