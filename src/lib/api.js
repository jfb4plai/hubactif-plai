import { supabase } from './supabase.js'

// POST JSON vers une fonction du hub ; ajoute le jeton de l'enseignant s'il est connecté.
// { auth: false } : pas de jeton (espace élève).
export async function apiPost(path, body, { auth = true } = {}) {
  const token = auth ? (await supabase.auth.getSession()).data.session?.access_token : undefined
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(json.error || `Erreur ${res.status}`), { status: res.status })
  return json
}
