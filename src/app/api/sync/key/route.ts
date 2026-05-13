'use server'

import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authenticateRequest, ok, badRequest, unauthorized, serverError } from '@/lib/api-utils'

/**
 * PUT /api/sync/key
 * Stores the master key (raw base64-encoded AES-256 key).
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth) return unauthorized()

    const body = await request.json()
    const { master_key } = body

    if (!master_key) {
      return badRequest('master_key is required')
    }

    const supabase = createAdminClient()

    const { data: existing } = await supabase
      .from('sync_sessions')
      .select('master_key_version')
      .eq('user_id', auth.userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const newVersion = (existing?.master_key_version || 0) + 1

    await supabase
      .from('sync_sessions')
      .update({
        encrypted_master_key: master_key,
        master_key_version: newVersion,
        rotated_at: new Date().toISOString(),
      })
      .eq('user_id', auth.userId)
      .eq('is_active', true)

    await supabase.from('audit_logs').insert({
      user_id: auth.userId,
      event_type: 'key_stored',
      metadata: { version: newVersion, action: existing ? 'rotated' : 'initial' },
    })

    return ok({ version: newVersion }, existing ? 'Master key rotated' : 'Master key stored')
  } catch (err) {
    console.error('PUT /api/sync/key error:', err)
    return serverError()
  }
}

/**
 * GET /api/sync/key
 * Retrieves the master key.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth) return unauthorized()

    const supabase = createAdminClient()
    const { data: session, error } = await supabase
      .from('sync_sessions')
      .select('encrypted_master_key, master_key_version')
      .eq('user_id', auth.userId)
      .eq('is_active', true)
      .not('encrypted_master_key', 'is', null)
      .order('master_key_version', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('GET /api/sync/key error:', error)
      return serverError()
    }

    if (!session?.encrypted_master_key) {
      return ok(null, 'No master key stored yet')
    }

    return ok({
      master_key: session.encrypted_master_key,
      version: session.master_key_version,
    })
  } catch (err) {
    console.error('GET /api/sync/key error:', err)
    return serverError()
  }
}
