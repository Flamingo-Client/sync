'use server'

import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authenticateRequest, ok, badRequest, unauthorized, serverError } from '@/lib/api-utils'

/**
 * GET /api/sync/config
 * Returns sync configuration for the authenticated user.
 * Auth: Cookie (dashboard) or Bearer token (sync client)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth) return unauthorized()

    const supabase = createAdminClient()
    const { data: config, error } = await supabase
      .from('sync_configs')
      .select('*')
      .eq('user_id', auth.userId)
      .maybeSingle()

    if (error) {
      console.error('Failed to fetch config:', error)
      return serverError()
    }

    if (!config) {
      const { data: newConfig, error: createError } = await supabase
        .from('sync_configs')
        .insert({ user_id: auth.userId })
        .select()
        .single()

      if (createError) return serverError()
      return ok({
        sync_history: newConfig.sync_history,
        sync_environments: newConfig.sync_environments,
        sync_secrets: newConfig.sync_secrets,
        sync_collections: newConfig.sync_collections,
        sync_settings: newConfig.sync_settings,
        updated_at: newConfig.updated_at,
      })
    }

    return ok({
      sync_history: config.sync_history,
      sync_environments: config.sync_environments,
      sync_secrets: config.sync_secrets,
      sync_collections: config.sync_collections,
      sync_settings: config.sync_settings,
      updated_at: config.updated_at,
    })
  } catch (err) {
    console.error('GET /api/sync/config error:', err)
    return serverError()
  }
}

/**
 * PUT /api/sync/config
 * Updates sync preferences.
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth) return unauthorized()

    const body = await request.json()
    const allowedFields = [
      'sync_history', 'sync_environments', 'sync_secrets',
      'sync_collections', 'sync_settings',
    ]

    const updates: Record<string, boolean> = {}
    for (const field of allowedFields) {
      if (typeof body[field] === 'boolean') updates[field] = body[field]
    }
    if (Object.keys(updates).length === 0) return badRequest('No valid fields to update')

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('sync_configs')
      .upsert(
        { user_id: auth.userId, ...updates, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )

    if (error) {
      console.error('Failed to update config:', error)
      return serverError()
    }

    await supabase.from('audit_logs').insert({
      user_id: auth.userId,
      event_type: 'config_updated',
      metadata: { updates },
    })

    return ok(updates, 'Configuration updated')
  } catch (err) {
    console.error('PUT /api/sync/config error:', err)
    return serverError()
  }
}