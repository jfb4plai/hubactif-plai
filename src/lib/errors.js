const GENERIC = 'Une erreur est survenue. Réessayez.'

// Traduit une erreur PostgREST/Supabase/réseau en message français. Ne laisse jamais passer un texte anglais brut.
export function friendlyError(e) {
  if (e && typeof e.status === 'number' && e.message) return e.message // message français fourni par apiPost
  if (e && e.userMessage) return e.userMessage // message français voulu par le code de l'app (voir userError)
  const msg = String(e?.message ?? '')
  if (e?.code === 'PGRST116' || /no rows|or no\) rows/i.test(msg)) return 'Cette page est introuvable ou ne vous appartient pas. Revenez à vos classes.'
  if (e?.code === '23505') return 'Cette valeur existe déjà.'
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) return 'Connexion impossible. Vérifiez votre réseau et réessayez.'
  return GENERIC
}

// Erreur dont le message français peut être montré tel quel à l'utilisateur.
export const userError = (message) => Object.assign(new Error(message), { userMessage: message })
