'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SyncStatusCard, SyncStatusLoading } from '@/components/dashboard/sync-status-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Cloud, Monitor, Shield } from 'lucide-react'

const dataTypes = ['history', 'environments', 'secrets', 'collections', 'settings'] as const

interface SyncState {
  [key: string]: {
    synced: boolean
    lastUpdated?: string
    itemCount?: number
  }
}

export default function DashboardOverview() {
  const [syncState, setSyncState] = useState<SyncState>({})
  const [deviceCount, setDeviceCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState<string>('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) setUserEmail(user.email || '')

        // Fetch sync config
        const configRes = await fetch('/api/sync/config', {
          credentials: 'include',
        })
        if (configRes.ok) {
          const configData = await configRes.json()
          const state: SyncState = {}
          for (const dt of dataTypes) {
            const key = dt === 'environments' ? 'sync_environments' :
                        dt === 'secrets' ? 'sync_secrets' :
                        dt === 'collections' ? 'sync_collections' :
                        dt === 'settings' ? 'sync_settings' : 'sync_history'
            state[dt] = {
              synced: configData.data?.[key] ?? true,
            }
          }
          setSyncState(state)
        }

        // Fetch devices
        const devicesRes = await fetch('/api/devices', {
          credentials: 'include',
        })
        if (devicesRes.ok) {
          const devicesData = await devicesRes.json()
          setDeviceCount(devicesData.data?.length || 0)
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Overview</h1>
          <p className="text-muted-foreground">Loading your sync status...</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {dataTypes.map((dt) => (
            <SyncStatusLoading key={dt} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-muted-foreground">
          Welcome back, {userEmail}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Sync Status</CardTitle>
            <Cloud className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.values(syncState).filter((s) => s.synced).length}/{dataTypes.length}
            </div>
            <p className="text-xs text-muted-foreground">data types synced</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Connected Devices</CardTitle>
            <Monitor className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deviceCount}</div>
            <p className="text-xs text-muted-foreground">active devices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Encryption</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant="success">AES-256-GCM</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">end-to-end encrypted</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Sync Categories</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {dataTypes.map((dt) => (
            <SyncStatusCard
              key={dt}
              dataType={dt.charAt(0).toUpperCase() + dt.slice(1)}
              isSynced={syncState[dt]?.synced ?? false}
              lastUpdated={syncState[dt]?.lastUpdated}
              itemCount={syncState[dt]?.itemCount}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
