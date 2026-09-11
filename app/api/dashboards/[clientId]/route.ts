import {
  DashboardAccessError,
  getStrictDashboardSource,
} from "@/lib/dashboard/access"
import { jsonError, REALTIME_HEADERS } from "@/lib/dashboard/http"
import { buildDashboardSnapshot } from "@/lib/dashboard/snapshot"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params

  try {
    const source = await getStrictDashboardSource(clientId)
    const snapshot = await buildDashboardSnapshot(source)

    return Response.json(snapshot, {
      headers: REALTIME_HEADERS,
    })
  } catch (error) {
    if (error instanceof DashboardAccessError) {
      return jsonError(error.message, error.status)
    }

    return jsonError(
      error instanceof Error ? error.message : "Erro ao carregar dashboard.",
      500
    )
  }
}
