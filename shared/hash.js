import { createHash } from 'node:crypto'

export const sha256Hex = (text) => createHash('sha256').update(text).digest('hex')
