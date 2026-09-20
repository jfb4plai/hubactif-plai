// Alphabet sans caractères ambigus (0/O, 1/I/L) : 31 symboles, 8 caractères ≈ 40 bits.
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const CODE_LENGTH = 8
export const CLASS_CODE_LENGTH = 6

// Tirage sans biais de modulo (rejet des valeurs au-delà du plus grand multiple de max).
function secureRandom(max) {
  const limit = Math.floor(256 / max) * max
  const buf = new Uint8Array(1)
  for (;;) {
    crypto.getRandomValues(buf)
    if (buf[0] < limit) return buf[0] % max
  }
}

export function generateCode(length = CODE_LENGTH, random = secureRandom) {
  let out = ''
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[random(CODE_ALPHABET.length)]
  return out
}

export function normalizeCode(raw) {
  return String(raw ?? '').trim().toUpperCase()
}

// Liste collée par l'enseignant : un code par ligne ou séparés par virgule, point-virgule, espace.
export function parseCodeList(text) {
  const seen = new Set()
  const codes = []
  for (const part of String(text ?? '').split(/[\s,;]+/)) {
    const code = normalizeCode(part)
    if (!code || seen.has(code)) continue
    seen.add(code)
    codes.push(code)
  }
  return codes
}

// Même contrainte que le check SQL de hub_students.code.
export const isValidCode = (code) => /^[A-Z0-9_-]{3,32}$/.test(code)
