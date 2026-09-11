export const REALTIME_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
}

export function jsonError(message: string, status: number) {
  return Response.json(
    {
      error: message,
    },
    {
      status,
      headers: REALTIME_HEADERS,
    }
  )
}
