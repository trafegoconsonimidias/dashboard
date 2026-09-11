import {
  FIELD_REGISTRY,
  normalizeHeader,
  type CanonicalField,
  type FieldType,
  type SheetSummary,
} from "@/engine/engine"
import type {
  MetricTileField,
  MetricTileOverride,
  MetricTileVariant,
  SheetDynamicMetric,
} from "@/lib/dashboard/types"

export type MetricTileDefinition = {
  id: string
  field: MetricTileField
  canonicalField?: CanonicalField
  sourceHeader?: string
  groupLabel?: string | null
  channelLabel?: string | null
  label?: string
  hint?: string
  variant: MetricTileVariant
  size?: "default" | "wide"
  enabled?: boolean
  value?: number
  type?: FieldType | "integer"
}

export const DASHBOARD_METRIC_TILES: MetricTileDefinition[] = [
  {
    id: "receita",
    field: "revenue",
    canonicalField: "revenue",
    label: "Receita",
    hint: "Soma da receita informada na planilha",
    variant: "finance",
    size: "wide",
  },
  {
    id: "investimento",
    field: "spend",
    canonicalField: "spend",
    label: "Investimento",
    hint: "Soma do investimento informado",
    variant: "finance",
  },
  {
    id: "roas",
    field: "roas",
    canonicalField: "roas",
    label: "ROAS",
    hint: "Receita dividida por investimento",
    variant: "performance",
  },
  {
    id: "leads",
    field: "leads",
    canonicalField: "leads",
    label: "Leads",
    hint: "Total de leads capturados",
    variant: "conversion",
  },
  {
    id: "compras",
    field: "purchases",
    canonicalField: "purchases",
    label: "Compras",
    hint: "Total de compras ou pedidos",
    variant: "conversion",
  },
  {
    id: "cpl",
    field: "cpl",
    canonicalField: "cpl",
    label: "CPL",
    hint: "Custo médio por lead",
    variant: "performance",
  },
  {
    id: "cliques-link",
    field: "linkClicks",
    canonicalField: "linkClicks",
    label: "Cliques no link",
    hint: "Cliques de link mapeados pela engine",
    variant: "traffic",
  },
  {
    id: "ctr",
    field: "ctr",
    canonicalField: "ctr",
    label: "CTR",
    hint: "Taxa de clique calculada sobre impressões",
    variant: "traffic",
  },
  {
    id: "impressoes",
    field: "impressions",
    canonicalField: "impressions",
    label: "Impressões",
    hint: "Total de impressões",
    variant: "traffic",
  },
  {
    id: "registros",
    field: "rowCount",
    label: "Registros",
    hint: "Linhas úteis encontradas na planilha",
    variant: "neutral",
  },
]

export const MAX_VISIBLE_METRIC_TILES = 32

const VALID_VARIANTS: MetricTileVariant[] = [
  "finance",
  "conversion",
  "traffic",
  "performance",
  "neutral",
]

export function getOrderedMetricTiles(
  dynamicMetrics: SheetDynamicMetric[] = [],
  overrides: MetricTileOverride[] = []
): MetricTileDefinition[] {
  const candidates = buildMetricTileCandidates(dynamicMetrics)
  const remaining = new Map(candidates.map((definition) => [definition.id, definition]))
  const ordered: MetricTileDefinition[] = []

  for (const override of overrides) {
    const base = resolveOverrideBase(override, candidates)

    if (!base) {
      continue
    }

    remaining.delete(base.id)

    const merged = mergeMetricTileDefinition(base, override)

    if (merged.enabled !== false) {
      ordered.push(merged)
    }
  }

  return [
    ...ordered,
    ...Array.from(remaining.values()),
  ].filter((tile) => tile.enabled !== false)
}

export function normalizeMetricTileConfig(value: unknown): MetricTileOverride[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item): MetricTileOverride | null => {
      if (!item || typeof item !== "object") {
        return null
      }

      const raw = item as Record<string, unknown>
      const id = getOptionalString(raw.id)
      const source = getOptionalString(raw.source)
      const field = isMetricTileField(raw.field) ? raw.field : undefined

      if (!id && !source && !field) {
        return null
      }

      const override: MetricTileOverride = {}
      const label = getOptionalString(raw.label)
      const hint = getOptionalString(raw.hint)

      if (id) override.id = id
      if (source) override.source = source
      if (field) override.field = field
      if (label) override.label = label
      if (hint) override.hint = hint
      if (isMetricTileVariant(raw.variant)) override.variant = raw.variant
      if (raw.size === "wide" || raw.size === "default") override.size = raw.size
      if (typeof raw.enabled === "boolean") override.enabled = raw.enabled

      return override
    })
    .filter((item): item is MetricTileOverride => item !== null)
}

export function getMetricTileValue(
  summary: SheetSummary,
  field: MetricTileField
) {
  if (field === "rowCount") {
    return summary.rowCount
  }

  if (field.startsWith("metric:")) {
    return undefined
  }

  return (summary as unknown as Record<string, unknown>)[field]
}

