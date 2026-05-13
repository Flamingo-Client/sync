'use server'

import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  generateSessionToken,
  hashToken,
  ok,
  badRequest,
  serverError,
} from '@/lib/api-utils'
import type { DbSyncConfig } from '@/lib/types'

/**
 * POST /api/sync/token
 *
 * POLL by the Electron client. NO AUTHENTICATION REQUIRED.
 * The Electron client calls this with the temp_token repeatedly
 * until the browser has claimed it via /api/sync/claim.
 *
 * Body: { temp_token: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { temp_token } = body

    if (!temp_token) {
      return badRequest('temp_token is required')
    }

    const supabase = createAdminClient()

    // Find the temp token (no auth — this is a polling endpoint)
    const { data: tempToken, error: tokenError } = await supabase
      .from('sync_temp_tokens')
      .select('status, expires_at, user_id')
      .eq('token', temp_token)
      .single()

    if (tokenError || !tempToken) {
      return badRequest('Invalid token')
    }

    if (new Date(tempToken.expires_at) < new Date()) {
      return badRequest('Token has expired. Restart sync.')
    }

    // Not yet claimed — tell the client to keep polling
    if (tempToken.status !== 'claimed' || !tempToken.user_id) {
      return badRequest('Token not yet authorized. Complete login first.')
    }

    const userId = tempToken.user_id

    // Check if a master key already exists
    const { data: existingKeyRow } = await supabase
      .from('sync_sessions')
      .select('encrypted_master_key')
      .eq('user_id', userId)
      .eq('is_active', true)
      .not('encrypted_master_key', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const hasExistingKey = !!existingKeyRow?.encrypted_master_key

    // Generate permanent session token
    const { token: sessionToken, hash, prefix } = generateSessionToken()

    const { data: newSession } = await supabase
      .from('sync_sessions')
      .insert({
        user_id: userId,
        token_hash: hash,
        token_prefix: prefix,
        device_name: 'Desktop Client',
        device_type: 'desktop',
        is_active: true,
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single()

    // Unset is_current on any existing device for this user
    await supabase
      .from('devices')
      .update({ is_current: false })
      .eq('user_id', userId)
      .eq('is_current', true)

    // Register device linked to the new session
    await supabase.from('devices').insert({
      user_id: userId,
      name: 'Desktop Client',
      device_type: 'desktop',
      is_approved: true,
      is_current: true,
      session_id: newSession?.id ?? null,
    })

    await supabase.from('audit_logs').insert({
      user_id: userId,
      event_type: 'device_connected',
      metadata: {
        device_type: 'desktop',
        token_prefix: prefix,
      },
    })

    // Get or create sync config
    let syncConfig: DbSyncConfig | null = null
    const { data: existingConfig } = await supabase
      .from('sync_configs')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (existingConfig) {
      syncConfig = existingConfig as unknown as DbSyncConfig
    } else {
      const { data: newConfig } = await supabase
        .from('sync_configs')
        .insert({ user_id: userId })
        .select()
        .single()
      syncConfig = newConfig as unknown as DbSyncConfig
    }

    return ok({
      session_token: sessionToken,
      token_prefix: prefix,
      expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      is_new_device: !hasExistingKey,
      sync_config: {
        sync_history: syncConfig?.sync_history ?? true,
        sync_environments: syncConfig?.sync_environments ?? true,
        sync_secrets: syncConfig?.sync_secrets ?? true,
        sync_collections: syncConfig?.sync_collections ?? true,
        sync_settings: syncConfig?.sync_settings ?? true,
      },
    })
  } catch (err: any) {
    console.error('Sync token error:', err.message || err)
    return serverError()
  }
}