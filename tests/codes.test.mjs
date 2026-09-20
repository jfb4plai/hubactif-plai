import test from 'node:test'
import assert from 'node:assert/strict'
import { CODE_ALPHABET, generateCode, normalizeCode, parseCodeList, isValidCode } from '../shared/codes.js'

test('generateCode : 8 caractères, alphabet sans ambiguïté', () => {
  const code = generateCode()
  assert.equal(code.length, 8)
  for (const ch of code) assert.ok(CODE_ALPHABET.includes(ch))
  assert.ok(!/[01ILO]/.test(CODE_ALPHABET))
})

test('generateCode utilise le générateur injecté', () => {
  assert.equal(generateCode(4, () => 0), CODE_ALPHABET[0].repeat(4))
})

test('normalizeCode : majuscules, espaces retirés', () => {
  assert.equal(normalizeCode('  ab-12 '), 'AB-12')
  assert.equal(normalizeCode(null), '')
})

test('parseCodeList : sépare, normalise, dédoublonne', () => {
  assert.deepEqual(
    parseCodeList('eleve01\nELEVE02, eleve01; eleve03  \n\n'),
    ['ELEVE01', 'ELEVE02', 'ELEVE03']
  )
})

test('isValidCode', () => {
  assert.ok(isValidCode('ELEVE01'))
  assert.ok(isValidCode('AB-12'))
  assert.ok(!isValidCode('AB'))
  assert.ok(!isValidCode('A B C'))
})

import { normalizePrefix, nextSequenceStart, sequentialCodes, MAX_PREFIX_LENGTH } from '../shared/codes.js'

test('normalizePrefix : majuscules, espaces en tirets, caractères parasites retirés', () => {
  assert.equal(normalizePrefix('4821 2b'), '4821-2B')
  assert.equal(normalizePrefix('  fase_4821 -- 2b! '), 'FASE-4821-2B')
  assert.equal(normalizePrefix('-x-'), 'X')
  assert.equal(normalizePrefix(null), '')
})

test('sequentialCodes : numéros sur 2 chiffres au minimum, valides', () => {
  assert.deepEqual(sequentialCodes('4821-2B', 3), ['4821-2B-01', '4821-2B-02', '4821-2B-03'])
  assert.equal(sequentialCodes('A', 1, 100)[0], 'A-100')
  for (const c of sequentialCodes('4821-2B', 24)) assert.ok(isValidCode(c))
  assert.ok(isValidCode(`${'X'.repeat(MAX_PREFIX_LENGTH)}-99`))
})

test('nextSequenceStart : reprend après le plus grand numéro du même préfixe', () => {
  assert.equal(nextSequenceStart([], '4821-2B'), 1)
  assert.equal(nextSequenceStart(['4821-2B-01', '4821-2B-07', '4821-3A-20', 'ELEVE01'], '4821-2B'), 8)
})
