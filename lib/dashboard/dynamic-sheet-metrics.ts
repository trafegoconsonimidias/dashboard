import {
  FIELD_REGISTRY,
  normalizeHeader,
  parseNumber,
  type CanonicalField,
  type FieldType,
  type SheetTransformResult,
} from "@/engine/engine"
import type {
  SheetDynamicMetric,
  SheetMetricAggregation,
} from "@/lib/dashboard/types"

type DynamicMetricDraft = Omit<
  SheetDynamicMetric,
  "aggregation" | "value"
> & {
  dimensionKey: string
  rowValues: Array<number | null>
}

const EXTRA_FIELD_ALIASES: Partial<Record<CanonicalField, string[]>> = {
  purchases: ["venda", "vendas", "total vendas", "vendas totais"],
  revenue: [
    "receita estimada",
    "receita estimada ads",
    "receita estimada por ads",
    "receita por ads",
  ],
  spend: [
    "investimento total",
    "total investimento",
    "investimento ads",
    "investimento em ads",
  ],
}

const SUM_AGGREGATION_FIELDS = new Set<CanonicalField>([
  "impressions",
  "reach",
  "clicks",
  "linkClicks",
  "outboundClicks",
  "landingPageViews",
  "videoViews25",
  "videoViews50",
  "videoViews75",
  "videoViews95",
  "videoViews100",
  "pageEngagement",
  "postEngagement",
  "engagements",
  "results",
  "leads",
  "conversions",
  "purchases",
  "spend",
  "revenue",
])

const DERIVED_AGGREGATION_FIELDS = new Set<CanonicalField>([
  "frequency",
  "ctr",
  "cpc",
  "cpm",
  "cpl",
  "cpa",
  "roas",
])

export function extractDynamicSheetMetrics(
  matrix: unknown[][],
  transform: SheetTransformResult
): SheetDynamicMetric[] {
  if (!Array.isArray(matrix) || !transform.headers.length) {
    return []
  }

  const dataRows = matrix
    .slice(transform.headerRowIndex + 1)
    .filter((row): row is unknown[] => Array.isArray(row) && !isDataRowEmpty(row))
  const usedIds = new Map<string, number>()
  const drafts = transform.headers
    .map((source, columnIndex) =>
      buildDynamicMetricDraft(source, columnIndex, dataRows, usedIds)
    )
    .filter((metric): metric is DynamicMetricDraft => metric !== null)

  return drafts.map((draft) => {
    const summary = summarizeDraft(draft, drafts)

    return {
      id: draft.id,
      source: draft.source,
      columnIndex: draft.columnIndex,
      field: draft.field,
      label: draft.label,
      metricLabel: draft.metricLabel,
      groupLabel: draft.groupLabel,
      channelLabel: draft.channelLabel,
      type: draft.type,
      value: summary.value,
      aggregation: summary.aggregation,
    }
  })
}

function buildDynamicMetricDraft(
  source: string,
  columnIndex: number,
  dataRows: unknown[][],
  usedIds: Map<string, number>
): DynamicMetricDraft | null {
  const parsed = parseStructuredHeader(source)
  const field = matchMetricField(parsed.metricLabel) ?? matchMetricField(source)

  if (field === "date") {
    return null
  }

  const definition = field
    ? FIELD_REGISTRY.find((current) => current.key === field)
    : undefined
  const inferredType = inferDynamicColumnType(
    dataRows.map((row) => row[columnIndex])
  )
  const type = definition?.type ?? inferredType

  if (
    type === "unknown" ||
    type === "string" ||
    type === "date" ||
    type === "url"
  ) {
    return null
  }

  const rowValues = dataRows.map((row) => parseNumber(row[columnIndex]))

  if (!rowValues.some((value) => typeof value === "number")) {
    return null
  }

  const sourceLabel = cleanLabel(source)
  const metricLabel =
    cleanLabel(parsed.metricLabel) || definition?.label || sourceLabel
  const label = buildMetricLabel(parsed, metricLabel, sourceLabel)

  return {
    id: buildUniqueId(sourceLabel, parsed, metricLabel, columnIndex, usedIds),
    source: sourceLabel,
    columnIndex,
    field,
    label,
    metricLabel,
    groupLabel: parsed.groupLabel,
    channelLabel: parsed.channelLabel,
    type,
    dimensionKey: buildDimensionKey(parsed.groupLabel, parsed.channelLabel),
    rowValues,
  }
}

