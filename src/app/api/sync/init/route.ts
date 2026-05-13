import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateTempToken, ok, badRequest, serverError } from '@/lib/api-utils'

/**
 * POST /api/sync/init
 *
 * Initiates the sync authorization flow (device authorization grant).
 * Called by the Flamingo Electron client to get a temporary token.
 *
 * The client then opens a browser to /login?token={temp_token} for the
 * user to authenticate and authorize the device.
 *
 * Request body (optional):
 *   { device_name?: string, device_type?: string }
 *
 * Response:
 *   { temp_token: string, login_url: string, expires_in: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { device_name, device_type } = body

    const token = generateTempToken()
    const expiresIn = 5 * 60 // 5 minutes
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

    const supabase = createAdminClient()
    const { error } = await supabase.from('sync_temp_tokens').insert({
      token,
      status: 'pending',
      expires_at: expiresAt,
    })

    if (error) {
      console.error('Failed to create temp token:', error)
      return serverError('Failed to initialize sync')
    }

    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

    // Store device info for when the token is claimed
    // Use metadata column or a separate field

    return ok({
      temp_token: token,
      login_url: `${serverUrl}/login?token=${token}`,
      expires_in: expiresIn,
    })
  } catch (err) {
    console.error('Sync init error:', err)
    return serverError()
  }
}
