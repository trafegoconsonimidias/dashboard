import {
  buildSheetSummary,
  normalizeHeader,
  transformSheet,
  type CanonicalRow,
  type SheetTransformResult,
} from "@/engine/engine"
import { extractDynamicSheetMetrics } from "@/lib/dashboard/dynamic-sheet-metrics"
import { fetchSheetValues } from "@/lib/dashboard/google-sheets"
import { getDashboardFieldAliases } from "@/lib/dashboard/mappers"
import { buildDashboardModel } from "@/lib/dashboard/model"
import type {
  DashboardSheetSource,
  DashboardSheetStatus,
  DashboardSnapshot,
  DashboardSource,
  SheetDynamicMetric,
  SheetFetchResult,
  SheetTransport,
} from "@/lib/dashboard/types"

type LoadedDashboardSheet = {
  source: DashboardSheetSource
  fetch: SheetFetchResult
  transform: SheetTransformResult
  dynamicMetrics: SheetDynamicMetric[]
}

type FailedDashboardSheet = {
  source: DashboardSheetSource
  error: string
}

export async function buildDashboardSnapshot(
  source: DashboardSource
): Promise<DashboardSnapshot> {
  const fetchedAt = new Date().toISOString()

  try {
    const { loadedSheets, failedSheets } = await fetchDashboardSheets(source)
    const transform = combineTransforms(loadedSheets)
    const dynamicMetrics = loadedSheets.flatMap((sheet) => sheet.dynamicMetrics)
    const sheetStatuses = loadedSheets.map(toSheetStatus)
    const notices = [
      ...buildSourceNotices(source, sheetStatuses),
      ...failedSheets.map(
        (sheet) => `${sheet.source.name}: não foi possível ler (${sheet.error}).`
      ),
    ]

    if (!transform.rows.length) {
      notices.push("A planilha foi encontrada, mas não há linhas úteis para exibir.")
    }

    if (transform.unidentifiedColumns.length) {
      notices.push(
        `${transform.unidentifiedColumns.length} coluna(s) ainda não foram mapeadas pela engine.`
      )
    }

    return {
      status: isSourceConfigured(source) ? "ready" : "needs-configuration",
      fetchedAt,
      source,
      sheet: {
        transport: combineTransport(sheetStatuses),
        sourceLabel: buildSourceLabel(sheetStatuses),
        rowCount: transform.rows.length,
        headerRowIndex: transform.headerRowIndex,
        unidentifiedColumns: transform.unidentifiedColumns,
        dynamicMetrics,
        sources: sheetStatuses,
      },
      transform,
      model: buildDashboardModel(transform, source.tileConfig, dynamicMetrics),
      notices,
    }
  } catch (error) {
    const transform = transformSheet([])

    return {
      status: "error",
      fetchedAt,
      source,
      sheet: {
        transport: "sample",
        sourceLabel: "erro na leitura",
        rowCount: 0,
        headerRowIndex: 0,
        unidentifiedColumns: [],
        dynamicMetrics: [],
        sources: [],
      },
      transform,
      model: buildDashboardModel(transform, source.tileConfig),
      notices: [
        "Não foi possível ler a planilha. Verifique compartilhamento, credenciais e range.",
      ],
      error: error instanceof Error ? error.message : "Erro desconhecido.",
    }
  }
}

async function fetchDashboardSheets(source: DashboardSource) {
  const loadedSheets: LoadedDashboardSheet[] = []
  const failedSheets: FailedDashboardSheet[] = []

  for (const sheetGroup of collapseFallbackSheets(source.sheets)) {
    const loaded = await loadFirstReadableSheet(sheetGroup)

    if (loaded) {
      loadedSheets.push(loaded)
      continue
    }

    failedSheets.push(
      ...sheetGroup.map((sheet) => ({
        source: sheet,
        error: "aba não encontrada ou sem permissão",
      }))
    )
  }

  return { loadedSheets, failedSheets }
}

async function loadFirstReadableSheet(sheets: DashboardSheetSource[]) {
  const failures: FailedDashboardSheet[] = []

  for (const sheet of sheets) {
    try {
      return await loadDashboardSheet(sheet)
    } catch (error) {
      failures.push({
        source: sheet,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      })
    }
  }

  return null
}

