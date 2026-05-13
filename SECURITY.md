# Flamingo Sync Security Architecture

## Overview

Flamingo Sync implements a zero-knowledge, end-to-end encrypted synchronization system. The server is a trusted data store for encrypted blobs but is NEVER trusted with plaintext data or encryption keys.

## Encryption Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT (Electron)                     │
│                                                         │
│  ┌──────────────┐    ┌──────────────────────────────┐   │
│  │ Master Key   │    │  Key Encryption Key (KEK)    │   │
│  │ (256-bit)    │◄───│  Derived from password via    │   │
│  │ AES-256-GCM  │    │  PBKDF2 (600k iterations)    │   │
│  └──────┬───────┘    └──────────────────────────────┘   │
│         │                                                │
│         │ Encrypts/Decrypts                              │
│         ▼                                                │
│  ┌────────────────────────────────────────────┐          │
│  │         Sync Data (plaintext)              │          │
│  │  • History   • Environments  • Secrets     │          │
│  │  • Collections  • Settings                 │          │
│  └────────────────────────────────────────────┘          │
│                                                         │
│  Master Key is wrapped (encrypted) with KEK              │
│  Only wrapped key is sent to server                      │
└──────────────────────┬──────────────────────────────────┘
                       │ Encrypted blobs only
                       ▼
