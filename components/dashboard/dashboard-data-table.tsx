import { Table2Icon } from "lucide-react"

import { EmptyPanel } from "@/components/dashboard/empty-state"
import { formatMetric } from "@/lib/dashboard/format"
import type { CanonicalRow, FieldType } from "@/engine/engine"
import type { DashboardSnapshot } from "@/lib/dashboard/types"

type GroupDimension = "campaignName" | "audienceName" | "adName"

type AggregateRow = {
  label: string
  spend: number
  impressions: number
  clicks: number
  landingPageViews: number
  leads: number
  cpm: number | null
  ctr: number | null
  conversionRate: number | null
  cpl: number | null
}

const TABLES: Array<{ title: string; field: GroupDimension; label: string }> = [
  { title: "Campanhas", field: "campaignName", label: "Campanha" },
  { title: "Públicos", field: "audienceName", label: "Público" },
  { title: "Anúncios", field: "adName", label: "Anúncio" },
]

const METRIC_COLUMNS: Array<{
  key: keyof AggregateRow
  label: string
  type: FieldType
  tone: string
}> = [
  { key: "spend", label: "Investimento", type: "currency", tone: "bg-blue-500/12" },
  { key: "cpm", label: "CPM", type: "currency", tone: "bg-orange-400/16" },
  { key: "ctr", label: "CTR", type: "percentage", tone: "bg-violet-500/14" },
  { key: "leads", label: "Leads", type: "number", tone: "bg-lime-500/16" },
  { key: "conversionRate", label: "Taxa de Conversão", type: "percentage", tone: "bg-cyan-500/16" },
  { key: "cpl", label: "CPL", type: "currency", tone: "bg-yellow-400/24" },
]

export function DashboardDataTable({ snapshot }: { snapshot: DashboardSnapshot }) {
  return (
    <div className="space-y-4">
      {TABLES.map((table) => (
        <AggregateTable
          key={table.field}
          title={table.title}
          dimensionLabel={table.label}
          rows={aggregateRows(snapshot.transform.rows, table.field)}
        />
      ))}
    </div>
  )
}

function AggregateTable({
  title,
  dimensionLabel,
  rows,
}: {
  title: string
  dimensionLabel: string
  rows: AggregateRow[]
}) {
  const totals = summarizeRows(rows, "Total geral")

  return (
    <section className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-normal">{title}</h2>
          <p className="text-sm text-muted-foreground">
            {rows.length ? `${rows.length} agrupamento(s)` : "Sem dados mapeados"}
          </p>
        </div>
        <Table2Icon className="size-5 text-muted-foreground" />
      </div>

      {rows.length ? (
        <div className="overflow-x-auto px-4 pb-4">
          <table className="w-full min-w-[960px] table-fixed text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="w-10 px-3 py-3 font-medium">#</th>
                <th className="w-[260px] px-3 py-3 font-medium">{dimensionLabel}</th>
                {METRIC_COLUMNS.map((column) => (
                  <th key={column.key} className="px-3 py-3 text-right font-medium">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <MetricRow key={row.label} row={row} index={index + 1} />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t text-sm font-semibold">
                <td className="px-3 py-4" />
                <td className="px-3 py-4">Total geral</td>
                {METRIC_COLUMNS.map((column) => (
                  <td key={column.key} className="px-3 py-4 text-right">
                    {formatAggregateValue(totals[column.key], column.type)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="p-4 pt-0">
          <EmptyPanel message={`Nenhuma linha com ${dimensionLabel.toLowerCase()} mapeado.`} />
        </div>
      )}
    </section>
  )
}

function MetricRow({ row, index }: { row: AggregateRow; index: number }) {
  return (
    <tr className="border-b last:border-b-0">
      <td className="px-3 py-3 text-muted-foreground">{index}.</td>
      <td className="px-3 py-3">
        <span className="line-clamp-2 break-words font-medium">{row.label}</span>
      </td>
      {METRIC_COLUMNS.map((column) => (
        <td key={column.key} className={`px-3 py-3 text-right ${column.tone}`}>
          {formatAggregateValue(row[column.key], column.type)}
        </td>
      ))}
    </tr>
  )
}

function aggregateRows(rows: CanonicalRow[], dimension: GroupDimension) {
  const grouped = new Map<string, AggregateRow>()

  for (const row of rows) {
    const label = String(row[dimension] ?? "").trim()
    if (!label) continue

    const current = grouped.get(label) ?? emptyAggregate(label)
    current.spend += getNumber(row.spend)
    current.impressions += getNumber(row.impressions)
    current.clicks += getNumber(row.linkClicks ?? row.clicks)
    current.landingPageViews += getNumber(row.landingPageViews)
    current.leads += getNumber(row.leads)
    grouped.set(label, current)
  }

  return Array.from(grouped.values())
    .map(deriveAggregateMetrics)
    .sort((a, b) => b.leads - a.leads || b.spend - a.spend)
    .slice(0, 20)
}

function summarizeRows(rows: AggregateRow[], label: string) {
  return deriveAggregateMetrics(
    rows.reduce(
      (total, row) => ({
        ...total,
        spend: total.spend + row.spend,
        impressions: total.impressions + row.impressions,
        clicks: total.clicks + row.clicks,
        landingPageViews: total.landingPageViews + row.landingPageViews,
        leads: total.leads + row.leads,
      }),
      emptyAggregate(label)
    )
  )
}

function deriveAggregateMetrics(row: AggregateRow): AggregateRow {
  return {
    ...row,
    cpm: safeDivide(row.spend, row.impressions, 1000),
    ctr: safeDivide(row.clicks, row.impressions, 100),
    conversionRate: safeDivide(row.leads, row.landingPageViews || row.clicks, 100),
    cpl: safeDivide(row.spend, row.leads),
  }
}

function emptyAggregate(label: string): AggregateRow {
  return {
    label,
    spend: 0,
    impressions: 0,
    clicks: 0,
    landingPageViews: 0,
    leads: 0,
    cpm: null,
    ctr: null,
    conversionRate: null,
    cpl: null,
  }
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function safeDivide(numerator: number, denominator: number, multiplier = 1) {
  return denominator > 0 ? (numerator / denominator) * multiplier : null
}

function formatAggregateValue(value: unknown, type: FieldType) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-"
  }

  return formatMetric(value, type)
}