function summarizeDraft(
  draft: DynamicMetricDraft,
  drafts: DynamicMetricDraft[]
): { value: number; aggregation: SheetMetricAggregation } {
  if (draft.field && DERIVED_AGGREGATION_FIELDS.has(draft.field)) {
    const derived = deriveMetricValue(draft, drafts)

    if (typeof derived === "number") {
      return {
        value: derived,
        aggregation: "derived",
      }
    }

    return {
      value: averageValues(draft.rowValues),
      aggregation: "average",
    }
  }

  if (!draft.field || SUM_AGGREGATION_FIELDS.has(draft.field)) {
    return {
      value: sumValues(draft.rowValues),
      aggregation: "sum",
    }
  }

  return {
    value: averageValues(draft.rowValues),
    aggregation: "average",
  }
}

function deriveMetricValue(
  draft: DynamicMetricDraft,
  drafts: DynamicMetricDraft[]
): number | null {
  if (!draft.field) {
    return null
  }

  switch (draft.field) {
    case "frequency":
      return safeDivide(
        getRelatedMetricValue(draft, drafts, ["impressions"]),
        getRelatedMetricValue(draft, drafts, ["reach"])
      )

    case "ctr":
      return safeDivide(
        getRelatedMetricValue(draft, drafts, [
          "linkClicks",
          "outboundClicks",
          "clicks",
        ]),
        getRelatedMetricValue(draft, drafts, ["impressions"]),
        100
      )

    case "cpc":
      return safeDivide(
        getRelatedMetricValue(draft, drafts, ["spend"]),
        getRelatedMetricValue(draft, drafts, [
          "linkClicks",
          "outboundClicks",
          "clicks",
        ])
      )

    case "cpm":
      return safeDivide(
        getRelatedMetricValue(draft, drafts, ["spend"]),
        getRelatedMetricValue(draft, drafts, ["impressions"]),
        1000
      )

    case "cpl":
      return safeDivide(
        getRelatedMetricValue(draft, drafts, ["spend"]),
        getRelatedMetricValue(draft, drafts, ["leads"])
      )

    case "cpa":
      return safeDivide(
        getRelatedMetricValue(draft, drafts, ["spend"]),
        getRelatedMetricValue(draft, drafts, [
          "purchases",
          "conversions",
          "results",
        ])
      )

    case "roas":
      return safeDivide(
        getRelatedMetricValue(draft, drafts, ["revenue"]),
        getRelatedMetricValue(draft, drafts, ["spend"])
      )

    default:
      return null
  }
}

function getRelatedMetricValue(
  draft: DynamicMetricDraft,
  drafts: DynamicMetricDraft[],
  fields: CanonicalField[]
): number | undefined {
  const exact = drafts.find(
    (candidate) =>
      candidate.id !== draft.id &&
      candidate.dimensionKey === draft.dimensionKey &&
      candidate.field !== null &&
      fields.includes(candidate.field)
  )

  if (exact) {
    return sumValues(exact.rowValues)
  }

  if (draft.channelLabel || !draft.groupLabel) {
    return undefined
  }

  const grouped = drafts.filter(
    (candidate) =>
      candidate.id !== draft.id &&
      normalizeHeader(candidate.groupLabel ?? "") ===
        normalizeHeader(draft.groupLabel ?? "") &&
      candidate.field !== null &&
      fields.includes(candidate.field)
  )

  if (!grouped.length) {
    return undefined
  }

  return grouped.reduce<number>(
    (total, candidate) => total + sumValues(candidate.rowValues),
    0
  )
}

function parseStructuredHeader(source: string) {
  const parts = Array.from(source.matchAll(/\[([^\]]+)\]/g))
    .map((match) => cleanLabel(match[1]))
    .filter(Boolean)
  const metricLabel = source.replace(/\[[^\]]+\]/g, " ")

  return {
    groupLabel: parts[0] ?? null,
    channelLabel: parts.length > 1 ? parts.slice(1).join(" / ") : null,
    metricLabel: cleanLabel(metricLabel),
  }
}

function buildMetricLabel(
  parsed: ReturnType<typeof parseStructuredHeader>,
  metricLabel: string,
  sourceLabel: string
) {
  const parts = [
    parsed.groupLabel,
    parsed.channelLabel,
    metricLabel,
  ].filter((part): part is string => Boolean(part))

  return parts.length ? parts.join(" - ") : sourceLabel
}

