import { normalizeHeader } from "@/engine/engine"
import { fetchSheetValues } from "@/lib/dashboard/google-sheets"
import { normalizeMetricTileConfig } from "@/lib/dashboard/metric-tiles"
import type {
  DashboardAccessState,
  DashboardSheetSource,
  DashboardSource,
  MetricTileOverride,
  SheetRangeSource,
} from "@/lib/dashboard/types"

const DEFAULT_MASTER_CONFIG_RANGE = "A:Z"
const DEFAULT_CLIENTS_RANGE = "CLIENTES!A:Z"
const DEFAULT_SHEETS_RANGE = "PLANILHAS!A:Z"
const DEFAULT_MASTER_TEST_RANGE = "A:Z"
const DEFAULT_DATA_RANGE = "A:Z"

type MasterClient = {
  clientId: string
  name: string
  accessId: string
  active: boolean
  title: string | null
  refreshSeconds: number | null
  tileConfig: MetricTileOverride[] | null
}

type MasterSheet = DashboardSheetSource & {
  clientId: string
  active: boolean
}

export function hasMasterDashboardConfig() {
  return Boolean(process.env.MASTER_SHEET_ID?.trim())
}

export async function getMasterDashboardAccess(
  accessId: string | undefined
): Promise<DashboardAccessState> {
  const normalizedAccessId = accessId?.trim() ?? ""

  if (!normalizedAccessId) {
    return emptyMasterAccessState("Acesse um dashboard usando /dashboard/{access_id}.")
  }

  const config = await readMasterDashboardConfig()
  const client = config.clients.find(
    (candidate) => candidate.accessId === normalizedAccessId && candidate.active
  )

  if (!client) {
    return emptyMasterAccessState("Dashboard não encontrado ou cliente inativo.")
  }

  const source = buildDashboardSource(client, config.sheets)
  const notices = source.sheets.length
    ? []
    : [`${source.clientName} não tem planilhas ativas na aba PLANILHAS.`]

  return {
    status: "ready",
    viewer: {
      id: `viewer-${source.clientId}`,
      name: source.clientName,
      email: "Acesso por link privado",
      mode: "sheet",
    },
    dashboards: [toDashboardListItem(source)],
    activeSource: source,
    notices,
  }
}

export async function readMasterSheetPreview() {
  const masterSheetId = getMasterSheetId()
  const range = process.env.MASTER_TEST_RANGE ?? DEFAULT_MASTER_TEST_RANGE
  const source = buildSheetRangeSource(masterSheetId, range)
  const result = await fetchSheetValues(source)

  return {
    range,
    rows: result.values,
    transport: result.transport,
    sourceLabel: result.sourceLabel,
  }
}

async function readMasterDashboardConfig() {
  const masterSheetId = getMasterSheetId()
  const unifiedResult = await fetchSheetValues(
    buildSheetRangeSource(
      masterSheetId,
      process.env.MASTER_CONFIG_RANGE ?? DEFAULT_MASTER_CONFIG_RANGE
    )
  )
  const unifiedConfig = parseUnifiedConfig(unifiedResult.values)

  if (unifiedConfig.clients.length && unifiedConfig.sheets.length) {
    return unifiedConfig
  }

  const [clientsResult, sheetsResult] = await Promise.all([
    fetchSheetValues(
      buildSheetRangeSource(
        masterSheetId,
        process.env.MASTER_CLIENTS_RANGE ?? DEFAULT_CLIENTS_RANGE
      )
    ),
    fetchSheetValues(
      buildSheetRangeSource(
        masterSheetId,
        process.env.MASTER_SHEETS_RANGE ?? DEFAULT_SHEETS_RANGE
      )
    ),
  ])

  return {
    clients: parseClients(clientsResult.values),
    sheets: parseSheets(sheetsResult.values),
  }
}

function buildDashboardSource(
  client: MasterClient,
  sheets: MasterSheet[]
): DashboardSource {
  const activeSheets = sheets.filter(
    (sheet) => sheet.active && sheet.clientId === client.clientId
  )
  const firstSheet = activeSheets[0]
  const refreshSeconds = clampRefreshSeconds(
    client.refreshSeconds ??
      Number.parseInt(process.env.DASHBOARD_REFRESH_SECONDS ?? "15", 10)
  )

  return {
    id: client.clientId,
    clientId: client.clientId,
    clientName: client.name,
    clientSlug: client.accessId,
    role: "viewer",
    title: client.title ?? `Dashboard ${client.name}`,
    sheetId: firstSheet?.sheetId ?? "",
    sheetName: firstSheet?.sheetName ?? null,
    rangeA1: firstSheet?.rangeA1 ?? DEFAULT_DATA_RANGE,
    refreshSeconds,
    mode: "sheet",
    tileConfig:
      client.tileConfig ??
      normalizeMetricTileConfig(parseJsonValue(process.env.DASHBOARD_TILE_CONFIG)),
    sheets: activeSheets,
  }
}

