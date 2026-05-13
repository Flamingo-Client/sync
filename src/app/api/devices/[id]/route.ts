'use server'

import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authenticateRequest, ok, notFound, unauthorized, serverError } from '@/lib/api-utils'

/**
 * DELETE /api/devices/[id]
 * Revokes a device's access (cannot revoke the current device).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await authenticateRequest(request)
    if (!auth) return unauthorized()

    const supabase = createAdminClient()

    // Get the device
    const { data: device } = await supabase
      .from('devices')
      .select('*')
      .eq('id', id)
      .eq('user_id', auth.userId)
      .single()

    if (!device) return notFound('Device not found')

    if (device.session_id) {
      await supabase.from('sync_sessions').update({ is_active: false }).eq('id', device.session_id)
    }

    await supabase.from('devices').delete().eq('id', id)

    await supabase.from('audit_logs').insert({
      user_id: auth.userId,
      event_type: 'device_revoked',
      metadata: { device_id: id, device_name: device.name },
    })

    await supabase.from('sync_events').insert({
      user_id: auth.userId,
      event_type: 'device_revoked',
    })

    return ok(null, 'Device revoked')
  } catch (err) {
    console.error('DELETE /api/devices/[id] error:', err)
    return serverError()
  }
}