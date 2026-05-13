import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import { createAdminClient } from './supabase/admin'
import { createSupabaseServerClient } from './supabase/server'
import type { ApiResponse, DbSyncSession } from './types'

// ====== Response Helpers ======

export function ok<T>(data: T, message?: string): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data, message }, { status: 200 })
}

export function created<T>(data: T): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data }, { status: 201 })
}

export function badRequest(error: string): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, error }, { status: 400 })
}

export function unauthorized(error = 'Unauthorized'): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, error }, { status: 401 })
}

export function forbidden(error = 'Forbidden'): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, error }, { status: 403 })
}

export function notFound(error = 'Not found'): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, error }, { status: 404 })
}

export function serverError(error = 'Internal server error'): NextResponse<ApiResponse> {
  console.error('Server error:', error)
  return NextResponse.json({ success: false, error }, { status: 500 })
}

// ====== Token Authentication ======

const TOKEN_PREFIX = 'flm_sync_'
const TOKEN_PREFIX_LENGTH = 8
const TOKEN_SECRET_LENGTH = 64

export function generateTempToken(): string {
  return `flm_temp_${randomBytes(32).toString('hex')}`
}

export function generateSessionToken(): {
  token: string
  hash: string
  prefix: string
} {
  const secret = randomBytes(TOKEN_SECRET_LENGTH).toString('hex')
  const token = `${TOKEN_PREFIX}${secret}`
  const hash = hashToken(token)
  const prefix = token.slice(0, TOKEN_PREFIX_LENGTH + TOKEN_PREFIX_LENGTH)
  return { token, hash, prefix }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function validateTokenFormat(token: string): boolean {
  return token.startsWith('flm_sync_') || token.startsWith('flm_temp_')
}

/**
 * Authenticate a request using the sync session token (Bearer auth).
 */
export async function authenticateSession(
  token: string | null
): Promise<DbSyncSession | null> {
  if (!token || !validateTokenFormat(token)) return null

  const hash = hashToken(token)
  const supabase = createAdminClient()

  const { data: session, error } = await supabase
    .from('sync_sessions')
    .select('*')
    .eq('token_hash', hash)
    .eq('is_active', true)
    .single()

  if (error || !session) return null
  if (session.expires_at && new Date(session.expires_at) < new Date()) {
    await supabase.from('sync_sessions').update({ is_active: false }).eq('id', session.id)
    return null
  }

  await supabase
    .from('sync_sessions')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', session.id)

  return session as unknown as DbSyncSession
}

/**
 * Extract Bearer token from Authorization header.
 */
export function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get('Authorization')
  if (!auth || !auth.startsWith('Bearer ')) return null
  return auth.slice(7)
}

/**
 * Authenticate a request using EITHER:
 *  1. Bearer token (sync client)
 *  2. Supabase cookie session (web dashboard)
 *
 * Returns null if neither succeeds.
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<{ userId: string } | null> {
  // Try Bearer token first (sync client / Electron)
  const bearer = extractBearerToken(request)
  if (bearer) {
    const session = await authenticateSession(bearer)
    if (session) return { userId: session.user_id }
  }

  // Fall back to cookie auth (web dashboard / browser)
  try {
    const serverSupabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await serverSupabase.auth.getUser()
    if (user) return { userId: user.id }
  } catch {
    // Cookie auth unavailable in this context
  }

  return null
}

/**
 * Extract Bearer token from Authorization header only.
 * Does NOT fall back to cookies.
 */
export async function authenticateBearerOnly(
  request: NextRequest
): Promise<{ userId: string } | null> {
  const bearer = extractBearerToken(request)
  if (!bearer) return null
  const session = await authenticateSession(bearer)
  if (session) return { userId: session.user_id }
  return null
}