function parseUnifiedConfig(values: unknown[][]) {
  const records = tableToRecords(values)
  const clientsById = new Map<string, MasterClient>()
  const sheets: MasterSheet[] = []

  records.forEach((record, index) => {
    const clientId = readRecordValue(record, [
      "client_id",
      "id_cliente",
      "cliente_id",
      "id",
    ])
    const sheetId = readRecordValue(record, [
      "sheet_id",
      "id_planilha",
      "planilha_id",
      "spreadsheet_id",
    ])

    if (!clientId || !sheetId) {
      return
    }

    if (!clientsById.has(clientId)) {
      const accessId = readRecordValue(record, [
        "access_id",
        "access",
        "token",
        "slug",
        "link",
      ])
      const name =
        readRecordValue(record, [
          "name_cliente",
          "nome_cliente",
          "nome",
          "name",
          "cliente",
          "client_name",
        ]) ?? clientId

      clientsById.set(clientId, {
        clientId,
        name,
        accessId: accessId ?? clientId,
        active: isRecordActive(record),
        title: readRecordValue(record, ["title", "titulo", "título"]),
        refreshSeconds: parseOptionalInteger(
          readRecordValue(record, [
            "refresh_seconds",
            "refresh",
            "atualizacao",
            "atualização",
          ])
        ),
        tileConfig: normalizeOptionalTileConfig(
          readRecordValue(record, ["tile_config", "metricas", "métricas"])
        ),
      })
    }

    const name =
      readRecordValue(record, [
        "name_planilha",
        "nome_planilha",
        "nome",
        "name",
        "planilha",
      ]) ?? `Planilha ${index + 1}`
    const type = readRecordValue(record, ["tipo", "type"]) ?? "sheet"
    const rangeDescriptor =
      readRecordValue(record, ["range", "range_a1", "intervalo"]) ??
      DEFAULT_DATA_RANGE
    const parsedRange = parseSheetRange(rangeDescriptor)
    const explicitSheetName = readRecordValue(record, [
      "sheet_name",
      "aba",
      "tab",
    ])

    sheets.push({
      id: `${clientId}:${slugify(`${type}-${name}-${index + 1}`)}`,
      clientId,
      name,
      sheetId,
      sheetName: explicitSheetName ?? parsedRange.sheetName,
      rangeA1: parsedRange.rangeA1,
      type,
      mapper: readRecordValue(record, ["mapper", "mapeador"]),
      active: isRecordActive(record),
    })
  })

  return {
    clients: Array.from(clientsById.values()),
    sheets,
  }
}
function parseClients(values: unknown[][]): MasterClient[] {
  return tableToRecords(values)
    .map((record): MasterClient | null => {
      const clientId = readRecordValue(record, [
        "client_id",
        "id_cliente",
        "cliente_id",
        "id",
      ])
      const accessId = readRecordValue(record, [
        "access_id",
        "access",
        "token",
        "slug",
        "link",
      ])
      const name =
        readRecordValue(record, ["name_cliente", "nome_cliente", "nome", "name", "cliente", "client_name"]) ??
        clientId

      if (!clientId || !accessId || !name) {
        return null
      }

      return {
        clientId,
        name,
        accessId,
        active: isRecordActive(record),
        title: readRecordValue(record, ["title", "titulo", "título"]),
        refreshSeconds: parseOptionalInteger(
          readRecordValue(record, [
            "refresh_seconds",
            "refresh",
            "atualizacao",
            "atualização",
          ])
        ),
        tileConfig: normalizeOptionalTileConfig(
          readRecordValue(record, ["tile_config", "metricas", "métricas"])
        ),
      }
    })
    .filter((client): client is MasterClient => client !== null)
}

