import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96-bit IV for GCM
const TAG_LENGTH = 16 // 128-bit auth tag
const KEY_LENGTH = 32 // 256-bit key

function getDerivedKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY ?? 'nexus-default-encryption-key-dev'
  // Derive a 32-byte key from whatever length input using SHA-256
  return crypto.createHash('sha256').update(raw).digest()
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns a base64-encoded string: iv(12) + tag(16) + ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = getDerivedKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH })
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

/**
 * Decrypts a base64-encoded ciphertext produced by encrypt().
 * Throws if tampered.
 */
export function decrypt(ciphertext: string): string {
  const key = getDerivedKey()
  const data = Buffer.from(ciphertext, 'base64')
  if (data.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error('Invalid ciphertext')
  }
  const iv = data.subarray(0, IV_LENGTH)
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH)
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH })
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

/**
 * Returns the last 4 chars of the decrypted key for display (masked).
 */
export function maskApiKey(encryptedKey: string): string {
  try {
    const plain = decrypt(encryptedKey)
    if (plain.length <= 4) return '****'
    return '****' + plain.slice(-4)
  } catch {
    return '****'
  }
}
