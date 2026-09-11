"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2Icon, RefreshCwIcon } from "lucide-react"

import { DashboardChartPanels } from "@/components/dashboard/dashboard-chart-panels"
import { DashboardDataTable } from "@/components/dashboard/dashboard-data-table"
import { DashboardNotices } from "@/components/dashboard/dashboard-notices"
import { DashboardStatus } from "@/components/dashboard/dashboard-status"
import { EmptyState } from "@/components/dashboard/empty-state"
import { MetricTileGrid } from "@/components/dashboard/metric-tile-grid"
import { Button } from "@/components/ui/button"
import type {
  DashboardListItem,
  DashboardSnapshot,
} from "@/lib/dashboard/types"

type DashboardClientProps = {
  activeClientSlug: string | null
  dashboards: DashboardListItem[]
  initialSnapshot: DashboardSnapshot | null
  notices: string[]
}

export function DashboardClient({
  activeClientSlug,
  dashboards,
  initialSnapshot,
  notices,
}: DashboardClientProps) {
  const router = useRouter()
  const [snapshot, setSnapshot] = React.useState(initialSnapshot)
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const [clientError, setClientError] = React.useState<string | null>(null)

  const selectedSlug =
    snapshot?.source.clientSlug ?? activeClientSlug ?? dashboards[0]?.slug ?? null
  const activeDashboard = dashboards.find(
    (dashboard) => dashboard.slug === selectedSlug
  )
  const refreshSeconds =
    snapshot?.source.refreshSeconds ?? activeDashboard?.refreshSeconds ?? 15

  const refresh = React.useCallback(async () => {
    if (!selectedSlug) return

    setIsRefreshing(true)
    setClientError(null)

    try {
      const response = await fetch(
        `/api/dashboards/${encodeURIComponent(selectedSlug)}`,
        { cache: "no-store" }
      )
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error ?? "Falha ao atualizar dashboard.")
      }

      setSnapshot(payload as DashboardSnapshot)
    } catch (error) {
      setClientError(
        error instanceof Error ? error.message : "Falha ao atualizar dashboard."
      )
    } finally {
      setIsRefreshing(false)
    }
  }, [selectedSlug])

  React.useEffect(() => {
    if (!selectedSlug) return

    const timer = window.setInterval(refresh, refreshSeconds * 1000)
    return () => window.clearInterval(timer)
  }, [refresh, refreshSeconds, selectedSlug])

  if (!dashboards.length) {
    return (
      <EmptyState
        title="Nenhuma planilha configurada"
        description="Configure GOOGLE_SHEETS_ID para ler os dados do Google Sheets."
      />
    )
  }

  const allNotices = uniqueStrings([
    ...notices,
    ...(snapshot?.notices ?? []),
    ...(clientError ? [clientError] : []),
    ...(snapshot?.error ? [snapshot.error] : []),
  ])

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 pt-0 lg:p-6 lg:pt-0">
      <div className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <DashboardStatus snapshot={snapshot} isRefreshing={isRefreshing} />
          <div>
            <h1 className="text-2xl font-semibold tracking-normal text-foreground lg:text-3xl">
              {snapshot?.source.title ?? activeDashboard?.title ?? "Dashboard"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {snapshot?.source.clientName ?? activeDashboard?.name}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {dashboards.length > 1 ? (
            <>
              <label className="sr-only" htmlFor="client-dashboard">
                Planilha
              </label>
              <select
                id="client-dashboard"
                value={selectedSlug ?? ""}
                onChange={(event) => {
                  router.push(`/dashboard?cliente=${encodeURIComponent(event.target.value)}`)
                }}
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {dashboards.map((dashboard) => (
                  <option key={dashboard.slug} value={dashboard.slug}>
                    {dashboard.name}
                  </option>
                ))}
              </select>
            </>
          ) : null}
          <Button onClick={refresh} disabled={isRefreshing || !selectedSlug}>
            {isRefreshing ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <RefreshCwIcon />
            )}
            Atualizar
          </Button>
        </div>
      </div>

      <DashboardNotices notices={allNotices} />

      {snapshot ? (
        <>
          <MetricTileGrid scorecards={snapshot.model.scorecards} />
          <DashboardChartPanels snapshot={snapshot} />
          <DashboardDataTable snapshot={snapshot} />
        </>
      ) : (
        <EmptyState
          title="Dashboard não encontrado"
          description="Verifique a configuração da planilha e tente atualizar novamente."
        />
      )}
    </div>
  )
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}