function buildUniqueId(
  sourceLabel: string,
  parsed: ReturnType<typeof parseStructuredHeader>,
  metricLabel: string,
  columnIndex: number,
  usedIds: Map<string, number>
) {
  const base = slugify(
    [
      parsed.groupLabel,
      parsed.channelLabel,
      metricLabel || sourceLabel || `coluna-${columnIndex + 1}`,
    ]
      .filter(Boolean)
      .join(" ")
  )
  const idBase = `col-${base || `coluna-${columnIndex + 1}`}`
  const count = usedIds.get(idBase) ?? 0

  usedIds.set(idBase, count + 1)

  return count ? `${idBase}-${count + 1}` : idBase
}

function matchMetricField(value: string): CanonicalField | null {
  const normalized = normalizeHeader(value)

  if (!normalized) {
    return null
  }

  for (const field of FIELD_REGISTRY) {
    for (const alias of getAliases(field.key, field.aliases)) {
      if (normalized === normalizeHeader(alias)) {
        return field.key
      }
    }
  }

  let best: { field: CanonicalField; score: number } | null = null

  for (const field of FIELD_REGISTRY) {
    for (const alias of getAliases(field.key, field.aliases)) {
      const score = tokenSimilarity(normalized, alias)

      if (!best || score > best.score) {
        best = { field: field.key, score }
      }
    }
  }

  return best && best.score >= 0.72 ? best.field : null
}

function getAliases(field: CanonicalField, aliases: string[]) {
  return [...aliases, ...(EXTRA_FIELD_ALIASES[field] ?? [])]
}

function inferDynamicColumnType(values: unknown[]): FieldType | "unknown" {
  const sample = values.filter((value) => !isEmpty(value)).slice(0, 20)

  if (!sample.length) {
    return "unknown"
  }

  const dateRate = sample.filter(looksLikeDate).length / sample.length
  if (dateRate >= 0.7) {
    return "date"
  }

  const currencyRate =
    sample.filter(
      (value) =>
        typeof value === "string" &&
        /(R\$|US\$|\$|€|£)/i.test(String(value))
    ).length / sample.length
  if (currencyRate >= 0.4) {
    return "currency"
  }

  const percentageRate =
    sample.filter(
      (value) => typeof value === "string" && String(value).includes("%")
    ).length / sample.length
  if (percentageRate >= 0.7) {
    return "percentage"
  }

  const numberRate =
    sample.filter((value) => parseNumber(value) !== null).length / sample.length

  return numberRate >= 0.7 ? "number" : "string"
}

function tokenSimilarity(a: string, b: string): number {
  const aa = tokenize(a)
  const bb = tokenize(b)

  if (!aa.size || !bb.size) return 0

  let intersection = 0
  for (const token of aa) {
    if (bb.has(token)) intersection++
  }

  const union = new Set([...aa, ...bb]).size
  const jaccard = union ? intersection / union : 0
  const na = normalizeHeader(a)
  const nb = normalizeHeader(b)
  let containment = 0

  if (na.includes(nb) || nb.includes(na)) {
    const shorter = Math.min(na.length, nb.length)
    const longer = Math.max(na.length, nb.length)
    containment = longer ? shorter / longer : 0
  }

  return Math.max(jaccard, containment)
}

function tokenize(value: string): Set<string> {
  return new Set(
    normalizeHeader(value)
      .split(" ")
      .filter((token) => token.length > 1)
  )
}

function safeDivide(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
  multiplier = 1
): number | null {
  if (
    numerator === null ||
    numerator === undefined ||
    denominator === null ||
    denominator === undefined ||
    denominator === 0
  ) {
    return null
  }

  return (numerator / denominator) * multiplier
}

function sumValues(values: Array<number | null>): number {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0)
}

function averageValues(values: Array<number | null>): number {
  const numericValues = values.filter(
    (value): value is number => typeof value === "number"
  )

  if (!numericValues.length) {
    return 0
  }

  return (
    numericValues.reduce<number>((total, value) => total + value, 0) /
    numericValues.length
  )
}

function buildDimensionKey(
  groupLabel: string | null,
  channelLabel: string | null
) {
  return `${normalizeHeader(groupLabel ?? "")}|${normalizeHeader(channelLabel ?? "")}`
}

function isEmpty(value: unknown) {
  return value === null || value === undefined || String(value).trim() === ""
}

function isDataRowEmpty(row: unknown[]) {
  return !row.some((cell) => !isEmpty(cell))
}

function looksLikeDate(value: unknown) {
  if (typeof value !== "string") return false

  const text = value.trim()

  return (
    /^\d{4}-\d{1,2}-\d{1,2}$/.test(text) ||
    /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(text)
  )
}

function cleanLabel(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim()
}

function slugify(value: string) {
  return normalizeHeader(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
