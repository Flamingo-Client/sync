'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Loader2, Save, RotateCcw, History, FileJson, Key, FolderOpen, Settings } from 'lucide-react'

interface SyncConfig {
  sync_history: boolean
  sync_environments: boolean
  sync_secrets: boolean
  sync_collections: boolean
  sync_settings: boolean
}

const configItems = [
  {
    key: 'sync_history' as const,
    label: 'Request History',
    description: 'Sync your API request history across devices',
    icon: History,
  },
  {
    key: 'sync_environments' as const,
    label: 'Environments',
    description: 'Sync environment variables and configurations',
    icon: FileJson,
  },
  {
    key: 'sync_secrets' as const,
    label: 'Secrets',
    description: 'Sync encrypted secrets (API keys, tokens)',
    icon: Key,
  },
  {
    key: 'sync_collections' as const,
    label: 'Collections',
    description: 'Sync your request collections and folders',
    icon: FolderOpen,
  },
  {
    key: 'sync_settings' as const,
    label: 'Settings',
    description: 'Sync app preferences and configuration',
    icon: Settings,
  },
]

export default function SyncSettingsPage() {
  const router = useRouter()
  const [config, setConfig] = useState<SyncConfig>({
    sync_history: true,
    sync_environments: true,
    sync_secrets: true,
    sync_collections: true,
    sync_settings: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/sync/config', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          if (data.data) {
            setConfig({
              sync_history: data.data.sync_history ?? true,
              sync_environments: data.data.sync_environments ?? true,
              sync_secrets: data.data.sync_secrets ?? true,
              sync_collections: data.data.sync_collections ?? true,
              sync_settings: data.data.sync_settings ?? true,
            })
          }
        }
      } catch (err) {
        console.error('Failed to fetch config:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchConfig()
  }, [])

  const saveConfig = async () => {
    setSaving(true)
    setSuccess(false)
    try {
      const res = await fetch('/api/sync/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(config),
      })
      if (res.ok) {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      }
    } catch (err) {
      console.error('Failed to save config:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sync Settings</h1>
        <p className="text-muted-foreground">
          Choose which data types to synchronize across your devices
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Data Types</CardTitle>
          <CardDescription>
            Toggle each category on or off. Disabled categories will not be uploaded
            to the server and existing data will be preserved.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {configItems.map((item) => (
            <div key={item.key}>
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <Label htmlFor={item.key} className="font-medium">
                      {item.label}
                    </Label>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </div>
                <Switch
                  id={item.key}
                  checked={config[item.key]}
                  onCheckedChange={(checked) =>
                    setConfig((prev) => ({ ...prev, [item.key]: checked }))
                  }
                />
              </div>
              <Separator className="mt-4" />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={saveConfig} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Settings
        </Button>
        {success && (
          <Badge variant="success" className="animate-fade-in">
            Settings saved
          </Badge>
        )}
      </div>
    </div>
  )
}
