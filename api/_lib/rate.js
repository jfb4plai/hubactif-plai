import { admin } from './admin.js'

// true = autorisé. Échec de la RPC => exception (on ne laisse pas passer sans contrôle).
export async function rateCheck(key, max, windowSeconds) {
  const { data, error } = await admin().rpc('hub_rate_check', {
    p_key: key, p_max: max, p_window_seconds: windowSeconds,
  })
  if (error) throw error
  return data === true
}
