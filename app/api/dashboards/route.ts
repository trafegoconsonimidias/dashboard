import { getDashboardAccess } from "@/lib/dashboard/access"
import { jsonError, REALTIME_HEADERS } from "@/lib/dashboard/http"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  try {
    const access = await getDashboardAccess()

    return Response.json(
      {
        viewer: access.viewer,
        dashboards: access.dashboards,
        notices: access.notices,
      },
      {
        headers: REALTIME_HEADERS,
      }
    )
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Erro ao listar dashboards.",
      500
    )
  }
}
