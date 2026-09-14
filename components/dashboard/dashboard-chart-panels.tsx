import { BarChart3Icon, LineChartIcon } from "lucide-react"

import { EmptyPanel } from "@/components/dashboard/empty-state"
import { formatMetric, formatShortDate } from "@/lib/dashboard/format"
import type { CanonicalRow } from "@/engine/engine"
import type { DashboardSnapshot } from "@/lib/dashboard/types"

export function DashboardChartPanels({
  snapshot,
}: {
  snapshot: DashboardSnapshot
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <FunnelPanel snapshot={snapshot} />
      <LeadCostPanel rows={snapshot.transform.rows} />
    </div>
  )
}

function FunnelPanel({ snapshot }: { snapshot: DashboardSnapshot }) {
  const summary = snapshot.transform.summary
  const impressions = getNumber(summary.impressions)
  const clicks = getNumber(summary.linkClicks ?? summary.clicks)
  const leads = getNumber(summary.leads)
  const spend = getNumber(summary.spend)
  const max = Math.max(impressions, clicks, leads, 1)
  const ctr = safeDivide(clicks, impressions, 100)
  const conversionRate = safeDivide(leads, clicks, 100)
  const cpm = safeDivide(spend, impressions, 1000)
  const cpc = safeDivide(spend, clicks)
  const cpl = safeDivide(spend, leads)

  return (
    <section className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-normal">Funil de Métricas</h2>
          <p className="text-sm text-muted-foreground">Etapas, taxas e custos</p>
        </div>
        <BarChart3Icon className="size-5 text-muted-foreground" />
      </div>

      {impressions || clicks || leads ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_180px]">
          <div className="space-y-3">
            <FunnelBar label="Impressões" value={impressions} max={max} />
            <FunnelBar label="Cliques" value={clicks} max={max} />
            <FunnelBar label="Leads" value={leads} max={max} />
          </div>
          <div className="grid gap-2 text-sm">
            <MiniMetric label="CPM" value={cpm} type="currency" />
            <MiniMetric label="CTR" value={ctr} type="percentage" />
            <MiniMetric label="CPC" value={cpc} type="currency" />
            <MiniMetric label="Taxa de Conversão" value={conversionRate} type="percentage" />
            <MiniMetric label="CPL" value={cpl} type="currency" />
          </div>
        </div>
      ) : (
        <EmptyPanel message="Inclua impressões, cliques e leads para montar o funil." />
      )}
    </section>
  )
}

function FunnelBar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = Math.max(8, (value / max) * 100)

  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="h-11 rounded-md bg-muted">
        <div
          className="flex h-full items-center rounded-md bg-foreground px-4 text-sm font-medium text-background"
          style={{ width: `${width}%` }}
        >
          {formatMetric(value, "number")}
        </div>
      </div>
    </div>
  )
}

function MiniMetric({
  label,
  value,
  type,
}: {
  label: string
  value: number | null
  type: "currency" | "percentage"
}) {
  return (
    <div className="rounded-md border bg-background px-3 py-2">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold">
        {value === null ? "-" : formatMetric(value, type)}
      </p>
    </div>
  )
}

function LeadCostPanel({ rows }: { rows: CanonicalRow[] }) {
  const points = buildLeadCostPoints(rows)
  const maxLead = Math.max(...points.map((point) => point.leads), 1)
  const maxCpl = Math.max(...points.map((point) => point.cpl ?? 0), 1)

  return (
    <section className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-normal">Lead x Custo por Lead</h2>
          <p className="text-sm text-muted-foreground">Leads e CPL por data</p>
        </div>
        <LineChartIcon className="size-5 text-muted-foreground" />
      </div>

      {points.length ? (
        <div className="space-y-3">
          <div className="grid h-64 grid-cols-6 items-end gap-3 border-b border-l px-3 pb-3">
            {points.slice(-6).map((point) => (
              <div key={point.date} className="flex h-full min-w-0 flex-col justify-end gap-2">
                <span className="text-center text-xs font-medium text-rose-600">
                  {point.cpl === null ? "-" : formatMetric(point.cpl, "currency")}
                </span>
                <div
                  className="mx-auto w-8 rounded-t bg-blue-500"
                  style={{ height: `${Math.max(8, (point.leads / maxLead) * 64)}%` }}
                  title={`${point.leads} leads`}
                />
                <div
                  className="mx-auto h-1 w-full rounded-full bg-rose-500"
                  style={{ opacity: Math.max(0.25, ((point.cpl ?? 0) / maxCpl) * 0.9) }}
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-3 xl:grid-cols-6">
            {points.slice(-6).map((point) => (
              <div key={point.date} className="rounded-md bg-muted px-2 py-1">
                <span className="block truncate">{formatShortDate(point.date)}</span>
                <span className="font-medium text-foreground">{formatMetric(point.leads, "number")}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyPanel message="Inclua data, investimento e leads para acompanhar CPL." />
      )}
    </section>
  )
}

function buildLeadCostPoints(rows: CanonicalRow[]) {
  const grouped = new Map<string, { date: string; spend: number; leads: number; cpl: number | null }>()

  for (const row of rows) {
    if (!row.date) continue
    const current = grouped.get(row.date) ?? { date: row.date, spend: 0, leads: 0, cpl: null }
    current.spend += getNumber(row.spend)
    current.leads += getNumber(row.leads)
    grouped.set(row.date, current)
  }

  return Array.from(grouped.values())
    .map((point) => ({ ...point, cpl: safeDivide(point.spend, point.leads) }))
    .filter((point) => point.leads > 0 || point.spend > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function safeDivide(numerator: number, denominator: number, multiplier = 1) {
  return denominator > 0 ? (numerator / denominator) * multiplier : null
}