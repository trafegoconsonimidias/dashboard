import { createSign } from "node:crypto"

import type { DashboardSource, SheetFetchResult } from "@/lib/dashboard/types"

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly"

let tokenCache: { accessToken: string; expiresAt: number } | null = null

const SAMPLE_SHEET_VALUES: unknown[][] = [
  [
    "DATA",
    "[PRODUTO X] Vendas",
    "[PRODUTO X] Investimento",
    "[PRODUTO X] [FB & IG] Vendas",
    "[PRODUTO X] [FB & IG] Investimento",
    "[PRODUTO X] [GO & YT] Vendas",
    "[PRODUTO X] [GO & YT] Investimento",
    "[PRODUTO X] Receita estimada",
    "[PRODUTO X] ROAS",
    "[PRODUTO Y] Vendas",
    "[PRODUTO Y] Investimento",
    "[PRODUTO Y] [FB & IG] Vendas",
    "[PRODUTO Y] [FB & IG] Investimento",
    "[PRODUTO Y] [GO & YT] Vendas",
    "[PRODUTO Y] [GO & YT] Investimento",
    "[PRODUTO Y] Receita estimada",
    "[PRODUTO Y] ROAS",
    "[ISCA Z] Leads",
    "[ISCA Z] Investimento",
    "[ISCA Z] Impressões",
    "[ISCA Z] Cliques",
    "[SEGUIDORES] Investimento",
    "[DIST. CONTEUDO] Investimento",
    "Investimento Total",
    "Receita Estimada por ads",
    "ROAS",
  ],
  [
    "21/07/2025",
    "50",
    "R$ 4.815,58",
    "34",
    "R$ 3.112,30",
    "16",
    "R$ 1.703,28",
    "R$ 4.535,00",
    "0,94",
    "0",
    "R$ 0,00",
    "",
    "",
    "",
    "",
    "R$ 0,00",
    "0,00",
    "86",
    "R$ 940,20",
    "38.420",
    "1.283",
    "R$ 380,00",
    "R$ 260,00",
    "R$ 6.395,78",
    "R$ 4.535,00",
    "0,71",
  ],
  [
    "22/07/2025",
    "42",
    "R$ 3.902,40",
    "28",
    "R$ 2.520,10",
    "14",
    "R$ 1.382,30",
    "R$ 4.070,00",
    "1,04",
    "5",
    "R$ 580,00",
    "4",
    "R$ 420,00",
    "1",
    "R$ 160,00",
    "R$ 450,00",
    "0,78",
    "93",
    "R$ 1.024,90",
    "42.760",
    "1.440",
    "R$ 410,00",
    "R$ 280,00",
    "R$ 6.197,30",
    "R$ 4.520,00",
    "0,73",
  ],
  [
    "23/07/2025",
    "57",
    "R$ 5.120,00",
    "39",
    "R$ 3.610,00",
    "18",
    "R$ 1.510,00",
    "R$ 5.620,00",
    "1,10",
    "7",
    "R$ 720,00",
    "5",
    "R$ 510,00",
    "2",
    "R$ 210,00",
    "R$ 630,00",
    "0,88",
    "105",
    "R$ 1.180,00",
    "47.300",
    "1.590",
    "R$ 430,00",
    "R$ 310,00",
    "R$ 7.760,00",
    "R$ 6.250,00",
    "0,81",
  ],
  [
    "27/10/2025",
    "1",
    "R$ 1.141,57",
    "",
    "",
    "",
    "",
    "R$ 67,00",
    "0,06",
    "0",
    "R$ 0,00",
    "",
    "",
    "",
    "",
    "R$ 0,00",
    "0,00",
    "",
    "",
    "",
    "",
    "",
    "",
    "R$ 1.141,57",
    "R$ 67,00",
    "0,06",
  ],
]

export async function fetchSheetValues(
  source: DashboardSource
): Promise<SheetFetchResult> {
  if (!source.sheetId) {
    return {
      values: SAMPLE_SHEET_VALUES,
      transport: "sample",
      sourceLabel: "dados de exemplo",
    }
  }

  if (hasServiceAccountCredentials() || process.env.GOOGLE_SHEETS_API_KEY) {
    return fetchGoogleApiValues(source)
  }

  return fetchPublishedCsvValues(source)
}

