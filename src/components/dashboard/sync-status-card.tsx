'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Cloud, CloudOff, RefreshCw } from 'lucide-react'

interface SyncStatusCardProps {
  dataType: string
  isSynced: boolean
  lastUpdated?: string
  itemCount?: number
}

export function SyncStatusCard({ dataType, isSynced, lastUpdated, itemCount }: SyncStatusCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{dataType}</CardTitle>
        {isSynced ? (
          <Badge variant="success" className="gap-1">
            <Cloud className="h-3 w-3" />
            Synced
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <CloudOff className="h-3 w-3" />
            Not Synced
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-xs text-muted-foreground space-y-1">
          {itemCount !== undefined && (
            <div className="flex justify-between">
              <span>Items</span>
              <span className="font-medium text-foreground">{itemCount}</span>
            </div>
          )}
          {lastUpdated && (
            <div className="flex justify-between">
              <span>Last Updated</span>
              <span className="font-medium text-foreground">{lastUpdated}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function SyncStatusLoading() {
  return (
    <Card className="animate-pulse">
      <CardHeader className="pb-2">
        <div className="h-4 w-24 bg-muted rounded" />
      </CardHeader>
      <CardContent>
        <div className="h-3 w-32 bg-muted rounded" />
      </CardContent>
    </Card>
  )
}
