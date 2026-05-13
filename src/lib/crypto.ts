/**
 * Flamingo Sync: Client-Side Encryption Utilities
 *
 * IMPORTANT: These functions are documented for the CLIENT-SIDE implementation.
 * The server NEVER performs encryption/decryption of sync data.
 * All encryption operations happen in the Electron renderer process.
 *
 * === ARCHITECTURE ===
 *
 * Master Key (256-bit random):
 *   - Generated once on first sync setup
 *   - Used to encrypt/decrypt all sync data via AES-256-GCM
 *   - Stored locally on the device (IndexedDB / electron-store)
 *   - NEVER sent to the server in plaintext
 *
 * Key Encryption Key (KEK):
 *   - Derived from the user's password via PBKDF2
 *   - Used ONLY to encrypt/decrypt the Master Key
 *   - NEVER stored; derived fresh on each login
 *
 * Encrypted Master Key:
 *   - master_key encrypted with KEK
 *   - Stored on the server alongside salt and nonce
 *   - Can be safely stored since KEK is never sent to server
 *
 * === FLOW ===
 *
 * First Device Setup:
 *   1. Generate random 256-bit master key (crypto.getRandomValues)
 *   2. Prompt user for password
 *   3. Derive KEK: PBKDF2(password, salt, 600000 iterations, SHA-256)
 *   4. Encrypt master key with KEK: AES-256-GCM(master_key, KEK)
 *   5. Store { encrypted_master_key, nonce, salt } on server
 *   6. Store master_key in local secure storage
 *   7. Encrypt all data locally and upload encrypted blobs
 *
 * New Device Login:
 *   1. User logs in with email + password
 *   2. Download { encrypted_master_key, nonce, salt } from server
 *   3. Derive KEK: PBKDF2(password, salt, 600000 iterations, SHA-256)
 *   4. Decrypt master key: AES-256-GCM.decrypt(encrypted_master_key, KEK, nonce)
 *   5. Store master_key in local secure storage
 *   6. Download all encrypted blobs and decrypt locally with master key
 *
 * === SECURITY PROPERTIES ===
 *
 * - Server compromise does not expose data (only encrypted blobs + encrypted master key)
 * - Attacker with DB access cannot decrypt without the password
 * - PBKDF2 with 600k iterations makes brute-force infeasible
 * - Each data type uses a unique nonce per encryption operation
 * - No plaintext keys are ever transmitted
 * - Device approval adds a second factor for new device authorization
 *
 * === RECOVERY / TRADEOFFS ===
 *
 * - If password is lost: All synced data is unrecoverable (there is no backdoor)
 * - If local storage is lost but password is known: Data can be recovered by re-downloading
 *   and decrypting from the server using the password-derived KEK
 * - If BOTH local storage AND password are lost: Data is permanently unrecoverable
 * - This is by design: zero-knowledge architecture means no password reset for encrypted data
 */

// ====== CONSTANTS ======

export const AES_KEY_LENGTH = 256
export const SALT_LENGTH = 32
export const NONCE_LENGTH = 12
export const PBKDF2_ITERATIONS = 600000
export const PBKDF2_HASH = 'SHA-256'
export const ENCRYPTION_VERSION = 1

// ====== CLIENT-SIDE FUNCTIONS (for documentation/reference) ======

/**
 * Generate a random 256-bit master encryption key.
 *
 * CLIENT-SIDE ONLY. Never send this to the server.
 */
export async function generateMasterKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  )
}

/**
 * Export a CryptoKey to raw bytes for storage.
 */
export async function exportKey(key: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.exportKey('raw', key)
}

/**
 * Import raw key bytes as a CryptoKey.
 */
export async function importKey(raw: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    raw as unknown as BufferSource,
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Derive a Key Encryption Key from a password using PBKDF2.
 *
 * @param password - The user's password
 * @param salt - Random salt (32 bytes), stored alongside encrypted master key
 * @returns AES-GCM CryptoKey for wrapping/unwrapping the master key
 */
export async function deriveKEK(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const saltBuffer = new Uint8Array(salt) as unknown as BufferSource
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password) as unknown as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH,
    },
    keyMaterial,
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt data with AES-256-GCM.
 *
 * @param plaintext - Data to encrypt (as string)
 * @param key - AES-GCM CryptoKey
 * @param nonce - 12-byte random nonce (optional, generated if omitted)
 * @returns { encrypted: base64, nonce: base64 }
 */
export async function encrypt(
  plaintext: string,
  key: CryptoKey,
  nonce?: Uint8Array
): Promise<{ encrypted: string; nonce: string }> {
  const iv = nonce || crypto.getRandomValues(new Uint8Array(NONCE_LENGTH))
  const ivBuffer = new Uint8Array(iv) as unknown as BufferSource
  const encoder = new TextEncoder()
  const encoded = encoder.encode(plaintext) as unknown as BufferSource

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: ivBuffer },
    key,
    encoded
  )

  return {
    encrypted: arrayBufferToBase64(encrypted),
    nonce: arrayBufferToBase64(iv.buffer as ArrayBuffer),
  }
}

/**
 * Decrypt data with AES-256-GCM.
 *
 * @param encrypted - Base64-encoded ciphertext
 * @param key - AES-GCM CryptoKey
 * @param nonce - Base64-encoded 12-byte nonce
 * @returns Decrypted plaintext string
 */
export async function decrypt(
  encrypted: string,
  key: CryptoKey,
  nonce: string
): Promise<string> {
  const iv = base64ToArrayBuffer(nonce) as unknown as BufferSource
  const ciphertext = base64ToArrayBuffer(encrypted) as unknown as BufferSource

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  )

  const decoder = new TextDecoder()
  return decoder.decode(decrypted)
}

/**
 * Wrap (encrypt) the master key with the KEK for server storage.
 */
export async function wrapMasterKey(
  masterKey: CryptoKey,
  kek: CryptoKey,
  nonce?: Uint8Array
): Promise<{ encrypted_master_key: string; nonce: string }> {
  const iv = nonce || crypto.getRandomValues(new Uint8Array(NONCE_LENGTH))
  const ivBuffer = new Uint8Array(iv) as unknown as BufferSource

  const encrypted = await crypto.subtle.wrapKey('raw', masterKey, kek, {
    name: 'AES-GCM',
    iv: ivBuffer,
  })

  return {
    encrypted_master_key: arrayBufferToBase64(encrypted),
    nonce: arrayBufferToBase64(iv.buffer as ArrayBuffer),
  }
}

/**
 * Unwrap (decrypt) the master key from the KEK-wrapped form.
 */
export async function unwrapMasterKey(
  encryptedMasterKey: string,
  kek: CryptoKey,
  nonce: string
): Promise<CryptoKey> {
  const wrapped = base64ToArrayBuffer(encryptedMasterKey) as unknown as BufferSource
  const iv = base64ToArrayBuffer(nonce) as unknown as BufferSource

  return crypto.subtle.unwrapKey(
    'raw',
    wrapped,
    kek,
    { name: 'AES-GCM', iv },
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  )
}

// ====== UTILITIES ======

export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
}

export function generateNonce(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(NONCE_LENGTH))
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

/**
 * Compute SHA-256 hash for integrity verification.
 */
export async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder()
  const encoded = encoder.encode(data) as unknown as BufferSource
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  return arrayBufferToBase64(hashBuffer)
}
