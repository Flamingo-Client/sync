'use server'

import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  authenticateRequest, generateSessionToken, hashToken,
  ok, unauthorized, serverError,
} from '@/lib/api-utils'

/**
 * POST /api/sync/rotate
 * Rotates the sync session token.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth) return unauthorized()

    const clientToken = extractBearerFromAuth(request)
    if (!clientToken) return unauthorized('Bearer token required for rotation')

    const hash = hashToken(clientToken)

    const supabase = createAdminClient()
    const { data: session } = await supabase
      .from('sync_sessions')
      .select('*')
      .eq('user_id', auth.userId)
      .eq('token_hash', hash)
      .eq('is_active', true)
      .single()

    if (!session) return unauthorized()

    const { token: newToken, hash: newHash, prefix } = generateSessionToken()
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()

    await supabase
      .from('sync_sessions')
      .update({
        token_hash: newHash,
        token_prefix: prefix,
        rotated_at: new Date().toISOString(),
        expires_at: expiresAt,
      })
      .eq('id', session.id)

    await supabase.from('audit_logs').insert({
      user_id: auth.userId,
      event_type: 'token_rotated',
      metadata: { new_prefix: prefix },
    })

    return ok({ session_token: newToken, token_prefix: prefix, expires_at: expiresAt })
  } catch (err) {
    console.error('POST /api/sync/rotate error:', err)
    return serverError()
  }
}

function extractBearerFromAuth(request: NextRequest): string | null {
  const auth = request.headers.get('Authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return null
}