async function fetchGoogleApiValues(
  source: DashboardSource
): Promise<SheetFetchResult> {
  const range = source.sheetName
    ? `${source.sheetName}!${source.rangeA1}`
    : source.rangeA1

  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      source.sheetId
    )}/values/${encodeURIComponent(range)}`
  )

  url.searchParams.set("majorDimension", "ROWS")
  url.searchParams.set("valueRenderOption", "FORMATTED_VALUE")
  url.searchParams.set("dateTimeRenderOption", "FORMATTED_STRING")

  const headers = new Headers()
  const accessToken = await getServiceAccountAccessToken()

  if (accessToken) {
    headers.set("authorization", `Bearer ${accessToken}`)
  } else {
    url.searchParams.set("key", process.env.GOOGLE_SHEETS_API_KEY ?? "")
  }

  const response = await fetch(url, {
    headers,
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(await readGoogleError(response))
  }

  const data = (await response.json()) as { values?: unknown[][] }

  return {
    values: data.values ?? [],
    transport: "google-api",
    sourceLabel: accessToken ? "Google Sheets API (service account)" : "Google Sheets API",
  }
}

async function fetchPublishedCsvValues(
  source: DashboardSource
): Promise<SheetFetchResult> {
  const url = new URL(
    `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
      source.sheetId
    )}/gviz/tq`
  )

  url.searchParams.set("tqx", "out:csv")

  if (source.sheetName) {
    url.searchParams.set("sheet", source.sheetName)
  }

  if (source.rangeA1) {
    url.searchParams.set("range", source.rangeA1)
  }

  const response = await fetch(url, { cache: "no-store" })

  if (!response.ok) {
    throw new Error(await readGoogleError(response))
  }

  return {
    values: parseCsv(await response.text()),
    transport: "public-csv",
    sourceLabel: "CSV público do Google Sheets",
  }
}

function hasServiceAccountCredentials() {
  return Boolean(getServiceAccountEmail() && getServiceAccountPrivateKey())
}

async function getServiceAccountAccessToken() {
  if (!hasServiceAccountCredentials()) {
    return null
  }

  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.accessToken
  }

  const now = Math.floor(Date.now() / 1000)
  const assertion = signJwt({
    iss: getServiceAccountEmail(),
    scope: GOOGLE_SHEETS_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  })

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  })

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(await readGoogleError(response))
  }

  const payload = (await response.json()) as {
    access_token?: string
    expires_in?: number
  }

  if (!payload.access_token) {
    throw new Error("Google não retornou access_token para a service account.")
  }

  tokenCache = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + ((payload.expires_in ?? 3600) - 60) * 1000,
  }

  return tokenCache.accessToken
}

function signJwt(claims: Record<string, string | number | undefined>) {
  const header = encodeBase64Url(
    JSON.stringify({
      alg: "RS256",
      typ: "JWT",
    })
  )
  const payload = encodeBase64Url(JSON.stringify(claims))
  const unsignedToken = `${header}.${payload}`
  const signature = createSign("RSA-SHA256")
    .update(unsignedToken)
    .sign(getServiceAccountPrivateKey(), "base64url")

  return `${unsignedToken}.${signature}`
}

function encodeBase64Url(value: string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

function getServiceAccountEmail() {
  return process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? process.env.GOOGLE_CLIENT_EMAIL
}

function getServiceAccountPrivateKey() {
  return (
    process.env.GOOGLE_PRIVATE_KEY ??
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ??
    ""
  ).replace(/\\n/g, "\n")
}

async function readGoogleError(response: Response) {
  const text = await response.text()

  if (!text) {
    return `Google Sheets respondeu ${response.status} ${response.statusText}.`
  }

  try {
    const data = JSON.parse(text) as {
      error?: { message?: string }
      error_description?: string
    }

    return (
      data.error?.message ??
      data.error_description ??
      `Google Sheets respondeu ${response.status} ${response.statusText}.`
    )
  } catch {
    return text.slice(0, 240)
  }
}

function parseCsv(input: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let inQuotes = false

  for (let index = 0; index < input.length; index++) {
    const char = input[index]
    const next = input[index + 1]

    if (char === '"' && inQuotes && next === '"') {
      cell += '"'
      index++
      continue
    }

    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (char === "," && !inQuotes) {
      row.push(cell)
      cell = ""
      continue
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index++
      }

      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
      continue
    }

    cell += char
  }

  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }

  return rows.filter((currentRow) =>
    currentRow.some((value) => value.trim() !== "")
  )
}
