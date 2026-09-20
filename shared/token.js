// Jeton compact : base64url(JSON).base64url(signature ECDSA P-256 / SHA-256, format IEEE P1363).
// Fonctionne à l'identique dans Node ≥ 20 et dans les navigateurs (WebCrypto).
const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const TOKEN_TTL_SECONDS = 120 * 3600 // 5 jours : couvre un week-end

const KEY_ALGO = { name: 'ECDSA', namedCurve: 'P-256' }
const SIGN_ALGO = { name: 'ECDSA', hash: 'SHA-256' }

export class TokenError extends Error {
  constructor(code) {
    super(code)
    this.code = code // 'malformed' | 'bad_signature' | 'expired'
  }
}

export function b64uEncode(bytes) {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function b64uDecode(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = s + '='.repeat((4 - (s.length % 4)) % 4)
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

// Retourne { privateKey, publicKey } en base64url (PKCS8 / SPKI), prêtes pour les variables d'environnement.
export async function generateKeyPair() {
  const pair = await crypto.subtle.generateKey(KEY_ALGO, true, ['sign', 'verify'])
  const privateKey = b64uEncode(new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey)))
  const publicKey = b64uEncode(new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey)))
  return { privateKey, publicKey }
}

export async function signToken(payload, privateKeyB64) {
  const key = await crypto.subtle.importKey('pkcs8', b64uDecode(privateKeyB64), KEY_ALGO, false, ['sign'])
  const body = b64uEncode(encoder.encode(JSON.stringify(payload)))
  const sig = await crypto.subtle.sign(SIGN_ALGO, key, encoder.encode(body))
  return `${body}.${b64uEncode(new Uint8Array(sig))}`
}

export async function verifyToken(token, publicKeyB64, nowSec = Math.floor(Date.now() / 1000)) {
  const parts = String(token ?? '').split('.')
  if (parts.length !== 2) throw new TokenError('malformed')
  const [body, sigB64] = parts
  let sig, payload
  try {
    sig = b64uDecode(sigB64)
    payload = JSON.parse(decoder.decode(b64uDecode(body)))
  } catch {
    throw new TokenError('malformed')
  }
  const key = await crypto.subtle.importKey('spki', b64uDecode(publicKeyB64), KEY_ALGO, false, ['verify'])
  const ok = await crypto.subtle.verify(SIGN_ALGO, key, sig, encoder.encode(body))
  if (!ok) throw new TokenError('bad_signature')
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec) throw new TokenError('expired')
  return payload
}
