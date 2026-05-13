'use server'

import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { extractBearerToken, authenticateSession, ok, badRequest, unauthorized, serverError } from '@/lib/api-utils'
import type { DbSyncConfig } from '@/lib/types'

/**
 * POST /api/sync/claim
 *
 * Claims a temp sync token for the currently authenticated user.
 * Called from the BROWSER after the user logs in (cookies are set).
 * Electron polls /api/sync/token instead.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { temp_token } = body

    if (!temp_token) {
      return badRequest('temp_token is required')
    }

    // ── Authenticate via cookies (browser) OR bearer (Electron) ──
    let userId: string | null = null
    try {
      const serverSupabase = await createSupabaseServerClient()
      const { data: { user } } = await serverSupabase.auth.getUser()
      if (user) userId = user.id
    } catch { }

    // Fallback: bearer token
    if (!userId) {
      const bearer = extractBearerToken(request)
      if (bearer) {
        const session = await authenticateSession(bearer)
        if (session) userId = session.user_id
      }
    }

    if (!userId) {
      return unauthorized('You must be logged in to claim a sync token')
    }

    const supabase = createAdminClient()

    // Verify temp token
    const { data: tempToken, error: tokenError } = await supabase
      .from('sync_temp_tokens')
      .select('*')
      .eq('token', temp_token)
      .single()

    if (tokenError || !tempToken) {
      return badRequest('Invalid token')
    }

    if (new Date(tempToken.expires_at) < new Date()) {
      await supabase
        .from('sync_temp_tokens')
        .update({ status: 'expired' })
        .eq('id', tempToken.id)
      return badRequest('Token has expired')
    }

    // Already claimed by this user? Idempotent success.
    if (tempToken.user_id === userId && tempToken.status === 'claimed') {
      return ok(null, 'Token already claimed')
    }

    // Prevent another user from claiming
    if (tempToken.status === 'claimed' && tempToken.user_id !== userId) {
      return badRequest('Token already claimed by another user')
    }

    // Claim
    await supabase
      .from('sync_temp_tokens')
      .update({
        status: 'claimed',
        user_id: userId,
        claimed_at: new Date().toISOString(),
      })
      .eq('id', tempToken.id)

    await supabase.from('audit_logs').insert({
      user_id: userId,
      event_type: 'token_claimed',
      metadata: { temp_token_prefix: tempToken.token.slice(0, 16) },
    })

    return ok(null, 'Token claimed successfully')
  } catch (err: any) {
    console.error('Sync claim error:', err.message || err)
    return serverError(err.message || 'Claim failed')
  }
}