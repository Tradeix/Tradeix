import crypto from 'crypto'

const ALGO = 'aes-256-gcm'

function getKey(): Buffer {
  const raw = process.env.BROKER_ENCRYPTION_KEY
  if (!raw) throw new Error('BROKER_ENCRYPTION_KEY env var is required')
  if (raw.length === 64 && /^[0-9a-f]+$/i.test(raw)) return Buffer.from(raw, 'hex')
  if (raw.length === 44) return Buffer.from(raw, 'base64')
  return crypto.createHash('sha256').update(raw).digest()
}

export function encryptJSON(value: unknown): string {
  const plaintext = JSON.stringify(value)
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

export function decryptJSON<T = unknown>(payload: string): T {
  const key = getKey()
  const buf = Buffer.from(payload, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const enc = buf.subarray(28)
  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  const dec = Buffer.concat([decipher.update(enc), decipher.final()])
  return JSON.parse(dec.toString('utf8')) as T
}
