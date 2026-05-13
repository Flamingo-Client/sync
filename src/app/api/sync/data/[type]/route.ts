'use server'

import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authenticateRequest, ok, badRequest, unauthorized, notFound, serverError } from '@/lib/api-utils'

const VALID_DATA_TYPES = ['history', 'environment', 'secret', 'collection', 'setting']

/**
 * GET /api/sync/data/[type]
 * Downloads encrypted blob for a specific data type.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params
    if (!VALID_DATA_TYPES.includes(type)) {
      return badRequest(`Invalid data type. Valid: ${VALID_DATA_TYPES.join(', ')}`)
    }

    const auth = await authenticateRequest(request)
    if (!auth) return unauthorized()

    const supabase = createAdminClient()
    const { data: syncData, error } = await supabase
      .from('sync_data')
      .select('*')
      .eq('user_id', auth.userId)
      .eq('data_type', type)
      .maybeSingle()

    if (error) {
      console.error('Failed to fetch sync data:', error)
      return serverError()
    }

    if (!syncData) return notFound(`No data for type: ${type}`)

    return ok({
      id: syncData.id,
      data_type: syncData.data_type,
      encrypted_blob: syncData.encrypted_blob,
      nonce: syncData.nonce,
      version: syncData.version,
      checksum: syncData.checksum,
      blob_size_bytes: syncData.blob_size_bytes,
      updated_at: syncData.updated_at,
    })
  } catch (err) {
    console.error('GET /api/sync/data/[type] error:', err)
    return serverError()
  }
}

/**
 * PUT /api/sync/data/[type]
 * Uploads encrypted blob.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params
    if (!VALID_DATA_TYPES.includes(type)) {
      return badRequest(`Invalid data type. Valid: ${VALID_DATA_TYPES.join(', ')}`)
    }

    const auth = await authenticateRequest(request)
    if (!auth) return unauthorized()

    const body = await request.json()
    const { encrypted_blob, nonce, checksum } = body

    if (!encrypted_blob || !nonce) return badRequest('encrypted_blob and nonce are required')
    if (typeof encrypted_blob !== 'string' || typeof nonce !== 'string') {
      return badRequest('encrypted_blob and nonce must be strings')
    }

    const supabase = createAdminClient()

    const { data: existing } = await supabase
      .from('sync_data')
      .select('version')
      .eq('user_id', auth.userId)
      .eq('data_type', type)
      .maybeSingle()

    const newVersion = (existing?.version || 0) + 1
    const blobSize = Math.ceil((encrypted_blob.length * 3) / 4)

    const { error: upsertError } = await supabase.from('sync_data').upsert(
      {
        user_id: auth.userId,
        data_type: type,
        encrypted_blob,
        nonce,
        version: newVersion,
        checksum: checksum || null,
        blob_size_bytes: blobSize,
      },
      { onConflict: 'user_id, data_type', ignoreDuplicates: false }
    )

    if (upsertError) {
      console.error('Failed to upsert sync data:', upsertError)
      return serverError()
    }

    await supabase.from('sync_events').insert({
      user_id: auth.userId,
      event_type: 'data_updated',
      data_type: type,
    })

    return ok(
      { data_type: type, version: newVersion, blob_size_bytes: blobSize },
      'Sync data uploaded'
    )
  } catch (err) {
    console.error('PUT /api/sync/data/[type] error:', err)
    return serverError()
  }
}

/**
 * DELETE /api/sync/data/[type]
 * Clears synced data for a type.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params
    if (!VALID_DATA_TYPES.includes(type)) return badRequest('Invalid data type')

    const auth = await authenticateRequest(request)
    if (!auth) return unauthorized()

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('sync_data')
      .delete()
      .eq('user_id', auth.userId)
      .eq('data_type', type)

    if (error) {
      console.error('Failed to delete sync data:', error)
      return serverError()
    }

    await supabase.from('audit_logs').insert({
      user_id: auth.userId,
      event_type: 'data_cleared',
      metadata: { data_type: type },
    })

    return ok(null, `Synced ${type} cleared`)
  } catch (err) {
    console.error('DELETE /api/sync/data/[type] error:', err)
    return serverError()
  }
}