export function getMetricTileType(field: MetricTileField): FieldType | "integer" {
  if (field === "rowCount") {
    return "integer"
  }

  if (field.startsWith("metric:")) {
    return "number"
  }

  return (
    FIELD_REGISTRY.find((definition) => definition.key === field)?.type ??
    "number"
  )
}

export function getMetricTileLabel(field: MetricTileField) {
  if (field === "rowCount") {
    return "Registros"
  }

  if (field.startsWith("metric:")) {
    return field.replace(/^metric:/, "")
  }

  return FIELD_REGISTRY.find((definition) => definition.key === field)?.label ?? field
}

function buildMetricTileCandidates(
  dynamicMetrics: SheetDynamicMetric[]
): MetricTileDefinition[] {
  const dynamicTiles = dynamicMetrics.map(dynamicMetricToTile)

  if (!dynamicTiles.length) {
    return DASHBOARD_METRIC_TILES
  }

  return [...dynamicTiles, ...DASHBOARD_METRIC_TILES]
}

function dynamicMetricToTile(metric: SheetDynamicMetric): MetricTileDefinition {
  const tile: MetricTileDefinition = {
    id: metric.id,
    field: `metric:${metric.id}`,
    sourceHeader: metric.source,
    groupLabel: metric.groupLabel,
    channelLabel: metric.channelLabel,
    label: metric.label,
    hint: buildDynamicMetricHint(metric),
    variant: getMetricVariant(metric.field, metric.type),
    size: "default",
    value: metric.value,
    type: metric.type,
  }

  if (metric.field) {
    tile.canonicalField = metric.field
  }

  return tile
}

function resolveOverrideBase(
  override: MetricTileOverride,
  candidates: MetricTileDefinition[]
) {
  if (override.source) {
    const source = normalizeHeader(override.source)
    const bySource = candidates.find(
      (candidate) =>
        candidate.sourceHeader &&
        normalizeHeader(candidate.sourceHeader) === source
    )

    if (bySource) {
      return bySource
    }
  }

  if (override.id) {
    const byId = candidates.find((candidate) => candidate.id === override.id)

    if (byId) {
      return byId
    }
  }

  if (override.field) {
    return candidates.find((candidate) => candidate.field === override.field)
  }

  return null
}

function mergeMetricTileDefinition(
  base: MetricTileDefinition,
  override: MetricTileOverride
): MetricTileDefinition {
  return {
    ...base,
    id: override.id ?? base.id,
    field: override.field ?? base.field,
    canonicalField:
      override.field && isCanonicalField(override.field)
        ? override.field
        : base.canonicalField,
    label: override.label ?? base.label,
    hint: override.hint ?? base.hint,
    variant: normalizeVariant(override.variant ?? base.variant),
    size: normalizeSize(override.size ?? base.size),
    enabled: override.enabled ?? base.enabled,
  }
}

function buildDynamicMetricHint(metric: SheetDynamicMetric) {
  const aggregationLabel =
    metric.aggregation === "derived"
      ? "calculado"
      : metric.aggregation === "average"
        ? "média"
        : "soma"

  return `${aggregationLabel} de ${metric.source}`
}

function getMetricVariant(
  field: CanonicalField | null,
  type: FieldType
): MetricTileVariant {
  if (type === "currency" || field === "spend" || field === "revenue") {
    return "finance"
  }

  if (
    field === "leads" ||
    field === "purchases" ||
    field === "conversions" ||
    field === "results"
  ) {
    return "conversion"
  }

  if (
    field === "impressions" ||
    field === "reach" ||
    field === "clicks" ||
    field === "linkClicks" ||
    field === "outboundClicks" ||
    field === "landingPageViews"
  ) {
    return "traffic"
  }

  if (
    field === "roas" ||
    field === "ctr" ||
    field === "cpc" ||
    field === "cpm" ||
    field === "cpl" ||
    field === "cpa" ||
    field === "frequency"
  ) {
    return "performance"
  }

  return "neutral"
}

function normalizeVariant(value: MetricTileVariant | undefined) {
  return value && VALID_VARIANTS.includes(value) ? value : "neutral"
}

function normalizeSize(value: "default" | "wide" | undefined) {
  return value ?? "default"
}

function isMetricTileField(value: unknown): value is MetricTileField {
  return (
    value === "rowCount" ||
    (typeof value === "string" &&
      (value.startsWith("metric:") ||
        FIELD_REGISTRY.some((definition) => definition.key === value)))
  )
}

function isCanonicalField(value: MetricTileField): value is CanonicalField {
  return FIELD_REGISTRY.some((definition) => definition.key === value)
}

function isMetricTileVariant(value: unknown): value is MetricTileVariant {
  return typeof value === "string" && VALID_VARIANTS.includes(value as MetricTileVariant)
}

function getOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}
