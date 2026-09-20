import test from 'node:test'
import assert from 'node:assert/strict'
import { friendlyError } from '../src/lib/errors.js'

test('PGRST116 ou "no rows" : page introuvable', () => {
  const msg = 'Cette page est introuvable ou ne vous appartient pas. Revenez à vos classes.'
  assert.equal(friendlyError({ code: 'PGRST116', message: 'x' }), msg)
  assert.equal(friendlyError({ message: 'JSON object requested, multiple (or no) rows returned' }), msg)
  assert.equal(friendlyError(new Error('no rows found')), msg)
})
test('23505 : valeur existante', () => {
  assert.equal(friendlyError({ code: '23505', message: 'duplicate key' }), 'Cette valeur existe déjà.')
})
test('réseau', () => {
  const msg = 'Connexion impossible. Vérifiez votre réseau et réessayez.'
  assert.equal(friendlyError(new TypeError('Failed to fetch')), msg)
  assert.equal(friendlyError({ message: 'NetworkError when attempting to fetch resource.' }), msg)
  assert.equal(friendlyError({ message: 'Load failed' }), msg)
})
test('erreur d’API avec status numérique : message conservé', () => {
  assert.equal(friendlyError(Object.assign(new Error('Classe inconnue.'), { status: 404 })), 'Classe inconnue.')
})
test('autre : message générique, jamais le texte anglais', () => {
  assert.equal(friendlyError({ message: 'permission denied for table x' }), 'Une erreur est survenue. Réessayez.')
  assert.equal(friendlyError(null), 'Une erreur est survenue. Réessayez.')
})

test('userError : le message français voulu est conservé', async () => {
  const { friendlyError, userError } = await import('../src/lib/errors.js')
  assert.equal(friendlyError(userError('Impossible de générer un code unique, réessayez.')), 'Impossible de générer un code unique, réessayez.')
})
