'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Monitor, Smartphone, Laptop, Trash2, ShieldOff, AlertTriangle, X } from 'lucide-react'
import type { Device } from '@/lib/types'

const deviceIcons: Record<string, typeof Monitor> = {
  desktop: Laptop,
  laptop: Laptop,
  mobile: Smartphone,
  tablet: Smartphone,
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<Device | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDevices = async () => {
    try {
      const res = await fetch('/api/devices', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setDevices(data.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch devices:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDevices()
  }, [])

  const revokeDevice = async (deviceId: string) => {
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/devices/${deviceId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json()
      if (res.ok) {
        setDevices((prev) => prev.filter((d) => d.id !== deviceId))
        setDeleteTarget(null)
      } else {
        setError(data.error || 'Failed to revoke device')
      }
    } catch {
      setError('Failed to revoke device')
    } finally {
      setDeleting(false)
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
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Devices</h1>
        <p className="text-muted-foreground">
          Manage devices connected to your Flamingo sync account
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-destructive/70 hover:text-destructive">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Connected Devices ({devices.length})</CardTitle>
          <CardDescription>
            Devices that have access to your synced data. Revoke access for any
            device you no longer use or recognize.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Monitor className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No devices connected yet</p>
              <p className="text-sm text-muted-foreground">
                Sync your Flamingo client to see devices here
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Seen</TableHead>
                  <TableHead className="w-20">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((device) => {
                  const Icon = deviceIcons[device.device_type] || Monitor
                  return (
                    <TableRow key={device.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          {device.name}
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{device.device_type || 'Unknown'}</TableCell>
                      <TableCell>
                        {device.is_current ? (
                          <Badge variant="success">Current</Badge>
                        ) : device.is_approved ? (
                          <Badge variant="default">Approved</Badge>
                        ) : (
                          <Badge variant="outline">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(device.last_seen_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(device)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          {device.is_current ? (
                            <ShieldOff className="h-4 w-4" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => !deleting && setDeleteTarget(null)}>
          <div
            className="bg-popover border border-border rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Revoke Device</h3>
                <p className="text-xs text-muted-foreground">
                  This action cannot be undone
                </p>
              </div>
            </div>

            <Separator />

            <p className="text-sm text-muted-foreground">
              Are you sure you want to revoke access for{' '}
              <span className="font-medium text-foreground">{deleteTarget.name}</span>?
              This device will lose access to all synced data immediately.
            </p>

            {deleteTarget.is_current && (
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/10 rounded-md px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                This is your current device. Use Disconnect from the app instead.
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => revokeDevice(deleteTarget.id)}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Trash2 className="h-3 w-3 mr-1" />
                )}
                Revoke
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
