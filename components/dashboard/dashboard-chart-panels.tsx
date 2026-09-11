import { BarChart3Icon, LineChartIcon } from "lucide-react"

import { EmptyPanel } from "@/components/dashboard/empty-state"
import { formatMetric } from "@/lib/dashboard/format"
import type { DashboardSnapshot, RankingPoint, Scorecard } from "@/lib/dashboard/types"

export function DashboardChartPanels({
  snapshot,
}: {
  snapshot: DashboardSnapshot
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.85fr)]">
      <TimeSeriesPanel snapshot={snapshot} />
      <RankingPanel
        metricLabel={snapshot.model.ranking?.metricLabel}
        metricType={snapshot.model.ranking?.metricType}
        points={snapshot.model.ranking?.points ?? []}
      />
    </div>
  )
}

function TimeSeriesPanel({ snapshot }: { snapshot: DashboardSnapshot }) {
  const series = snapshot.model.timeSeries

  return (
    <section className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-normal">Evolução</h2>
          <p className="text-sm text-muted-foreground">
            {series?.metricLabel ?? "Sem métrica temporal"}
          </p>
        </div>
        <LineChartIcon className="size-5 text-muted-foreground" />
      </div>

      {series ? (
        <div className="h-72">
          <LineChart points={series.points} type={series.metricType} />
        </div>
      ) : (
        <EmptyPanel message="Inclua uma coluna de data e uma métrica numérica." />
      )}
    </section>
  )
}

function LineChart({
  points,
  type,
}: {
  points: { label: string; value: number }[]
  type: Scorecard["type"]
}) {
  const values = points.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const svgPoints = points
    .map((point, index) => {
      const x = points.length === 1 ? 0 : (index / (points.length - 1)) * 100
      const y = 86 - ((point.value - min) / range) * 72
      return `${x},${y}`
    })
    .join(" ")

  return (
    <div className="flex h-full flex-col">
      <svg
        className="h-full min-h-0 w-full text-foreground"
        role="img"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <line x1="0" x2="100" y1="86" y2="86" className="stroke-border" />
        <line x1="0" x2="100" y1="50" y2="50" className="stroke-border/70" />
        <line x1="0" x2="100" y1="14" y2="14" className="stroke-border/70" />
        <polyline
          points={svgPoints}
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
        {points.slice(-4).map((point) => (
          <div key={point.label} className="min-w-0 rounded-md bg-muted px-2 py-1">
            <span className="block truncate">{point.label}</span>
            <span className="font-medium text-foreground">
              {formatMetric(point.value, type)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RankingPanel({
  metricLabel,
  metricType = "number",
  points,
}: {
  metricLabel?: string
  metricType?: Scorecard["type"]
  points: RankingPoint[]
}) {
  const max = Math.max(...points.map((point) => point.value), 1)

  return (
    <section className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-normal">Ranking</h2>
          <p className="text-sm text-muted-foreground">
            {metricLabel ? `Por ${metricLabel.toLowerCase()}` : "Sem dados"}
          </p>
        </div>
        <BarChart3Icon className="size-5 text-muted-foreground" />
      </div>

      {points.length ? (
        <div className="space-y-4">
          {points.map((point) => (
            <div key={point.label} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium">{point.label}</span>
                <span className="shrink-0 text-muted-foreground">
                  {formatMetric(point.value, metricType)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-foreground"
                  style={{ width: `${Math.max(4, (point.value / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyPanel message="Inclua campanha, anúncio ou criativo com métrica numérica." />
      )}
    </section>
  )
}
