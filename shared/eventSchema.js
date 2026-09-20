export const STATUSES = ['started', 'completed']
const MAX_INDICATORS = 10
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Schéma strict : aucun texte libre produit par l'élève ne doit entrer dans le hub.
// `app` = { base_url, indicator_labels } (ligne hub_apps).
export function validateEvent(body, app) {
  const err = (error) => ({ ok: false, error })
  if (!body || typeof body !== 'object') return err('Corps invalide.')
  const { event_id, status, occurred_at, duration_s, attempts, indicators = [], detail_url } = body

  if (typeof event_id !== 'string' || !UUID.test(event_id)) return err('event_id invalide.')
  if (!STATUSES.includes(status)) return err('status invalide.')

  let occurredAt = null
  if (occurred_at != null) {
    const d = new Date(occurred_at)
    if (Number.isNaN(d.getTime())) return err('occurred_at invalide.')
    occurredAt = d.toISOString()
  }

  for (const [name, value, max] of [['duration_s', duration_s, 86400], ['attempts', attempts, 1000]]) {
    if (value != null && (!Number.isInteger(value) || value < 0 || value > max)) return err(`${name} invalide.`)
  }

  if (!Array.isArray(indicators) || indicators.length > MAX_INDICATORS) return err('indicators invalide.')
  const allowed = app.indicator_labels ?? []
  const clean = []
  for (const ind of indicators) {
    if (!ind || typeof ind.label !== 'string' || ind.label.length > 40 || !allowed.includes(ind.label)) {
      return err('Libellé d’indicateur non déclaré.')
    }
    const v = ind.value
    const ok = (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && v.length <= 20)
    if (!ok) return err('Valeur d’indicateur invalide.')
    clean.push({ label: ind.label, value: v })
  }

  let detailUrl = null
  if (detail_url != null) {
    try {
      const u = new URL(detail_url)
      if (u.origin !== new URL(app.base_url).origin) return err('detail_url hors domaine de l’app.')
      detailUrl = u.toString()
    } catch {
      return err('detail_url invalide.')
    }
  }

  return {
    ok: true,
    value: {
      event_id, status, occurred_at: occurredAt,
      duration_s: duration_s ?? null, attempts: attempts ?? null,
      indicators: clean, detail_url: detailUrl,
    },
  }
}
