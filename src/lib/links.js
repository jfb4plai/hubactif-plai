// Dernier lien non révoqué et non expiré d'une cible (ou undefined).
export function pickLiveLink(links, now) {
  return (links ?? [])
    .filter((l) => !l.revoked && !(l.expires_at && new Date(l.expires_at).getTime() <= now.getTime()))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
}
