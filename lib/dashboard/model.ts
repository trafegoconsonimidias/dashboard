import {
  FIELD_REGISTRY,
  type CanonicalField,
  type FieldDefinition,
  type SheetTransformResult,
} from "@/engine/engine"
import {
  MAX_VISIBLE_METRIC_TILES,
  getMetricTileLabel,
  getMetricTileType,
  getMetricTileValue,
  getOrderedMetricTiles,
  type MetricTileDefinition,
} from "@/lib/dashboard/metric-tiles"
import type {
  DashboardModel,
  DashboardTableColumn,
  DashboardTableRow,
  MetricTileField,
  MetricTileOverride,
  RankingPoint,
  SheetDynamicMetric,
  TimeSeriesPoint,
} from "@/lib/dashboard/types"

const TABLE_FIELDS: CanonicalField[] = [
  "date",
  "campaignName",
  "adSetName",
  "creativeName",
  "audienceName",
  "impressions",
  "reach",
  "linkClicks",
  "leads",
  "purchases",
  "spend",
  "revenue",
  "ctr",
  "cpc",
  "cpl",
  "roas",
]

export function buildDashboardModel(
  transform: SheetTransformResult,
  tileConfig: MetricTileOverride[] = [],
  dynamicMetrics: SheetDynamicMetric[] = []
): DashboardModel {
  const metricTiles = getOrderedMetricTiles(dynamicMetrics, tileConfig)
  const primaryMetric = pickPrimaryMetric(transform, metricTiles)

  return {
    scorecards: buildScorecards(transform, metricTiles),
    timeSeries: primaryMetric ? buildTimeSeries(transform, primaryMetric) : null,
    ranking: primaryMetric ? buildRanking(transform, primaryMetric) : null,
    table: buildTable(transform),
  }
}

function buildScorecards(
  transform: SheetTransformResult,
  metricTiles: MetricTileDefinition[]
) {
  return metricTiles
    .map((tile) => {
      const value =
        typeof tile.value === "number"
          ? tile.value
          : getMetricTileValue(transform.summary, tile.field)

      if (typeof value !== "number" || !Number.isFinite(value)) {
        return null
      }

      return {
        key: tile.id,
        sourceField: tile.field,
        sourceHeader: tile.sourceHeader,
        groupLabel: tile.groupLabel,
        channelLabel: tile.channelLabel,
        label: tile.label ?? getMetricTileLabel(tile.field),
        value,
        type: tile.type ?? getMetricTileType(tile.field),
        hint: tile.hint ?? "Métrica calculada pela engine",
        variant: tile.variant,
        size: tile.size ?? "default",
      }
    })
    .filter((scorecard): scorecard is NonNullable<typeof scorecard> =>
      Boolean(scorecard)
    )
    .slice(0, MAX_VISIBLE_METRIC_TILES)
}

function buildTimeSeries(
  transform: SheetTransformResult,
  metric: FieldDefinition
) {
  const grouped = new Map<string, number>()

  for (const row of transform.rows) {
    if (!row.date) continue

    const value = getRowNumber(row, metric.key)
    if (value === null) continue

    grouped.set(row.date, (grouped.get(row.date) ?? 0) + value)
  }

  const points: TimeSeriesPoint[] = Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, value]) => ({
      label: formatDateLabel(date),
      value,
    }))

  if (points.length < 2) {
    return null
  }

  return {
    metricLabel: metric.label,
    metricType: metric.type,
    points,
  }
}

function buildRanking(
  transform: SheetTransformResult,
  metric: FieldDefinition
) {
  const grouped = new Map<string, number>()

  for (const row of transform.rows) {
    const label =
      row.campaignName ??
      row.adName ??
      row.creativeName ??
      row.audienceName ??
      "Sem identificação"

    const value = getRowNumber(row, metric.key)
    if (value === null) continue

    grouped.set(label, (grouped.get(label) ?? 0) + value)
  }

  const points: RankingPoint[] = Array.from(grouped.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([label, value]) => ({ label, value }))

  if (!points.length) {
    return null
  }

  return {
    metricLabel: metric.label,
    metricType: metric.type,
    points,
  }
}

function buildTable(transform: SheetTransformResult): DashboardModel["table"] {
  const mappedFields = new Set(
    transform.mappings
      .map((mapping) => mapping.target)
      .filter((target): target is CanonicalField => target !== null)
  )

  const columns: DashboardTableColumn[] = TABLE_FIELDS
    .filter((field) => mappedFields.has(field) || hasRowValue(transform, field))
    .map((field) => {
      const definition = getFieldDefinition(field)

      return {
        key: field,
        label: definition?.label ?? field,
        type: definition?.type ?? "string",
      }
    })
    .slice(0, 9)

  const rows: DashboardTableRow[] = [...transform.rows]
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")))
    .slice(0, 12)
    .map((row, index) => ({
      id: `${row.date ?? "row"}-${index}`,
      cells: Object.fromEntries(
        columns.map((column) => [
          column.key,
          (row as unknown as Record<string, string | number | null | undefined>)[
            column.key
          ] ?? null,
        ])
      ) as DashboardTableRow["cells"],
    }))

  return { columns, rows }
}

function pickPrimaryMetric(
  transform: SheetTransformResult,
  metricTiles: MetricTileDefinition[]
) {
  for (const tile of metricTiles) {
    const field = getCanonicalTileField(tile)

    if (!field) continue

    const definition = getFieldDefinition(field)
    const value =
      typeof tile.value === "number"
        ? tile.value
        : getMetricTileValue(transform.summary, tile.field)

    if (
      definition &&
      definition.type !== "date" &&
      definition.type !== "string" &&
      definition.type !== "url" &&
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      return definition
    }
  }

  return null
}

function getCanonicalTileField(tile: MetricTileDefinition): CanonicalField | null {
  if (tile.canonicalField) {
    return tile.canonicalField
  }

  return isCanonicalMetricField(tile.field) ? tile.field : null
}

function isCanonicalMetricField(field: MetricTileField): field is CanonicalField {
  return field !== "rowCount" && !field.startsWith("metric:")
}

function getFieldDefinition(key: CanonicalField) {
  return FIELD_REGISTRY.find((field) => field.key === key)
}

function getRowNumber(row: object, key: CanonicalField): number | null {
  const value = (row as Record<string, unknown>)[key]

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null
  }

  return value
}

function hasRowValue(transform: SheetTransformResult, key: CanonicalField) {
  return transform.rows.some((row) => {
    const value = (row as unknown as Record<string, unknown>)[key]

    return value !== null && value !== undefined && value !== ""
  })
}

function formatDateLabel(date: string) {
  const [year, month, day] = date.split("-")

  if (!year || !month || !day) {
    return date
  }

  return `${day}/${month}`
}
