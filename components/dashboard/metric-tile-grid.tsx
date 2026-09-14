import { formatMetric } from "@/lib/dashboard/format"
import type { Scorecard } from "@/lib/dashboard/types"

export function MetricTileGrid({ scorecards }: { scorecards: Scorecard[] }) {
  return (
    <section className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="grid min-h-24 grid-cols-2 items-center gap-px overflow-hidden sm:grid-cols-3 lg:grid-cols-6">
        {scorecards.slice(0, 6).map((scorecard) => (
          <MetricTile key={scorecard.key} scorecard={scorecard} />
        ))}
      </div>
    </section>
  )
}

function MetricTile({ scorecard }: { scorecard: Scorecard }) {
  return (
    <div
      className="flex h-full min-h-24 flex-col items-center justify-center bg-background px-4 py-3 text-center"
      title={scorecard.sourceHeader}
    >
      <p className="line-clamp-1 text-[11px] font-medium uppercase tracking-normal text-muted-foreground">
        {scorecard.label}
      </p>
      <p className="mt-1 break-words text-lg font-medium tracking-normal text-foreground lg:text-xl">
        {formatMetric(scorecard.value, scorecard.type)}
      </p>
    </div>
  )
}