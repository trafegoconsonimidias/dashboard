import { transformSheet } from "@/engine/engine"
import { extractDynamicSheetMetrics } from "@/lib/dashboard/dynamic-sheet-metrics"
import { fetchSheetValues } from "@/lib/dashboard/google-sheets"
import { buildDashboardModel } from "@/lib/dashboard/model"
import type { DashboardSnapshot, DashboardSource } from "@/lib/dashboard/types"

export async function buildDashboardSnapshot(
  source: DashboardSource
): Promise<DashboardSnapshot> {
  const fetchedAt = new Date().toISOString()

  try {
    const sheet = await fetchSheetValues(source)
    const transform = transformSheet(sheet.values)
    const dynamicMetrics = extractDynamicSheetMetrics(sheet.values, transform)
    const notices = [...buildSourceNotices(source, sheet.transport)]

    if (!transform.rows.length) {
      notices.push("A planilha foi encontrada, mas não há linhas úteis para exibir.")
    }

    if (transform.unidentifiedColumns.length) {
      notices.push(
        `${transform.unidentifiedColumns.length} coluna(s) ainda não foram mapeadas pela engine.`
      )
    }

    return {
      status: source.sheetId ? "ready" : "needs-configuration",
      fetchedAt,
      source,
      sheet: {
        transport: sheet.transport,
        sourceLabel: sheet.sourceLabel,
        rowCount: transform.rows.length,
        headerRowIndex: transform.headerRowIndex,
        unidentifiedColumns: transform.unidentifiedColumns,
        dynamicMetrics,
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

function buildSourceNotices(
  source: DashboardSource,
  transport: DashboardSnapshot["sheet"]["transport"]
) {
  const notices: string[] = []

  if (!source.sheetId) {
    notices.push("GOOGLE_SHEETS_ID não configurado; exibindo dados de exemplo.")
  }

  if (transport === "public-csv") {
    notices.push(
      "A planilha está sendo lida como CSV público. Para planilhas privadas, use service account."
    )
  }

  return notices
}
