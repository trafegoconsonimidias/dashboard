import {
  FIELD_REGISTRY,
  normalizeHeader,
  type CanonicalField,
} from "@/engine/engine"

const VALID_CANONICAL_FIELDS = new Set<CanonicalField>(
  FIELD_REGISTRY.map((field) => field.key)
)

const FORMULARIO_FIELD_ALIASES: Record<string, CanonicalField> = {
  Data: "date",
  Date: "date",
  "Data de inscrição": "date",
  "Data de Inscrição": "date",
  created_time: "date",
  created: "date",
  "Created time": "date",
  Campaign: "campaignName",
  campaign: "campaignName",
  Campanha: "campaignName",
  campaign_name: "campaignName",
  "Campaign name": "campaignName",
  Medium: "adSetName",
  medium: "adSetName",
  Público: "audienceName",
  Publico: "audienceName",
  adset_name: "audienceName",
  "Adset name": "audienceName",
  "Ad set name": "audienceName",
  Anúncio: "adName",
  Anuncio: "adName",
  ad_name: "adName",
  "Ad name": "adName",
  Content: "adName",
  content: "adName",
  Criativo: "creativeName",
  "Criativo orgânico": "creativeName",
  "Criativo organico": "creativeName",
  Term: "creativeName",
  term: "creativeName",
  Impressões: "impressions",
  Impressoes: "impressions",
  Impressions: "impressions",
  Alcance: "reach",
  Reach: "reach",
  Cliques: "clicks",
  Clicks: "clicks",
  "Cliques no link": "linkClicks",
  Investimento: "spend",
  INVESTIMENTO: "spend",
  Investido: "spend",
  "Valor gasto": "spend",
  Spend: "spend",
  Cost: "spend",
  Leads: "leads",
  LEADS: "leads",
  Lead: "leads",
  Contatos: "leads",
  Conversões: "conversions",
  Conversoes: "conversions",
  "Viu pág. captura": "landingPageViews",
  "Viu pag. captura": "landingPageViews",
  "Viu página captura": "landingPageViews",
  "Viu pagina captura": "landingPageViews",
  "Visualização página": "landingPageViews",
  "Visualizacao pagina": "landingPageViews",
  "Visualizações da página de destino": "landingPageViews",
  LINK: "adUrl",
  Link: "adUrl",
  "LINK 2": "instagramAdUrl",
  "Link 2": "instagramAdUrl",
}

const BUILT_IN_FIELD_MAPPERS = normalizeMapperRegistry({
  meta_v1: {
    Data: "date",
    Campanha: "campaignName",
    "Nome da campanha": "campaignName",
    "Conjunto de anúncios": "adSetName",
    Anúncio: "adName",
    Criativo: "creativeName",
    Impressões: "impressions",
    Alcance: "reach",
    Frequência: "frequency",
    Cliques: "clicks",
    "Cliques no link": "linkClicks",
    Leads: "leads",
    Resultados: "results",
    Compras: "purchases",
    Investimento: "spend",
    Investido: "spend",
    "Valor gasto": "spend",
    Receita: "revenue",
    Faturamento: "revenue",
    ROAS: "roas",
    CTR: "ctr",
    CPC: "cpc",
    CPM: "cpm",
    CPL: "cpl",
    CPA: "cpa",
    ...FORMULARIO_FIELD_ALIASES,
  },
  formulario_v1: FORMULARIO_FIELD_ALIASES,
  google_v1: {
    Day: "date",
    Date: "date",
    Campaign: "campaignName",
    "Campaign name": "campaignName",
    "Ad group": "adSetName",
    "Ad group name": "adSetName",
    Ad: "adName",
    Clicks: "clicks",
    Impr: "impressions",
    "Impr.": "impressions",
    Impressions: "impressions",
    Cost: "spend",
    Conv: "conversions",
    "Conv.": "conversions",
    Conversions: "conversions",
    "Conv. value": "revenue",
    "Conversion value": "revenue",
    CTR: "ctr",
    "Avg. CPC": "cpc",
    "Avg. CPM": "cpm",
  },
  ecommerce_v1: {
    Data: "date",
    Pedido: "purchases",
    Pedidos: "purchases",
    Compras: "purchases",
    Vendas: "purchases",
    Receita: "revenue",
    Faturamento: "revenue",
    "Receita bruta": "revenue",
    "Valor vendido": "revenue",
  },
  crm_v1: {
    Data: "date",
    Lead: "leads",
    Leads: "leads",
    Contatos: "leads",
    Conversões: "conversions",
    "Valor gasto": "spend",
    Investimento: "spend",
    ...FORMULARIO_FIELD_ALIASES,
  },
})

let configuredFieldMappersCache:
  | Record<string, Record<string, CanonicalField>>
  | null = null

export function getDashboardFieldAliases(mapper: string | null | undefined) {
  const aliases: Record<string, CanonicalField> = {}

  for (const mapperName of splitMapperNames(mapper)) {
    Object.assign(aliases, BUILT_IN_FIELD_MAPPERS[mapperName])
    Object.assign(aliases, getConfiguredFieldMappers()[mapperName])
  }

  return normalizeAliases(aliases)
}

function getConfiguredFieldMappers() {
  if (configuredFieldMappersCache) {
    return configuredFieldMappersCache
  }

  const raw = process.env.DASHBOARD_FIELD_MAPPERS?.trim()

  if (!raw) {
    configuredFieldMappersCache = {}
    return configuredFieldMappersCache
  }

  try {
    configuredFieldMappersCache = normalizeMapperRegistry(JSON.parse(raw))
  } catch {
    configuredFieldMappersCache = {}
  }

  return configuredFieldMappersCache
}

function normalizeMapperRegistry(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  const registry: Record<string, Record<string, CanonicalField>> = {}

  for (const [mapperName, aliases] of Object.entries(
    value as Record<string, unknown>
  )) {
    if (!aliases || typeof aliases !== "object" || Array.isArray(aliases)) {
      continue
    }

    const normalizedAliases = normalizeAliases(
      aliases as Record<string, CanonicalField>
    )

    if (Object.keys(normalizedAliases).length) {
      registry[normalizeHeader(mapperName)] = normalizedAliases
    }
  }

  return registry
}

function normalizeAliases(aliases: Record<string, CanonicalField>) {
  const normalized: Record<string, CanonicalField> = {}

  for (const [source, target] of Object.entries(aliases)) {
    if (typeof target !== "string" || !VALID_CANONICAL_FIELDS.has(target)) {
      continue
    }

    const normalizedSource = normalizeHeader(source)

    if (normalizedSource) {
      normalized[normalizedSource] = target
    }
  }

  return normalized
}

function splitMapperNames(mapper: string | null | undefined) {
  return String(mapper ?? "")
    .split(/[\s,]+/g)
    .map((value) => normalizeHeader(value))
    .filter(Boolean)
}
