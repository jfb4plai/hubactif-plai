import { createClient } from '@supabase/supabase-js'

let client

// Client service role : serveur uniquement, jamais exposé au frontend.
export function admin() {
  if (!client) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Supabase admin non configuré.')
    client = createClient(url, key, { auth: { persistSession: false } })
  }
  return client
}
