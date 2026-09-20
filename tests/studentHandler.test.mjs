import test from 'node:test'
import assert from 'node:assert/strict'
import { createStudentHandler } from '../api/_lib/studentHandler.js'
import { fakeReq, fakeRes } from './helpers.mjs'

const tasks = [{ title: 'Dictée n°3', app: 'Dictée interactive', due_at: null, status: 'assigned', link_id: 'a1b2c3d4e5f60718', domain: 'Orthographe' }]

function setup({ result = tasks, allowed = true } = {}) {
  const asked = []
  const rates = []
  const handler = createStudentHandler({
    studentTasks: async (c, s) => { asked.push([c, s]); return result },
    rateCheck: async (key, max, win) => { rates.push([key, max, win]); return allowed },
  })
  const call = async (body, method = 'POST') => { const res = fakeRes(); await handler(fakeReq({ method, body, headers: { 'x-real-ip': '7.7.7.7' } }), res); return res }
  return { call, asked, rates }
}

test('405 si ce n’est pas un POST', async () => {
  assert.equal((await setup().call({}, 'GET')).statusCode, 405)
})

test('400 si un code manque', async () => {
  const res = await setup().call({ class_code: 'ABC234', student_code: '' })
  assert.equal(res.statusCode, 400)
})

test('les codes sont normalisés en majuscules avant la recherche', async () => {
  const { call, asked } = setup()
  const res = await call({ class_code: ' abc234 ', student_code: 'abcd2345' })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(asked[0], ['ABC234', 'ABCD2345'])
  assert.deepEqual(res.body, { tasks })
})

test('404 neutre quand les codes ne correspondent pas (sans dire quel champ)', async () => {
  const res = await setup({ result: null }).call({ class_code: 'ABC234', student_code: 'ZZZZ9999' })
  assert.equal(res.statusCode, 404)
  assert.deepEqual(res.body, { error: 'Codes non reconnus.' })
})

test('404 sans interroger la base si les codes sont démesurés', async () => {
  const { call, asked } = setup()
  const res = await call({ class_code: 'A'.repeat(50), student_code: 'B'.repeat(50) })
  assert.equal(res.statusCode, 404)
  assert.equal(asked.length, 0)
})

test('429 si limite de débit dépassée', async () => {
  const res = await setup({ allowed: false }).call({ class_code: 'ABC234', student_code: 'ABCD2345' })
  assert.equal(res.statusCode, 429)
})

test('clé de débit contenant l’IP résolue', async () => {
  const { call, rates } = setup()
  await call({ class_code: 'abc234', student_code: 'abcd2345' })
  assert.deepEqual(rates, [['student:7.7.7.7', 300, 300]])
})
