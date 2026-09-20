// Doit rester cohérent avec la purge SQL (hub_purge_stale) : seuil = 15 juillet UTC de l'année courante.
const julyStart = (year) => Date.UTC(year, 6, 15)

// Bandeau « remise à zéro » : visible dès le 15 juillet pour les classes antérieures à cette date
// qui n'ont pas été remises à zéro depuis.
export function needsReset(now, { createdAt, lastResetAt }) {
  const start = julyStart(now.getUTCFullYear())
  if (now.getTime() < start) return false
  const created = new Date(createdAt).getTime()
  const last = lastResetAt ? new Date(lastResetAt).getTime() : -Infinity
  return created < start && last < start
}

// Doit rester cohérent avec les intervalles '30 days' du SQL (hub_create_assignment, hub_regenerate_link).
export const LINK_GRACE_DAYS = 30

export function linkExpiry(dueAt) {
  if (!dueAt) return null
  const d = new Date(dueAt)
  d.setUTCDate(d.getUTCDate() + LINK_GRACE_DAYS)
  return d.toISOString()
}
