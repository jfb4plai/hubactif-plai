// Déballe une réponse Supabase : retourne data ou lève l'erreur.
export function must({ data, error }) {
  if (error) throw error
  return data
}
