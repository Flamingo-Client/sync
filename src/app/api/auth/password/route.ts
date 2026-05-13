'use server'

import { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ok, badRequest, unauthorized, serverError } from '@/lib/api-utils'

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { current_password, new_password } = body

    if (!current_password || !new_password) {
      return badRequest('current_password and new_password are required')
    }

    if (new_password.length < 6) {
      return badRequest('New password must be at least 6 characters')
    }

    const serverSupabase = await createSupabaseServerClient()

    const {
      data: { user },
      error: userError,
    } = await serverSupabase.auth.getUser()

    if (userError || !user) {
      return unauthorized('Not authenticated')
    }

    const { error: updateError } = await serverSupabase.auth.updateUser({
      password: new_password,
    })

    if (updateError) {
      console.error('Password update error:', updateError)
      return badRequest(updateError.message || 'Failed to update password')
    }

    return ok(null, 'Password updated successfully')
  } catch (err) {
    console.error('PUT /api/auth/password error:', err)
    return serverError()
  }
}
