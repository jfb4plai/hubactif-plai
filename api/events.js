import { createEventsHandler } from './_lib/eventsHandler.js'
import { admin } from './_lib/admin.js'
import { rateCheck } from './_lib/rate.js'
import { sha256Hex } from '../shared/hash.js'

export default createEventsHandler({
  findAppByKeyHash: async (keyHash) => {
    const { data, error } = await admin().from('hub_apps')
      .select('slug, base_url, indicator_labels, revoked').eq('key_hash', keyHash).maybeSingle()
    if (error) throw error
    return data
  },
  recordEvent: async (e) => {
    const { data, error } = await admin().rpc('hub_record_event', {
      p_target: e.target, p_assignment: e.assignment, p_app_slug: e.appSlug,
      p_event_id: e.event_id, p_status: e.status, p_occurred: e.occurred_at,
      p_duration: e.duration_s, p_attempts: e.attempts,
      p_indicators: e.indicators, p_detail_url: e.detail_url,
    })
    if (error) throw error
    return data
  },
  rateCheck,
  publicKey: process.env.HUB_SIGNING_PUBLIC_KEY,
  hash: sha256Hex,
})