function parseSheets(values: unknown[][]): MasterSheet[] {
  return tableToRecords(values)
    .map((record, index): MasterSheet | null => {
      const clientId = readRecordValue(record, [
        "client_id",
        "id_cliente",
        "cliente_id",
      ])
      const sheetId = readRecordValue(record, [
        "sheet_id",
        "id_planilha",
        "planilha_id",
        "spreadsheet_id",
      ])

      if (!clientId || !sheetId) {
        return null
      }

      const name =
        readRecordValue(record, ["name_planilha", "nome_planilha", "nome", "name", "planilha"]) ??
        `Planilha ${index + 1}`
      const type = readRecordValue(record, ["tipo", "type"]) ?? "sheet"
      const rangeDescriptor =
        readRecordValue(record, ["range", "range_a1", "intervalo"]) ??
        DEFAULT_DATA_RANGE
      const parsedRange = parseSheetRange(rangeDescriptor)
      const explicitSheetName = readRecordValue(record, [
        "sheet_name",
        "aba",
        "tab",
      ])

      return {
        id: `${clientId}:${slugify(`${type}-${name}-${index + 1}`)}`,
        clientId,
        name,
        sheetId,
        sheetName: explicitSheetName ?? parsedRange.sheetName,
        rangeA1: parsedRange.rangeA1,
        type,
        mapper: readRecordValue(record, ["mapper", "mapeador"]),
        active: isRecordActive(record),
      }
    })
    .filter((sheet): sheet is MasterSheet => sheet !== null)
}

function tableToRecords(values: unknown[][]) {
  const headerRowIndex = values.findIndex(
    (row) => Array.isArray(row) && row.some((cell) => cleanCell(cell))
  )

  if (headerRowIndex < 0) {
    return []
  }

  const headers = (values[headerRowIndex] ?? []).map((cell) =>
    normalizeHeader(cell)
  )

  return values
    .slice(headerRowIndex + 1)
    .filter((row) => Array.isArray(row) && row.some((cell) => cleanCell(cell)))
    .map((row) => {
      const record: Record<string, string> = {}

      headers.forEach((header, index) => {
        const value = cleanCell(row[index])

        if (header && value) {
          record[header] = value
        }
      })

      return record
    })
}

function buildSheetRangeSource(
  sheetId: string,
  rangeDescriptor: string
): SheetRangeSource {
  const parsedRange = parseSheetRange(rangeDescriptor)

  return {
    sheetId,
    sheetName: parsedRange.sheetName,
    rangeA1: parsedRange.rangeA1,
  }
}

function parseSheetRange(value: string) {
  const range = value.trim() || DEFAULT_DATA_RANGE
  const separatorIndex = range.lastIndexOf("!")

  if (separatorIndex < 0) {
    return {
      sheetName: null,
      rangeA1: range,
    }
  }

  return {
    sheetName: unquoteSheetName(range.slice(0, separatorIndex).trim()),
    rangeA1: range.slice(separatorIndex + 1).trim() || DEFAULT_DATA_RANGE,
  }
}

function unquoteSheetName(value: string) {
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'")
  }

  return value || null
}

function emptyMasterAccessState(notice: string): DashboardAccessState {
  return {
    status: "ready",
    viewer: {
      id: "sheet-viewer",
      name: "Link privado",
      email: "Google Sheets CONFIG",
      mode: "sheet",
    },
    dashboards: [],
    activeSource: null,
    notices: [notice],
  }
}

function toDashboardListItem(source: DashboardSource) {
  return {
    id: source.id,
    name: source.clientName,
    slug: source.clientSlug,
    role: source.role,
    title: source.title,
    refreshSeconds: source.refreshSeconds,
    isConfigured: Boolean(source.sheets.length),
  }
}

function getMasterSheetId() {
  const masterSheetId = process.env.MASTER_SHEET_ID?.trim()

  if (!masterSheetId) {
    throw new Error("MASTER_SHEET_ID não configurado.")
  }

  return masterSheetId
}

function clampRefreshSeconds(value: number) {
  if (!Number.isFinite(value)) {
    return 15
  }

  return Math.min(300, Math.max(5, value))
}

function normalizeOptionalTileConfig(value: string | null) {
  if (!value) {
    return null
  }

  const normalized = normalizeMetricTileConfig(parseJsonValue(value))
  return normalized.length ? normalized : null
}

function parseJsonValue(value: string | null | undefined) {
  if (!value) {
    return undefined
  }

  try {
    return JSON.parse(value) as unknown
  } catch {
    return undefined
  }
}

function parseOptionalInteger(value: string | null) {
  if (!value) {
    return null
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function readRecordValue(record: Record<string, string>, aliases: string[]) {
  for (const alias of aliases) {
    const value = record[normalizeHeader(alias)]?.trim()

    if (value) {
      return value
    }
  }

  return null
}

function isRecordActive(record: Record<string, string>) {
  const value = readRecordValue(record, ["ativo", "active", "status"])

  if (!value) {
    return true
  }

  return !new Set([
    "0",
    "false",
    "inativo",
    "inactive",
    "nao",
    "não",
    "no",
    "desativado",
  ]).has(normalizeHeader(value))
}

function cleanCell(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim()
}

function slugify(value: string) {
  return normalizeHeader(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}


