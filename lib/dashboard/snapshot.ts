import {
  buildSheetSummary,
  normalizeHeader,
  transformSheet,
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

export async function buildDashboardSnapshot(
  source: DashboardSource
): Promise<DashboardSnapshot> {
  const fetchedAt = new Date().toISOString()

  try {
    const loadedSheets = await fetchDashboardSheets(source)
    const transform = combineTransforms(loadedSheets)
    const dynamicMetrics = loadedSheets.flatMap((sheet) => sheet.dynamicMetrics)
    const sheetStatuses = loadedSheets.map(toSheetStatus)
    const notices = [...buildSourceNotices(source, sheetStatuses)]

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
  if (!source.sheets.length) {
    return []
  }

  return Promise.all(
    source.sheets.map(async (sheet) => {
      const fetchResult = await fetchSheetValues(sheet)
      const transform = transformSheet(fetchResult.values, {
        fieldAliases: getDashboardFieldAliases(sheet.mapper),
      })
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
    })
  )
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

  return `${sheetStatuses.length} planilhas via Google Sheets`
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

