import { BarChart3Icon } from "lucide-react"

import { formatMetric } from "@/lib/dashboard/format"
import type { Scorecard } from "@/lib/dashboard/types"

export function MetricTileGrid({ scorecards }: { scorecards: Scorecard[] }) {
  return (
    <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {scorecards.map((scorecard) => (
        <MetricTile key={scorecard.key} scorecard={scorecard} />
      ))}
    </div>
  )
}

function MetricTile({ scorecard }: { scorecard: Scorecard }) {
  return (
    <div
      className={[
        "flex min-h-40 flex-col justify-between rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm",
        scorecard.size === "wide" ? "xl:col-span-2" : "",
      ].join(" ")}
      title={scorecard.sourceHeader}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 break-words text-sm leading-5 text-muted-foreground">
            {scorecard.label}
          </p>
          <p className="mt-3 break-words text-2xl font-semibold tracking-normal text-foreground sm:text-3xl">
            {formatMetric(scorecard.value, scorecard.type)}
          </p>
        </div>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground">
          <BarChart3Icon className="size-4" />
        </div>
      </div>
      <p className="mt-5 line-clamp-2 break-words text-xs text-muted-foreground">
        {scorecard.hint}
      </p>
    </div>
  )
}
