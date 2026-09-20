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
