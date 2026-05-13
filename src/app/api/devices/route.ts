'use server'

import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authenticateRequest, ok, unauthorized, serverError } from '@/lib/api-utils'

/**
 * GET /api/devices
 * Lists all devices connected to the user's account.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth) return unauthorized()

    const supabase = createAdminClient()
    const { data: devices, error } = await supabase
      .from('devices')
      .select('id, name, device_type, is_approved, is_current, last_seen_at, created_at')
      .eq('user_id', auth.userId)
      .order('last_seen_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch devices:', error)
      return serverError()
    }

    return ok(devices || [])
  } catch (err) {
    console.error('GET /api/devices error:', err)
    return serverError()
  }
}