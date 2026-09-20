import { generateKeyPair } from '../shared/token.js'

const { privateKey, publicKey } = await generateKeyPair()
console.log('# À coller dans les variables d\'environnement Vercel (et .env.local). Ne jamais commiter la clé privée.')
console.log(`HUB_SIGNING_PRIVATE_KEY=${privateKey}`)
console.log(`HUB_SIGNING_PUBLIC_KEY=${publicKey}`)
