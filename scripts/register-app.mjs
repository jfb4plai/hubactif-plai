// Usage : node --env-file=.env.local scripts/register-app.mjs <slug> "<Nom>" <base_url> "<libellé1|libellé2|...>"
// Ex.   : node --env-file=.env.local scripts/register-app.mjs dictee "Dictée interactive" https://dictee.example.org "mots réussis|essais"
// ATTENTION : la clé imprimée sur stdout ne doit pas rester dans l'historique du shell ni dans des journaux de CI.
// Copier-la dans Vercel puis effacer le terminal.
// La clé d'app est affichée UNE SEULE FOIS : la stocker dans les variables d'environnement de l'app (HUB_APP_KEY), jamais dans son frontend.
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { sha256Hex } from '../shared/hash.js'
import { b64uEncode } from '../shared/token.js'

const [slug, rawName, baseUrl, labels = ''] = process.argv.slice(2)
const name = (rawName || '').trim()
const fail = (msg) => { console.error(msg); process.exit(1) }
if (!slug || !name || !baseUrl) fail('Usage : register-app.mjs <slug> "<Nom>" <base_url> "<libellé1|libellé2>"')
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  fail('Variables manquantes : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY (ex. node --env-file=.env.local scripts/register-app.mjs ...).')
}
if (!/^[a-z0-9-]{2,40}$/.test(slug)) fail('Slug invalide : 2 à 40 caractères parmi a-z, 0-9 et tiret.')
let parsedUrl
try { parsedUrl = new URL(baseUrl) } catch { fail('base_url invalide : adresse complète attendue (https://...).') }
if (!(parsedUrl.protocol === 'https:' || (parsedUrl.protocol === 'http:' && parsedUrl.hostname === 'localhost'))) {
  fail('base_url invalide : https obligatoire (http seulement pour localhost).')
}

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const key = `hubkey_${b64uEncode(randomBytes(32))}`
const indicatorLabels = labels.split('|').map((l) => l.trim()).filter(Boolean)

const { error } = await admin.from('hub_apps').insert({
  slug, name, base_url: baseUrl.replace(/\/$/, ''), key_hash: sha256Hex(key), indicator_labels: indicatorLabels,
})
if (error) {
  console.error('Échec :', error.message)
  process.exit(1)
}
console.log(`App « ${name} » enregistrée (slug ${slug}, ${indicatorLabels.length} libellé(s) d'indicateur).`)
console.log('Clé d’app (à copier maintenant, non récupérable) :')
console.log(`HUB_APP_KEY=${key}`)
