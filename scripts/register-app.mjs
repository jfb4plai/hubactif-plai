// Usage : node --env-file=.env.local scripts/register-app.mjs <slug> "<Nom>" <base_url> "<libellé1|libellé2|...>"
// Ex.   : node --env-file=.env.local scripts/register-app.mjs dictee "Dictée interactive" https://dictee.example.org "mots réussis|essais"
// La clé d'app est affichée UNE SEULE FOIS : la stocker dans les variables d'environnement de l'app (HUB_APP_KEY), jamais dans son frontend.
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { sha256Hex } from '../shared/hash.js'
import { b64uEncode } from '../shared/token.js'

const [slug, name, baseUrl, labels = ''] = process.argv.slice(2)
if (!slug || !name || !baseUrl) {
  console.error('Usage : register-app.mjs <slug> "<Nom>" <base_url> "<libellé1|libellé2>"')
  process.exit(1)
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