async function loadDashboardSheet(sheet: DashboardSheetSource) {
  const fetchResult = await fetchSheetValues(sheet)
  const transform = normalizeSheetTransform(
    sheet,
    fetchResult.values,
    transformSheet(fetchResult.values, {
      fieldAliases: getDashboardFieldAliases(sheet.mapper),
    })
  )
  const dynamicMetrics = extractDynamicSheetMetrics(
    fetchResult.values,
    transform
  ).map((metric) => namespaceDynamicMetric(metric, sheet))

  return {
    source: sheet,
    fetch: fetchResult,
    transform,
    dynamicMetrics,
  } satisfies LoadedDashboardSheet
}

function normalizeSheetTransform(
  sheet: DashboardSheetSource,
  matrix: unknown[][],
  transform: SheetTransformResult
): SheetTransformResult {
  if (sheet.role !== "leads" && normalizeHeader(sheet.type) !== "leads") {
    return transform
  }

  const leadColumns = findLeadColumns(transform.headers)
  const dateColumns = findHeaderColumns(transform.headers, FORM_DATE_ALIASES)
  const campaignColumns = findHeaderColumns(transform.headers, FORM_CAMPAIGN_ALIASES)
  const adColumns = findHeaderColumns(transform.headers, FORM_AD_ALIASES)
  const audienceColumns = findHeaderColumns(transform.headers, FORM_AUDIENCE_ALIASES)
  const creativeColumns = findHeaderColumns(transform.headers, FORM_CREATIVE_ALIASES)
  const dataRows = matrix.slice(transform.headerRowIndex + 1)

  const rows = transform.rows.map((row, index) => {
    const rawRow = dataRows[index] ?? []
    const hasLeadSignal = leadColumns.some((columnIndex) => hasCellValue(rawRow[columnIndex]))

    return {
      ...row,
      date: row.date ?? readDateFallback(rawRow, dateColumns),
      campaignName: row.campaignName ?? readTextFallback(rawRow, campaignColumns),
      adName: row.adName ?? readTextFallback(rawRow, adColumns),
      audienceName: row.audienceName ?? readTextFallback(rawRow, audienceColumns),
      creativeName: row.creativeName ?? readTextFallback(rawRow, creativeColumns),
      leads: typeof row.leads === "number" ? row.leads : hasLeadSignal ? 1 : null,
    } satisfies CanonicalRow
  })

  return {
    ...transform,
    rows,
    summary: buildSheetSummary(rows),
  }
}

const FORM_LEAD_ALIASES = [
  "email",
  "e mail",
  "e-mail",
  "mail",
  "seu email",
  "seu melhor email",
  "seu melhor e mail",
  "seu melhor e-mail",
  "telefone",
  "fone",
  "celular",
  "whatsapp",
  "whats",
  "phone",
  "mobile",
  "nome",
  "nome completo",
  "full name",
  "name",
]

const FORM_DATE_ALIASES = [
  "data",
  "date",
  "data de inscricao",
  "data inscricao",
  "created time",
  "created_time",
]

const FORM_CAMPAIGN_ALIASES = [
  "campaign",
  "campanha",
  "campaign name",
  "campaign_name",
]

const FORM_AD_ALIASES = [
  "ad name",
  "ad_name",
  "anuncio",
  "content",
]

const FORM_AUDIENCE_ALIASES = [
  "publico",
  "audience",
  "adset name",
  "adset_name",
  "medium",
]

const FORM_CREATIVE_ALIASES = [
  "criativo",
  "criativo organico",
  "term",
  "form name",
  "form_name",
]

function findLeadColumns(headers: string[]) {
  return findHeaderColumns(headers, FORM_LEAD_ALIASES)
}

function findHeaderColumns(headers: string[], aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeHeader)

  return headers
    .map((header, index) => ({ header: normalizeHeader(header), index }))
    .filter(({ header }) =>
      normalizedAliases.some((alias) => isHeaderAliasMatch(header, alias))
    )
    .map(({ index }) => index)
}

function isHeaderAliasMatch(header: string, alias: string) {
  if (!header || !alias) return false
  if (header === alias) return true

  if (alias === "name" || alias === "nome") {
    return false
  }

  return header.includes(alias)
}

