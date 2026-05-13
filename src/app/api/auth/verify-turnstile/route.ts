'use server'

import { NextRequest } from 'next/server'
import { ok, badRequest, serverError } from '@/lib/api-utils'

const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY || ''

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = body

    if (!token) {
      return badRequest('Token is required')
    }

    if (!TURNSTILE_SECRET) {
      console.error('TURNSTILE_SECRET_KEY is not configured')
      return badRequest('Turnstile is not configured on the server')
    }

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: TURNSTILE_SECRET,
        response: token,
      }),
    })

    const data = await res.json()

    if (!data.success) {
      console.error('Turnstile verification failed:', data['error-codes'])
      return ok({ success: false }, 'Verification failed')
    }

    return ok({ success: true }, 'Verified')
  } catch (err) {
    console.error('POST /api/auth/verify-turnstile error:', err)
    return serverError()
  }
}
