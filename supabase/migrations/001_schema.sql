-- Flamingo Sync: Database Schema
-- Run this in your Supabase SQL editor or via migrations

-- 1. SYNC TEMP TOKENS
-- Short-lived tokens used for the OAuth device-code-like flow
CREATE TABLE IF NOT EXISTS sync_temp_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'expired')),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes'),
  claimed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sync_temp_tokens_token ON sync_temp_tokens(token);
CREATE INDEX IF NOT EXISTS idx_sync_temp_tokens_status ON sync_temp_tokens(status);

-- 2. SYNC SESSIONS (permanent sync tokens)
-- Each device gets one session with a permanent token
CREATE TABLE IF NOT EXISTS sync_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  token_prefix TEXT NOT NULL,
  device_name TEXT,
  device_type TEXT,
  encrypted_master_key TEXT,
  master_key_nonce TEXT,
  master_key_salt TEXT,
  master_key_version INTEGER DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  rotated_at TIMESTAMPTZ,
  CONSTRAINT unique_active_session UNIQUE (user_id, token_hash)
);

CREATE INDEX IF NOT EXISTS idx_sync_sessions_user ON sync_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_sessions_token_hash ON sync_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sync_sessions_active ON sync_sessions(is_active);

-- 3. SYNC CONFIGS
-- Per-user configuration of which data types to sync
CREATE TABLE IF NOT EXISTS sync_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  sync_history BOOLEAN NOT NULL DEFAULT true,
  sync_environments BOOLEAN NOT NULL DEFAULT true,
  sync_secrets BOOLEAN NOT NULL DEFAULT true,
  sync_collections BOOLEAN NOT NULL DEFAULT true,
  sync_settings BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_configs_user ON sync_configs(user_id);

-- 4. ENCRYPTED SYNC DATA
-- Only encrypted blobs are stored; server never sees plaintext
CREATE TABLE IF NOT EXISTS sync_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data_type TEXT NOT NULL CHECK (data_type IN ('history', 'environment', 'secret', 'collection', 'setting')),
  encrypted_blob TEXT NOT NULL,
  nonce TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  checksum TEXT,
  blob_size_bytes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_data_type UNIQUE (user_id, data_type)
);

CREATE INDEX IF NOT EXISTS idx_sync_data_user ON sync_data(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_data_type ON sync_data(data_type);

-- 5. DEVICES
-- Registered devices for management and approval
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sync_sessions(id) ON DELETE SET NULL,
  name TEXT NOT NULL DEFAULT 'Unknown Device',
  device_type TEXT,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  is_current BOOLEAN NOT NULL DEFAULT false,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_session ON devices(session_id);

-- 6. AUDIT LOG
-- Security event tracking
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- 7. EVENTS TABLE
-- Queue for sync events (replaces polling)
CREATE TABLE IF NOT EXISTS sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('data_updated', 'config_changed', 'device_revoked', 'key_rotated')),
  data_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_sync_events_user ON sync_events(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_events_unprocessed ON sync_events(processed, created_at);

-- ====== ROW LEVEL SECURITY ======
ALTER TABLE sync_temp_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_events ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY user_isolation ON sync_sessions FOR ALL USING (user_id = auth.uid());
CREATE POLICY user_isolation ON sync_configs FOR ALL USING (user_id = auth.uid());
CREATE POLICY user_isolation ON sync_data FOR ALL USING (user_id = auth.uid());
CREATE POLICY user_isolation ON devices FOR ALL USING (user_id = auth.uid());
CREATE POLICY user_isolation ON audit_logs FOR ALL USING (user_id = auth.uid());
CREATE POLICY user_isolation ON sync_events FOR ALL USING (user_id = auth.uid());

-- ====== FUNCTIONS ======

-- Cleanup expired temp tokens
CREATE OR REPLACE FUNCTION cleanup_expired_temp_tokens()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE sync_temp_tokens
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at < now();
END;
$$;

-- Rotate master key version
CREATE OR REPLACE FUNCTION increment_master_key_version(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE sync_sessions
  SET master_key_version = master_key_version + 1,
      rotated_at = now()
  WHERE user_id = p_user_id AND is_active = true;
END;
$$;

-- ====== TRIGGERS ======

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_sync_configs_timestamp
  BEFORE UPDATE ON sync_configs
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_sync_data_timestamp
  BEFORE UPDATE ON sync_data
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();
