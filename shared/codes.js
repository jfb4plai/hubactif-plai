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

// ---- Codes lisibles : préfixe (numéro FASE + classe) + numéro d'ordre. Uniques par construction. ----
export const MAX_PREFIX_LENGTH = 24

// « 4821 2b » -> « 4821-2B » : majuscules, espaces en tirets, caractères non permis retirés.
export function normalizePrefix(raw) {
  return String(raw ?? '').trim().toUpperCase()
    .replace(/[\s_]+/g, '-').replace(/[^A-Z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

// Premier numéro libre pour ce préfixe, d'après les codes déjà présents (évite les doublons quand on clique deux fois).
export function nextSequenceStart(existingCodes, prefix) {
  const start = `${prefix}-`
  let max = 0
  for (const code of existingCodes) {
    const rest = code.startsWith(start) ? code.slice(start.length) : ''
    if (/^[0-9]+$/.test(rest)) max = Math.max(max, Number(rest))
  }
  return max + 1
}

// sequentialCodes('4821-2B', 3) -> ['4821-2B-01', '4821-2B-02', '4821-2B-03']
export function sequentialCodes(prefix, count, start = 1) {
  const width = Math.max(2, String(start + count - 1).length)
  return Array.from({ length: count }, (_, i) => `${prefix}-${String(start + i).padStart(width, '0')}`)
}
