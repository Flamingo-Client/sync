'use client'

import { useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: TurnstileOptions) => string
      reset: (widgetId: string) => void
      getResponse: (widgetId: string) => string | undefined
      remove: (widgetId: string) => void
    }
  }
}

interface TurnstileOptions {
  sitekey: string
  callback?: (token: string) => void
  'error-callback'?: () => void
  'expired-callback'?: () => void
  theme?: 'light' | 'dark' | 'auto'
  size?: 'normal' | 'compact'
}

interface TurnstileWidgetProps {
  onVerify: (token: string) => void
  onError?: () => void
  onExpired?: () => void
  theme?: 'light' | 'dark' | 'auto'
  size?: 'normal' | 'compact'
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''

export function TurnstileWidget({
  onVerify,
  onError,
  onExpired,
  theme = 'auto',
  size = 'normal',
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!SITE_KEY || !containerRef.current) return

    const renderWidget = () => {
      if (!window.turnstile || !containerRef.current) return
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        callback: onVerify,
        'error-callback': onError,
        'expired-callback': onExpired,
        theme,
        size,
      })
    }

    if (window.turnstile) {
      renderWidget()
    } else {
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
      script.async = true
      script.defer = true
      script.onload = renderWidget
      document.head.appendChild(script)
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
      }
    }
  }, [onVerify, onError, onExpired, theme, size])

  if (!SITE_KEY) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-md bg-amber-500/10 p-3 text-xs text-amber-600">
        <Loader2 className="h-3 w-3 animate-spin" />
        Turnstile not configured (missing site key)
      </div>
    )
  }

  return (
    <div className="flex justify-center">
      <div ref={containerRef} />
    </div>
  )
}

export async function verifyTurnstileToken(token: string): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/verify-turnstile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const data = await res.json()
    return data.success === true
  } catch {
    return false
  }
}
