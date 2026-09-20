import { createClient } from '@supabase/supabase-js'

let anon
function anonClient() {
  anon ??= createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  )
  return anon
}

// Valide le jeton Supabase de l'enseignant (Authorization: Bearer). Retourne l'utilisateur,
// ou null après avoir répondu 401.
export async function requireUser(req, res) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    res.status(401).json({ error: 'Connexion requise.' })
    return null
  }
  const { data, error } = await anonClient().auth.getUser(token)
  if (error || !data?.user) {
    res.status(401).json({ error: 'Session invalide ou expirée. Reconnectez-vous.' })
    return null
  }
  return data.user
}
