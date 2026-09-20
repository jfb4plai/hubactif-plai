import { createClient } from '@supabase/supabase-js'

// Valide le jeton Supabase de l'enseignant (Authorization: Bearer). Retourne l'utilisateur,
// ou null après avoir répondu 401.
export async function requireUser(req, res) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    res.status(401).json({ error: 'Connexion requise.' })
    return null
  }
  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  )
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) {
    res.status(401).json({ error: 'Session invalide ou expirée. Reconnectez-vous.' })
    return null
  }
  return data.user
}
