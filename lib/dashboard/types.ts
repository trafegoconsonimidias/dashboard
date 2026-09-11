import type {
  CanonicalField,
  FieldType,
  SheetTransformResult,
} from "@/engine/engine"

export type DashboardRole = "viewer"

export type DashboardMode = "sheet"

export type MetricTileField = CanonicalField | "rowCount" | `metric:${string}`

export type MetricTileVariant =
  | "finance"
  | "conversion"
  | "traffic"
  | "performance"
  | "neutral"

export type MetricTileOverride = {
  id?: string
  source?: string
  field?: MetricTileField
  label?: string
  hint?: string
  variant?: MetricTileVariant
  size?: "default" | "wide"
  enabled?: boolean
}

export type SheetMetricAggregation = "sum" | "average" | "derived"

export type SheetDynamicMetric = {
  id: string
  source: string
  columnIndex: number
  field: CanonicalField | null
  label: string
  metricLabel: string
  groupLabel: string | null
  channelLabel: string | null
  type: FieldType
  value: number
  aggregation: SheetMetricAggregation
}

export type DashboardSource = {
  id: string
  clientId: string
  clientName: string
  clientSlug: string
  role: DashboardRole
  title: string
  sheetId: string
  sheetName: string | null
  rangeA1: string
  refreshSeconds: number
  mode: DashboardMode
  tileConfig: MetricTileOverride[]
}

export type DashboardListItem = {
  id: string
  name: string
  slug: string
  role: DashboardRole
  title: string
  refreshSeconds: number
  isConfigured: boolean
}

export type DashboardViewer = {
  id: string
  name: string
  email: string
  mode: DashboardMode
}

export type DashboardAccessState = {
  status: "ready"
  viewer: DashboardViewer
  dashboards: DashboardListItem[]
  activeSource: DashboardSource | null
  notices: string[]
}

export type SheetTransport = "google-api" | "public-csv" | "sample"

export type SheetFetchResult = {
  values: unknown[][]
  transport: SheetTransport
  sourceLabel: string
}

export type Scorecard = {
  key: string
  sourceField: MetricTileField
  sourceHeader?: string
  groupLabel?: string | null
  channelLabel?: string | null
  label: string
  value: number
  type: FieldType | "integer"
  hint: string
  variant: MetricTileVariant
  size: "default" | "wide"
}

export type TimeSeriesPoint = {
  label: string
  value: number
}

export type RankingPoint = {
  label: string
  value: number
}

export type DashboardTableColumn = {
  key: CanonicalField
  label: string
  type: FieldType
}

export type DashboardTableRow = {
  id: string
  cells: Partial<Record<CanonicalField, string | number | null>>
}

export type DashboardModel = {
  scorecards: Scorecard[]
  timeSeries: {
    metricLabel: string
    metricType: FieldType
    points: TimeSeriesPoint[]
  } | null
  ranking: {
    metricLabel: string
    metricType: FieldType
    points: RankingPoint[]
  } | null
  table: {
    columns: DashboardTableColumn[]
    rows: DashboardTableRow[]
  }
}

export type DashboardSnapshot = {
  status: "ready" | "needs-configuration" | "error"
  fetchedAt: string
  source: DashboardSource
  sheet: {
    transport: SheetTransport
    sourceLabel: string
    rowCount: number
    headerRowIndex: number
    unidentifiedColumns: string[]
    dynamicMetrics: SheetDynamicMetric[]
  }
  transform: SheetTransformResult
  model: DashboardModel
  notices: string[]
  error?: string
}
