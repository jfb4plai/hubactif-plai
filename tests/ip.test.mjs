import test from 'node:test'
import assert from 'node:assert/strict'
import { clientIp } from '../api/_lib/ip.js'

const req = (headers = {}, remoteAddress) => ({ headers, socket: remoteAddress ? { remoteAddress } : undefined })

test('x-vercel-forwarded-for prioritaire', () => {
  assert.equal(clientIp(req({ 'x-vercel-forwarded-for': '9.9.9.9', 'x-real-ip': '8.8.8.8', 'x-forwarded-for': '1.1.1.1, 2.2.2.2' })), '9.9.9.9')
})

test('x-real-ip ensuite', () => {
  assert.equal(clientIp(req({ 'x-real-ip': '8.8.8.8', 'x-forwarded-for': '1.1.1.1, 2.2.2.2' })), '8.8.8.8')
})

test('x-forwarded-for : dernière entrée, la première (fournie par le client) est ignorée', () => {
  assert.equal(clientIp(req({ 'x-forwarded-for': '6.6.6.6, 5.5.5.5 , 2.2.2.2' })), '2.2.2.2')
  assert.equal(clientIp(req({ 'x-forwarded-for': '2.2.2.2' })), '2.2.2.2')
})

test('repli sur l’adresse de la socket, puis unknown', () => {
  assert.equal(clientIp(req({}, '3.3.3.3')), '3.3.3.3')
  assert.equal(clientIp(req({})), 'unknown')
  assert.equal(clientIp({}), 'unknown')
})
