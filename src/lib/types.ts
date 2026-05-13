// ====== API Response Types ======

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface SyncInitResponse {
  temp_token: string
  login_url: string
  expires_in: number
}

export interface SyncTokenResponse {
  session_token: string
  token_prefix: string
  expires_at: string | null
  is_new_device: boolean
  sync_config: SyncConfig
}

export interface SyncConfig {
  sync_history: boolean
  sync_environments: boolean
  sync_secrets: boolean
  sync_collections: boolean
  sync_settings: boolean
}

export interface SyncDataItem {
  id: string
  data_type: SyncDataType
  encrypted_blob: string
  nonce: string
  version: number
  checksum?: string
  blob_size_bytes?: number
  updated_at: string
}

export interface SyncDataUpload {
  data_type: SyncDataType
  encrypted_blob: string
  nonce: string
  checksum?: string
}

export interface Device {
  id: string
  name: string
  device_type: string
  is_approved: boolean
  is_current: boolean
  last_seen_at: string
  created_at: string
}

export interface AuditEvent {
  id: string
  event_type: string
  ip_address?: string
  metadata?: Record<string, unknown>
  created_at: string
}

// ====== Domain Types ======

export type SyncDataType = 'history' | 'environment' | 'secret' | 'collection' | 'setting'

export type TempTokenStatus = 'pending' | 'claimed' | 'expired'

export type SyncEventType = 'data_updated' | 'config_changed' | 'device_revoked' | 'key_rotated'

// ====== Encryption Types ======

export interface EncryptedPayload {
  encrypted: string
  nonce: string
}

export interface MasterKeyPackage {
  master_key: string
  version: number
}

// ====== Database Row Types (for internal use) ======

export interface DbSyncSession {
  id: string
  user_id: string
  token_hash: string
  token_prefix: string
  device_name: string | null
  device_type: string | null
  encrypted_master_key: string | null
  master_key_nonce: string | null
  master_key_salt: string | null
  master_key_version: number
  is_active: boolean
  last_used_at: string
  created_at: string
  expires_at: string | null
  rotated_at: string | null
}

export interface DbSyncConfig {
  id: string
  user_id: string
  sync_history: boolean
  sync_environments: boolean
  sync_secrets: boolean
  sync_collections: boolean
  sync_settings: boolean
  updated_at: string
}

export interface DbSyncData {
  id: string
  user_id: string
  data_type: string
  encrypted_blob: string
  nonce: string
  version: number
  checksum: string | null
  blob_size_bytes: number | null
  updated_at: string
}

export interface DbTempToken {
  id: string
  token: string
  status: string
  user_id: string | null
  expires_at: string
  claimed_at: string | null
}

export interface DbDevice {
  id: string
  user_id: string
  session_id: string | null
  name: string
  device_type: string | null
  is_approved: boolean
  is_current: boolean
  last_seen_at: string
  created_at: string
  approved_at: string | null
}
