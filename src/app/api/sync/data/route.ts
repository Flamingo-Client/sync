'use server'

import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authenticateRequest, ok, unauthorized, serverError } from '@/lib/api-utils'
import type { DbSyncData } from '@/lib/types'

/**
 * GET /api/sync/data
 * Downloads ALL encrypted sync data blobs for the authenticated user.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth) return unauthorized()

    const supabase = createAdminClient()
    const { data: allData, error } = await supabase
      .from('sync_data')
      .select('*')
      .eq('user_id', auth.userId)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch all sync data:', error)
      return serverError()
    }

    const items = (allData || []).map((item: DbSyncData) => ({
      data_type: item.data_type,
      encrypted_blob: item.encrypted_blob,
      nonce: item.nonce,
      version: item.version,
      checksum: item.checksum,
      blob_size_bytes: item.blob_size_bytes,
      updated_at: item.updated_at,
    }))

    return ok({ items, count: items.length })
  } catch (err) {
    console.error('GET /api/sync/data error:', err)
    return serverError()
  }
}