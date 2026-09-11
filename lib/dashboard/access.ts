import { normalizeMetricTileConfig } from "@/lib/dashboard/metric-tiles"
import type {
  DashboardAccessState,
  DashboardSource,
} from "@/lib/dashboard/types"

export class DashboardAccessError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function getDashboardAccess(
  preferredSlug?: string
): Promise<DashboardAccessState> {
  const source = getSheetDashboardSource()
  const activeSource =
    !preferredSlug || preferredSlug === source.clientSlug ? source : null

  return {
    status: "ready",
    viewer: {
      id: "sheet-viewer",
      name: "Planilha",
      email: source.sheetId ? "Google Sheets conectado" : "Dados de exemplo",
      mode: "sheet",
    },
    dashboards: [
      {
        id: source.id,
        name: source.clientName,
        slug: source.clientSlug,
        role: source.role,
        title: source.title,
        refreshSeconds: source.refreshSeconds,
        isConfigured: Boolean(source.sheetId),
      },
    ],
    activeSource,
    notices: [],
  }
}

export async function getStrictDashboardSource(clientSlug: string) {
  const source = getSheetDashboardSource()

  if (source.clientSlug !== clientSlug) {
    throw new DashboardAccessError(404, "Dashboard não encontrado.")
  }

  return source
}

function getSheetDashboardSource(): DashboardSource {
  const refreshSeconds = clampRefreshSeconds(
    Number.parseInt(process.env.DASHBOARD_REFRESH_SECONDS ?? "15", 10)
  )

  return {
    id: process.env.DASHBOARD_CLIENT_SLUG ?? "planilha",
    clientId: process.env.DASHBOARD_CLIENT_ID ?? "sheet-dashboard",
    clientName: process.env.DASHBOARD_CLIENT_NAME ?? "Google Sheets",
    clientSlug: process.env.DASHBOARD_CLIENT_SLUG ?? "planilha",
    role: "viewer",
    title: process.env.DASHBOARD_TITLE ?? "Dashboard da Planilha",
    sheetId: process.env.GOOGLE_SHEETS_ID ?? "",
    sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME ?? null,
    rangeA1: process.env.GOOGLE_SHEETS_RANGE ?? "A:Z",
    refreshSeconds,
    mode: "sheet",
    tileConfig: normalizeMetricTileConfig(
      parseJsonEnv(process.env.DASHBOARD_TILE_CONFIG)
    ),
  }
}

function clampRefreshSeconds(value: number) {
  if (!Number.isFinite(value)) {
    return 15
  }

  return Math.min(300, Math.max(5, value))
}

function parseJsonEnv(value: string | undefined) {
  if (!value) {
    return []
  }

  try {
    return JSON.parse(value) as unknown
  } catch {
    return []
  }
}
