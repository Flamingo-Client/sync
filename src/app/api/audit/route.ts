'use server'

import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authenticateRequest, ok, unauthorized, serverError } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth) return unauthorized()

    const supabase = createAdminClient()
    const { data: logs, error } = await supabase
      .from('audit_logs')
      .select('id, event_type, ip_address, metadata, created_at')
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('GET /api/audit error:', error)
      return serverError()
    }

    return ok(logs || [])
  } catch (err) {
    console.error('GET /api/audit error:', err)
    return serverError()
  }
}
