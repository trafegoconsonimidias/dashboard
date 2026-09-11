"use client"

import {
  AlertCircleIcon,
  ClockIcon,
  DatabaseIcon,
  Loader2Icon,
  ShieldCheckIcon,
} from "lucide-react"

import { formatDateTime } from "@/lib/dashboard/format"
import type { DashboardSnapshot } from "@/lib/dashboard/types"

export function DashboardStatus({
  snapshot,
  isRefreshing,
}: {
  snapshot: DashboardSnapshot | null
  isRefreshing: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <StatusBadge snapshot={snapshot} isRefreshing={isRefreshing} />
      <span className="inline-flex items-center gap-1">
        <ClockIcon className="size-3.5" />
        {formatDateTime(snapshot?.fetchedAt)}
      </span>
      <span className="inline-flex items-center gap-1">
        <DatabaseIcon className="size-3.5" />
        {snapshot?.sheet.sourceLabel ?? "sem fonte"}
      </span>
    </div>
  )
}

function StatusBadge({
  snapshot,
  isRefreshing,
}: {
  snapshot: DashboardSnapshot | null
  isRefreshing: boolean
}) {
  if (isRefreshing) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
        <Loader2Icon className="size-3 animate-spin" />
        Atualizando
      </span>
    )
  }

  if (snapshot?.status === "error") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
        <AlertCircleIcon className="size-3" />
        Erro
      </span>
    )
  }

  if (snapshot?.status === "needs-configuration") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
        <AlertCircleIcon className="size-3" />
        Configuração pendente
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
      <ShieldCheckIcon className="size-3" />
      Online
    </span>
  )
}
