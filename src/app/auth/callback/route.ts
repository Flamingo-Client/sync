import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  const token = searchParams.get('token')

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=Missing auth code`)
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${error.message}`)
  }

  // If there's a sync token, go through the authorize flow to claim it
  const redirectUrl = token
    ? `${origin}/sync/authorize?token=${token}`
    : `${origin}${next}`
  return NextResponse.redirect(redirectUrl)
}