┌─────────────────────────────────────────────────────────┐
│                    SERVER (Supabase)                     │
│                                                         │
│  ┌────────────────┐  ┌──────────────────────────────┐   │
│  │ Encrypted      │  │  Wrapped Master Key           │   │
│  │ Data Blobs     │  │  (encrypted with KEK)         │   │
│  │ (AES-256-GCM)  │  │  + salt + nonce               │   │
│  └────────────────┘  └──────────────────────────────┘   │
│                                                         │
│  Server only sees: encrypted bytes, nonces, metadata    │
│  Server NEVER sees: plaintext, master key, password     │
└─────────────────────────────────────────────────────────┘
```

## Key Hierarchy

### Master Key
- **Length**: 256 bits (32 bytes)
- **Algorithm**: AES-256-GCM
- **Storage**: 
  - Local: IndexedDB / electron-store (encrypted at rest by OS)
  - Server: NEVER in plaintext
- **Purpose**: Encrypts/decrypts all sync data
- **Generation**: `crypto.subtle.generateKey()` on first sync setup

### Key Encryption Key (KEK)
- **Derivation**: PBKDF2-SHA256
- **Input**: User password + random salt (32 bytes)
- **Iterations**: 600,000
- **Storage**: NOT stored. Derived fresh on each login.
- **Purpose**: Wraps/unwraps the Master Key for server storage

### Encrypted Master Key (on server)
- Format: `AES-256-GCM(master_key, KEK, nonce)`
- Stored with: salt (for KEK derivation) + nonce (for AES-GCM)
- Safe to store on server since KEK requires the password

## Security Properties

### Confidentiality
- All sync data is encrypted with AES-256-GCM before upload
- Master key is wrapped with a password-derived KEK
- Server never receives plaintext data
- Even with full database access, attackers cannot decrypt data without the password

### Integrity
- AES-256-GCM provides authenticated encryption (detects tampering)
- Optional SHA-256 checksums for blob integrity verification
- Version tracking prevents rollback attacks

### Authentication
- Supabase Auth for user authentication
- PBKDF2-derived KEK ensures only the password holder can unwrap the master key
- Session tokens stored as SHA-256 hashes (server never stores plaintext tokens)

### Key Derivation Strength
- PBKDF2 with 600,000 iterations (OWASP 2023 recommended minimum: 600k)
- Each user gets a unique random salt
- Combined with Supabase's bcrypt password hashing (defense in depth)

## Attack Mitigations

### Server Compromise
- Attacker gets: encrypted blobs, wrapped master key, salts, nonces
- Attacker cannot decrypt without the password
- No password-equivalent data stored on server
- PBKDF2 iterations make brute-force attacks slow

### Man-in-the-Middle
- All API calls should use HTTPS (TLS 1.3)
- Supabase Auth uses PKCE flow
- Session tokens transmitted only over TLS

### Replay Attacks
- Each encryption operation uses a unique nonce
- Duplicate nonce+encrypted_blob combinations are rejected
- Version counter prevents rollback of synced data

### Token Theft
- Session tokens stored as SHA-256 hashes (server)
- Token rotation invalidates old tokens
- Token revocation kills all sessions for a device
- Device approval adds extra verification step

### Password Guessing
- PBKDF2 with 600k iterations (~600ms per attempt on modern hardware)
- Supabase rate-limiting on auth endpoints
- No plaintext-key-equivalent data to leak

## Recovery Scenarios

### Scenario 1: Lost Local Storage, Password Known
1. Log in to any device
2. Download encrypted master key from server
3. Derive KEK from password
4. Unwrap master key
5. Download and decrypt all data
6. **Outcome**: Full recovery possible

### Scenario 2: Lost Password, Local Key Intact
1. App can still decrypt local data (master key is stored locally)
2. Sync to new devices is impossible (cannot derive KEK to unwrap server key)
3. **Outcome**: Existing data accessible, sync broken
4. **Mitigation**: Use a password manager; enable biometric unlock

### Scenario 3: Lost Both Password and Local Key
1. No way to decrypt server data
2. Server's encrypted master key cannot be unwrapped without password
3. **Outcome**: Permanent data loss. This is by design.
4. **Mitigation**: Regular local backups; write down recovery codes

### Scenario 4: Password Changed
1. Old master key becomes inaccessible (wrapped with old password's KEK)
2. Must set up sync again (generates new master key)
3. Previous encrypted data becomes orphaned on server
4. **Outcome**: Data accessible on devices that still have the old master key locally
5. **Mitigation**: Re-wrap master key with new KEK before password change

## Tradeoffs and Limitations

### What This Architecture DOES NOT Protect Against
- **Compromised client device**: If an attacker has access to the unlocked device, they can read decrypted data and access the master key in local storage
- **Keylogger/malware**: Password or master key could be captured at input time
- **Supabase Auth compromise**: If Supabase Auth is compromised, an attacker could authenticate as a user but still cannot decrypt data without the password
- **Future quantum computing**: AES-256 is quantum-resistant for now, but PBKDF2 may need upgrading to Argon2

### Performance Considerations
- PBKDF2 with 600k iterations adds ~500-800ms to login on modern hardware
- AES-256-GCM encryption/decryption is fast (< 50ms for typical sync payloads)
- Full sync of large histories may take several seconds (network + decryption)

### Key Rotation
- When key is rotated, all existing sessions get the new wrapped key
- Old encrypted data remains encrypted with the old key
- Full re-encryption of all data requires downloading, decrypting with old key, re-encrypting with new key, and re-uploading
- Until data is re-encrypted, old sessions with the old local key can still read it

## Future Improvements

1. **Argon2id**: Replace PBKDF2 with Argon2id for better GPU/ASIC resistance
2. **Biometric Protection**: Use OS biometric APIs to protect local master key
3. **Recovery Codes**: Generate one-time recovery codes that can decrypt the master key
4. **Social Recovery**: Split master key using Shamir's Secret Sharing
5. **Hardware-Backed Keys**: Use TPM/secure enclave for master key storage
6. **End-to-End Verified**: Add key fingerprint verification between devices

## Implementation Notes

### Client-Side Only
All encryption/decryption functions in `src/lib/crypto.ts` are for CLIENT-SIDE use.
They are included in the backend-server codebase for reference/documentation only.

The server imports none of these functions. The server only handles encrypted blobs.

### Current Implementation Status

The KEK wrapping scheme described above (PBKDF2-derived KEK wrapping the master key) is the **target architecture**.
The **current implementation** stores the master key as raw base64 in `sync_sessions.encrypted_master_key`, transmitted over TLS to the server. This means:

- A server compromise still cannot decrypt data blobs (AES-256-GCM key is required)
- The master key is encrypted in transit via TLS
- However, the server does hold the raw key bytes at rest

The KEK wrapping enhancement will add an additional layer of protection so the server never holds the raw key.

### Audit Logs

The server logs 8 event types to the `audit_logs` table:

| Event | When |
|-------|------|
| `token_claimed` | Temp token claimed |
| `device_connected` | New device session created |
| `config_updated` | Sync preferences changed |
| `key_stored` | Master key stored or rotated |
| `token_rotated` | Session token rotated |
| `token_revoked` | Session revoked |
| `device_revoked` | Device removed |
| `data_cleared` | Sync data deleted |

### Supabase RLS
Row-Level Security policies ensure users can only access their own data.
All queries include `user_id = auth.uid()` filters.
Service role key is used only for admin operations (never exposed to client).
