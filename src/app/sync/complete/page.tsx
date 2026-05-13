'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Loader2 } from 'lucide-react'

function SyncCompleteContent() {
  const searchParams = useSearchParams()
  const status = searchParams.get('status')
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    if (status === 'success') {
      const timer = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(timer)
            window.close()
          }
          return c - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [status])

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      {status === 'success' ? (
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <CardTitle className="text-xl">Sync Connected!</CardTitle>
            <CardDescription>
              Your Flamingo client is now synced with your account.
              This window will close automatically in {countdown} seconds.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => window.close()}>
              Close Now
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <CardTitle>Completing Setup...</CardTitle>
            <CardDescription>Please wait while we finalize your sync configuration.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  )
}

export default function SyncCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <SyncCompleteContent />
    </Suspense>
  )
}
