import { readMasterSheetPreview } from "@/lib/dashboard/master-config"
import { jsonError, REALTIME_HEADERS } from "@/lib/dashboard/http"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  try {
    const preview = await readMasterSheetPreview()

    return Response.json(
      {
        ok: true,
        range: preview.range,
        rowCount: preview.rows.length,
        transport: preview.transport,
        sourceLabel: preview.sourceLabel,
        rows: preview.rows,
      },
      {
        headers: REALTIME_HEADERS,
      }
    )
  } catch (error) {
    console.error(error)

    return jsonError(
      error instanceof Error ? error.message : "Erro ao ler a planilha-mãe.",
      500
    )
  }
}