function readDateFallback(row: unknown[], columns: number[]) {
  const value = readTextFallback(row, columns)
  if (!value) return null

  const isoLike = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/.exec(value)
  if (isoLike) {
    const [, year, month, day] = isoLike
    return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
  }

  const brLike = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/.exec(value)
  if (brLike) {
    const [, day, month, year] = brLike
    const normalizedYear = year.length === 2 ? `20${year}` : year
    return `${normalizedYear.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
  }

  return value
}

function readTextFallback(row: unknown[], columns: number[]) {
  for (const column of columns) {
    const value = String(row[column] ?? "").trim()
    if (value) return value
  }

  return null
}

function hasCellValue(value: unknown) {
  const text = String(value ?? "").trim()
  return text !== "" && text !== "#REF!" && text !== "#VALUE!"
}
function collapseFallbackSheets(sheets: DashboardSheetSource[]) {
  const generatedMedia = sheets.filter((sheet) => /:media-\d+$/.test(sheet.id))
  const generatedLeads = sheets.filter((sheet) => /:leads-\d+$/.test(sheet.id))
  const generatedIds = new Set(
    [...generatedMedia, ...generatedLeads].map((sheet) => sheet.id)
  )
  const groups: DashboardSheetSource[][] = []

  if (generatedMedia.length) {
    groups.push(generatedMedia)
  }

  if (generatedLeads.length) {
    groups.push(generatedLeads)
  }

  for (const sheet of sheets) {
    if (!generatedIds.has(sheet.id)) {
      groups.push([sheet])
    }
  }

  return groups
}
function combineTransforms(
  loadedSheets: LoadedDashboardSheet[]
): SheetTransformResult {
  const rows = loadedSheets.flatMap((sheet) => sheet.transform.rows)

  return {
    schemaVersion: "1.0",
    headerRowIndex: 0,
    headers: uniqueStrings(
      loadedSheets.flatMap((sheet) =>
        sheet.transform.headers.map((header) => prefixSheetLabel(sheet.source, header))
      )
    ),
    mappings: loadedSheets.flatMap((sheet) =>
      sheet.transform.mappings.map((mapping) => ({
        ...mapping,
        source: prefixSheetLabel(sheet.source, mapping.source),
      }))
    ),
    unidentifiedColumns: uniqueStrings(
      loadedSheets.flatMap((sheet) =>
        sheet.transform.unidentifiedColumns.map((column) =>
          prefixSheetLabel(sheet.source, column)
        )
      )
    ),
    rows,
    summary: buildSheetSummary(rows),
  }
}

function namespaceDynamicMetric(
  metric: SheetDynamicMetric,
  sheet: DashboardSheetSource
): SheetDynamicMetric {
  return {
    ...metric,
    id: `${slugify(sheet.id)}-${metric.id}`,
    source: prefixSheetLabel(sheet, metric.source),
    label: prefixSheetLabel(sheet, metric.label),
  }
}

function toSheetStatus(sheet: LoadedDashboardSheet): DashboardSheetStatus {
  return {
    id: sheet.source.id,
    name: sheet.source.name,
    type: sheet.source.type,
    mapper: sheet.source.mapper,
    transport: sheet.fetch.transport,
    sourceLabel: sheet.fetch.sourceLabel,
    rowCount: sheet.transform.rows.length,
    headerRowIndex: sheet.transform.headerRowIndex,
    unidentifiedColumns: sheet.transform.unidentifiedColumns,
  }
}

function buildSourceNotices(
  source: DashboardSource,
  sheetStatuses: DashboardSheetStatus[]
) {
  const notices: string[] = []

  if (!source.sheets.length) {
    notices.push("Nenhuma planilha ativa encontrada para este cliente.")
  }

  if (source.sheets.length === 1 && !source.sheets[0]?.sheetId) {
    notices.push("GOOGLE_SHEETS_ID não configurado; exibindo dados de exemplo.")
  }

  if (sheetStatuses.some((status) => status.transport === "public-csv")) {
    notices.push(
      "A planilha está sendo lida como CSV público. Para planilhas privadas, use service account."
    )
  }

  return notices
}

function buildSourceLabel(sheetStatuses: DashboardSheetStatus[]) {
  if (!sheetStatuses.length) {
    return "sem planilhas ativas"
  }

  if (sheetStatuses.length === 1) {
    return sheetStatuses[0].sourceLabel
  }

  return `${sheetStatuses.length} abas via Google Sheets`
}

function combineTransport(sheetStatuses: DashboardSheetStatus[]): SheetTransport {
  if (!sheetStatuses.length) {
    return "sample"
  }

  const transports = Array.from(
    new Set(sheetStatuses.map((status) => status.transport))
  )

  return transports.length === 1 ? transports[0] : "mixed"
}

function isSourceConfigured(source: DashboardSource) {
  return source.sheets.some((sheet) => Boolean(sheet.sheetId))
}

function prefixSheetLabel(sheet: DashboardSheetSource, label: string) {
  return `${sheet.name}: ${label}`
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function slugify(value: string) {
  return normalizeHeader(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}