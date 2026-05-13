'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FlaskConical, Loader2, CheckCircle2, XCircle } from 'lucide-react'

function AuthorizeContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'checking' | 'authenticated' | 'error'>('checking')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setError('No authorization token provided.')
      return
    }

    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // User is authenticated, claim the token
        try {
          const res = await fetch('/api/sync/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ temp_token: token }),
          })

          if (res.ok) {
            setStatus('authenticated')
          } else {
            const data = await res.json()
            setStatus('error')
            setError(data.error || 'Failed to complete authorization')
          }
        } catch {
          setStatus('error')
          setError('Network error. Please try again.')
        }
      } else {
        // Not authenticated, redirect to login with token
        router.push(`/login?token=${token}`)
      }
    }

    checkAuth()
  }, [token, router])

  if (status === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <CardTitle>Authorizing Device</CardTitle>
            <CardDescription>Please wait while we verify your session...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (status === 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            </div>
            <CardTitle>Device Authorized!</CardTitle>
            <CardDescription>
              Your Flamingo client has been successfully linked to your account.
              You can close this window and return to the app.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => router.push('/dashboard')}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <XCircle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>Authorization Failed</CardTitle>
          <CardDescription>{error || 'An unexpected error occurred.'}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button variant="outline" onClick={() => router.push('/login')}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AuthorizePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <AuthorizeContent />
    </Suspense>
  )
}
