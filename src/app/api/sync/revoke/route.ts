'use server'

import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authenticateRequest, ok, unauthorized, serverError } from '@/lib/api-utils'

/**
 * POST /api/sync/revoke
 * Revokes the current sync session token.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth) return unauthorized()

    const bearer = extractBearerFromAuth(request)
    if (!bearer) return unauthorized('Bearer token required')

    const supabase = createAdminClient()
    const { data: session } = await supabase
      .from('sync_sessions')
      .select('id, token_hash')
      .eq('user_id', auth.userId)
      .eq('is_active', true)
      .single()

    if (!session) return unauthorized()

    // Invalidate the session
    await supabase
      .from('sync_sessions')
      .update({ is_active: false })
      .eq('id', session.id)

    await supabase.from('devices').update({
      is_current: false,
      is_approved: false,
    }).eq('user_id', auth.userId).eq('is_current', true)

    await supabase.from('audit_logs').insert({
      user_id: auth.userId,
      event_type: 'token_revoked',
    })

    return ok(null, 'Session revoked')
  } catch (err) {
    console.error('POST /api/sync/revoke error:', err)
    return serverError()
  }
}

function extractBearerFromAuth(request: NextRequest): string | null {
  const auth = request.headers.get('Authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return null
}