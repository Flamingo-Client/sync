'use client'

import { useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FlaskConical, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { TurnstileWidget, verifyTurnstileToken } from '@/components/ui/turnstile'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileError, setTurnstileError] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const handleVerify = useCallback((t: string) => setTurnstileToken(t), [])
  const handleError = useCallback(() => { setTurnstileError(true); setTurnstileToken(null) }, [])
  const handleExpired = useCallback(() => setTurnstileToken(null), [])

  const resetTurnstile = () => {
    setTurnstileToken(null)
    setTurnstileError(false)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError(authError.message)
        return
      }

      if (!authData.user) {
        setError('Authentication failed')
        return
      }

      if (token) {
        const res = await fetch('/api/sync/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ temp_token: token }),
        })

        if (!res.ok) {
          const data = await res.json()
          setError(data.error || 'Failed to complete sync setup')
          return
        }

        router.push('/dashboard')
      } else {
        router.push('/dashboard')
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async () => {
    setLoading(true)
    setError(null)

    try {
      if (!turnstileToken) {
        setError('Please complete the security verification')
        return
      }

      const verified = await verifyTurnstileToken(turnstileToken)
      if (!verified) {
        setError('Security verification failed. Please try again.')
        resetTurnstile()
        return
      }

      const supabase = createClient()

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: token
            ? `${window.location.origin}/dashboard`
            : `${window.location.origin}/dashboard`,
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        resetTurnstile()
        return
      }

      setError('Check your email for the confirmation link.')
      resetTurnstile()
    } catch {
      setError('An unexpected error occurred')
      resetTurnstile()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md border-none shadow-none sm:border sm:shadow-lg">
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
          <FlaskConical className="h-6 w-6 text-primary-foreground" />
        </div>
        <CardTitle className="text-2xl font-bold">Welcome to Flamingo</CardTitle>
        <CardDescription>
          {token
            ? 'Sign in to sync your desktop client data'
            : 'Sign in to manage your sync settings'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
          </div>
        </form>

        <div className="mt-4 space-y-3">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or create an account</span>
            </div>
          </div>

          <TurnstileWidget
            onVerify={handleVerify}
            onError={handleError}
            onExpired={handleExpired}
          />

          <Button
            type="button"
            variant="outline"
            disabled={loading}
            className="w-full"
            onClick={handleSignUp}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="mr-2 h-4 w-4" />
            )}
            Create Account
          </Button>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          By signing in, you agree to the sync data being stored securely on our servers.
          <br />
          All data is end-to-end encrypted.
        </p>
      </CardContent>
    </Card>
  )
}
