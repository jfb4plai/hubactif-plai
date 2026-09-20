export const STATUSES = Object.freeze(['started', 'completed'])
const MAX_INDICATORS = 10
const MAX_URL_LENGTH = 200
const MAX_ABS_VALUE = 1e9
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CONTROL_CHARS = /[\u0000-\u001f\u007f\u0080-\u009f\u2028\u2029]/
const isWebProtocol = (p) => p === 'https:' || p === 'http:'

// Schéma strict : aucun texte libre produit par l'élève ne doit entrer dans le hub.
// `app` = { base_url, indicator_labels } (ligne hub_apps).
export function validateEvent(body, app) {
  const err = (error) => ({ ok: false, error })
  if (!app || typeof app !== 'object') return err('App invalide.')
  if (!body || typeof body !== 'object') return err('Corps invalide.')
  const { event_id, status, occurred_at, duration_s, attempts, indicators = [], detail_url } = body

  if (typeof event_id !== 'string' || !UUID.test(event_id)) return err('event_id invalide.')
  if (!STATUSES.includes(status)) return err('status invalide.')

  let occurredAt = null
  if (occurred_at != null) {
    if (typeof occurred_at !== 'string') return err('occurred_at invalide.')
    const d = new Date(occurred_at)
    const year = d.getUTCFullYear()
    // Horloge d'appareil fausse (tablette d'école réinitialisée) : l'événement reste valable, on ignore la date
    // et le hub retombe sur son heure (hub_record_event : coalesce(p_occurred, now())).
    if (!Number.isNaN(d.getTime()) && year >= 2020 && year <= 2100) occurredAt = d.toISOString()
  }

  for (const [name, value, max] of [['duration_s', duration_s, 86400], ['attempts', attempts, 1000]]) {
    if (value != null && (!Number.isInteger(value) || value < 0 || value > max)) return err(`${name} invalide.`)
  }

  if (!Array.isArray(indicators) || indicators.length > MAX_INDICATORS) return err('indicators invalide.')
  const allowed = Array.isArray(app.indicator_labels) ? app.indicator_labels : []
  const clean = []
  const seen = new Set()
  for (const ind of indicators) {
    if (!ind || typeof ind.label !== 'string' || ind.label.length > 40 || !allowed.includes(ind.label)) {
      return err('Libellé d’indicateur non déclaré.')
    }
    if (seen.has(ind.label)) return err('Libellé d’indicateur en double.')
    seen.add(ind.label)
    const v = ind.value
    const ok = (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= MAX_ABS_VALUE) ||
      (typeof v === 'string' && v.length <= 20 && !CONTROL_CHARS.test(v))
    if (!ok) return err('Valeur d’indicateur invalide.')
    clean.push({ label: ind.label, value: v })
  }

  let detailUrl = null
  if (detail_url != null) {
    if (typeof detail_url !== 'string' || detail_url.length > MAX_URL_LENGTH) return err('detail_url invalide.')
    try {
      const u = new URL(detail_url)
      const base = new URL(app.base_url)
      if (!isWebProtocol(u.protocol) || !isWebProtocol(base.protocol)) return err('detail_url invalide.')
      if (u.username || u.password) return err('detail_url invalide.')
      if (u.origin !== base.origin) return err('detail_url hors domaine de l’app.')
      u.hash = ''
      detailUrl = u.toString()
    } catch {
      return err('detail_url invalide.')
    }
  }

  return {
    ok: true,
    value: {
      event_id: event_id.toLowerCase(), status, occurred_at: occurredAt,
      duration_s: duration_s ?? null, attempts: attempts ?? null,
      indicators: clean, detail_url: detailUrl,
    },
  }
}
