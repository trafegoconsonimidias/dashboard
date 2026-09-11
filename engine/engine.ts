/**
 * sheet-engine.ts
 *
 * Engine independente para interpretar planilhas de mídia/performance e
 * transformá-las em um JSON canônico para dashboards.
 *
 * Sem dependências externas.
 *
 * Entrada esperada:
 *   unknown[][]  // como Google Sheets API: response.data.values
 *
 * Uso:
 *   const result = transformSheet(values)
 *   console.log(JSON.stringify(result, null, 2))
 */

export type CanonicalField =
  | "date"
  | "campaignName"
  | "adSetName"
  | "audienceName"
  | "creativeName"
  | "adName"
  | "instagramAdUrl"
  | "adUrl"
  | "impressions"
  | "reach"
  | "frequency"
  | "clicks"
  | "linkClicks"
  | "outboundClicks"
  | "landingPageViews"
  | "videoViews25"
  | "videoViews50"
  | "videoViews75"
  | "videoViews95"
  | "videoViews100"
  | "pageEngagement"
  | "postEngagement"
  | "engagements"
  | "results"
  | "leads"
  | "conversions"
  | "purchases"
  | "spend"
  | "revenue"
  | "ctr"
  | "cpc"
  | "cpm"
  | "cpl"
  | "cpa"
  | "roas";

export type FieldType =
  | "string"
  | "number"
  | "currency"
  | "percentage"
  | "date"
  | "url";

export interface FieldDefinition {
  key: CanonicalField;
  label: string;
  type: FieldType;
  aliases: string[];
}

export interface ColumnMapping {
  columnIndex: number;
  source: string;
  target: CanonicalField | null;
  confidence: number;
  method: "exact" | "normalized" | "fuzzy" | "mapper" | "unmapped";
  inferredType: FieldType | "unknown";
}

export interface CanonicalRow {
  date?: string | null;

  campaignName?: string | null;
  adSetName?: string | null;
  audienceName?: string | null;
  creativeName?: string | null;
  adName?: string | null;

  instagramAdUrl?: string | null;
  adUrl?: string | null;

  impressions?: number | null;
  reach?: number | null;
  frequency?: number | null;

  clicks?: number | null;
  linkClicks?: number | null;
  outboundClicks?: number | null;
  landingPageViews?: number | null;

  videoViews25?: number | null;
  videoViews50?: number | null;
  videoViews75?: number | null;
  videoViews95?: number | null;
  videoViews100?: number | null;

  pageEngagement?: number | null;
  postEngagement?: number | null;
  engagements?: number | null;

  results?: number | null;
  leads?: number | null;
  conversions?: number | null;
  purchases?: number | null;

  spend?: number | null;
  revenue?: number | null;

  ctr?: number | null;
  cpc?: number | null;
  cpm?: number | null;
  cpl?: number | null;
  cpa?: number | null;
  roas?: number | null;

  /**
   * Colunas não identificadas.
   * Útil para auditoria e para ensinar novos aliases à engine.
   */
  _unmapped?: Record<string, unknown>;
}

export interface SheetSummary {
  rowCount: number;

  impressions?: number;
  reach?: number;
  clicks?: number;
  linkClicks?: number;
  outboundClicks?: number;
  landingPageViews?: number;

  videoViews25?: number;
  videoViews50?: number;
  videoViews75?: number;
  videoViews95?: number;
  videoViews100?: number;

  pageEngagement?: number;
  postEngagement?: number;
  engagements?: number;

  results?: number;
  leads?: number;
  conversions?: number;
  purchases?: number;

  spend?: number;
  revenue?: number;

  frequency?: number | null;
  ctr?: number | null;
  cpc?: number | null;
  cpm?: number | null;
  cpl?: number | null;
  cpa?: number | null;
  roas?: number | null;
}

export interface SheetTransformResult {
  schemaVersion: "1.0";
  headerRowIndex: number;
  headers: string[];
  mappings: ColumnMapping[];
  unidentifiedColumns: string[];
  rows: CanonicalRow[];
  summary: SheetSummary;
}

export interface TransformOptions {
  /**
   * Quantidade máxima de linhas iniciais analisadas para localizar o cabeçalho.
   * Default: 10
   */
  headerSearchLimit?: number;

  /**
   * Confiança mínima para aceitar fuzzy matching.
   * Default: 0.78
   */
  fuzzyThreshold?: number;

  /**
   * Preserva colunas não reconhecidas em row._unmapped.
   * Default: true
   */
  keepUnmapped?: boolean;

  /**
   * Calcula CTR/CPC/CPM/frequência/CPL/CPA/ROAS quando possível.
   * Default: true
   */
  deriveMetrics?: boolean;

  /**
   * Mapeamentos explícitos de cabeçalhos para campos canônicos.
   * Útil quando uma planilha usa nomes próprios ou inconsistentes.
   */
  fieldAliases?: Record<string, CanonicalField>;
}

export const FIELD_REGISTRY: FieldDefinition[] = [
  {
    key: "date",
    label: "Data",
    type: "date",
    aliases: [
      "data",
      "date",
      "dia",
      "data do relatorio",
      "data do relatório",
      "reporting starts",
      "reporting start",
      "report date",
      "day",
      "periodo",
      "período",
    ],
  },
  {
    key: "campaignName",
    label: "Campanha",
    type: "string",
    aliases: [
      "campanha",
      "nome campanha",
      "nome da campanha",
      "campaign",
      "campaign name",
      "campaign_name",
    ],
  },
  {
    key: "adSetName",
    label: "Conjunto de anúncios",
    type: "string",
    aliases: [
      "conjunto",
      "conjunto de anuncios",
      "conjunto de anúncios",
      "nome do conjunto",
      "nome do conjunto de anuncios",
      "nome do conjunto de anúncios",
      "ad set",
      "adset",
      "ad set name",
      "adset name",
    ],
  },
  {
    key: "audienceName",
    label: "Público",
    type: "string",
    aliases: [
      "publico",
      "público",
      "audiencia",
      "audiência",
      "nome do publico",
      "nome do público",
      "audience",
      "audience name",
      "segmentacao",
      "segmentação",
      "targeting",
    ],
  },
  {
    key: "creativeName",
    label: "Criativo",
    type: "string",
    aliases: [
      "criativo",
      "nome criativo",
      "nome do criativo",
      "creative",
      "creative name",
      "peca",
      "peça",
    ],
  },
  {
    key: "adName",
    label: "Anúncio",
    type: "string",
    aliases: [
      "anuncio",
      "anúncio",
      "nome anuncio",
      "nome anúncio",
      "nome do anuncio",
      "nome do anúncio",
      "ad",
      "ad name",
    ],
  },
  {
    key: "instagramAdUrl",
    label: "Link Instagram Ad",
    type: "url",
    aliases: [
      "link instagram ad",
      "instagram ad link",
      "instagram ad url",
      "link instagram",
      "url instagram ad",
      "link do instagram",
      "link do anuncio instagram",
      "link do anúncio instagram",
    ],
  },
  {
    key: "adUrl",
    label: "Link do anúncio",
    type: "url",
    aliases: [
      "link ad",
      "ad link",
      "ad url",
      "link anuncio",
      "link anúncio",
      "link do anuncio",
      "link do anúncio",
      "url anuncio",
      "url anúncio",
      "preview link",
    ],
  },
  {
    key: "impressions",
    label: "Impressões",
    type: "number",
    aliases: [
      "impressoes",
      "impressões",
      "impression",
      "impressions",
      "imp",
    ],
  },
  {
    key: "reach",
    label: "Alcance",
    type: "number",
    aliases: [
      "alcance",
      "alcance estimado",
      "alcance (estimado)",
      "reach",
      "unique reach",
      "pessoas alcancadas",
      "pessoas alcançadas",
    ],
  },
  {
    key: "frequency",
    label: "Frequência",
    type: "number",
    aliases: [
      "frequencia",
      "frequência",
      "frequency",
      "freq",
    ],
  },
  {
    key: "clicks",
    label: "Cliques",
    type: "number",
    aliases: [
      "cliques",
      "clicks",
      "all clicks",
      "cliques todos",
      "cliques (todos)",
      "click all",
    ],
  },
  {
    key: "linkClicks",
    label: "Cliques no link",
    type: "number",
    aliases: [
      "cliques no link",
      "clique no link",
      "link clicks",
      "link click",
      "clicks on link",
      "cliques link",
    ],
  },
  {
    key: "outboundClicks",
    label: "Cliques de saída",
    type: "number",
    aliases: [
      "cliques de saida",
      "cliques de saída",
      "outbound clicks",
      "outbound click",
      "cliques externos",
    ],
  },
  {
    key: "landingPageViews",
    label: "Visualizações da página de destino",
    type: "number",
    aliases: [
      "visualizacoes da pagina de destino",
      "visualizações da página de destino",
      "visualizacao pagina destino",
      "visualização página destino",
      "landing page views",
      "landing page view",
      "lpv",
      "views pagina destino",
      "views página destino",
    ],
  },
  {
    key: "videoViews25",
    label: "Vídeo 25%",
    type: "number",
    aliases: [
      "visualizacao de video 25%",
      "visualização de vídeo 25%",
      "visualizacoes de video 25%",
      "visualizações de vídeo 25%",
      "video views 25%",
      "video 25%",
      "25% video views",
    ],
  },
  {
    key: "videoViews50",
    label: "Vídeo 50%",
    type: "number",
    aliases: [
      "visualizacao de video 50%",
      "visualização de vídeo 50%",
      "visualizacoes de video 50%",
      "visualizações de vídeo 50%",
      "video views 50%",
      "video 50%",
      "50% video views",
    ],
  },
  {
    key: "videoViews75",
    label: "Vídeo 75%",
    type: "number",
    aliases: [
      "visualizacao de video 75%",
      "visualização de vídeo 75%",
      "visualizção de vídeo 75%",
      "visualizcao de video 75%",
      "visualizacoes de video 75%",
      "visualizações de vídeo 75%",
      "video views 75%",
      "video 75%",
      "75% video views",
    ],
  },
  {
    key: "videoViews95",
    label: "Vídeo 95%",
    type: "number",
    aliases: [
      "visualizacao de video 95%",
      "visualização de vídeo 95%",
      "visualizção de vídeo 95%",
      "visualizcao de video 95%",
      "visualizacoes de video 95%",
      "visualizações de vídeo 95%",
      "video views 95%",
      "video 95%",
      "95% video views",
    ],
  },
  {
    key: "videoViews100",
    label: "Vídeo 100%",
    type: "number",
    aliases: [
      "visualizacao de video 100%",
      "visualização de vídeo 100%",
      "visualizacoes de video 100%",
      "visualizações de vídeo 100%",
      "video views 100%",
      "video 100%",
      "100% video views",
      "thruplay completo",
    ],
  },
  {
    key: "pageEngagement",
    label: "Engajamento da página",
    type: "number",
    aliases: [
      "engajamentos - page",
      "engajamento - page",
      "engajamentos page",
      "engajamento page",
      "page engagement",
      "page engagements",
      "engajamento da pagina",
      "engajamento da página",
    ],
  },
  {
    key: "postEngagement",
    label: "Engajamento do post",
    type: "number",
    aliases: [
      "engajamento - post",
      "engajamentos - post",
      "engajamento post",
      "engajamentos post",
      "post engagement",
      "post engagements",
      "engajamento da publicacao",
      "engajamento da publicação",
    ],
  },
  {
    key: "engagements",
    label: "Engajamentos",
    type: "number",
    aliases: [
      "engajamentos",
      "engajamento",
      "engagements",
      "engagement",
      "interacoes",
      "interações",
      "interactions",
    ],
  },
  {
    key: "results",
    label: "Resultados",
    type: "number",
    aliases: [
      "resultados",
      "resultado",
      "results",
      "result",
    ],
  },
  {
    key: "leads",
    label: "Leads",
    type: "number",
    aliases: [
      "leads",
      "lead",
      "cadastros",
      "cadastro",
      "contatos",
      "contato",
      "formularios",
      "formulários",
      "forms",
    ],
  },
  {
    key: "conversions",
    label: "Conversões",
    type: "number",
    aliases: [
      "conversoes",
      "conversões",
      "conversion",
      "conversions",
      "acoes de conversao",
      "ações de conversão",
    ],
  },
  {
    key: "purchases",
    label: "Compras",
    type: "number",
    aliases: [
      "compras",
      "compra",
      "purchases",
      "purchase",
      "pedidos",
      "orders",
    ],
  },
  {
    key: "spend",
    label: "Investimento",
    type: "currency",
    aliases: [
      "investido",
      "investimento",
      "valor investido",
      "valor gasto",
      "gasto",
      "gastos",
      "spend",
      "amount spent",
      "cost",
      "custo",
      "media spend",
      "mídia",
      "midia",
      "valor midia",
      "valor mídia",
    ],
  },
  {
    key: "revenue",
    label: "Receita",
    type: "currency",
    aliases: [
      "receita",
      "faturamento",
      "revenue",
      "purchase conversion value",
      "conversion value",
      "valor de conversao",
      "valor de conversão",
      "valor compras",
      "valor de compras",
    ],
  },
  {
    key: "ctr",
    label: "CTR",
    type: "percentage",
    aliases: [
      "ctr",
      "ctr link",
      "ctr (link)",
      "click through rate",
      "taxa de cliques",
      "taxa de clique",
    ],
  },
  {
    key: "cpc",
    label: "CPC",
    type: "currency",
    aliases: [
      "cpc",
      "custo por clique",
      "cost per click",
      "cpc link",
      "cpc (link)",
    ],
  },
  {
    key: "cpm",
    label: "CPM",
    type: "currency",
    aliases: [
      "cpm",
      "custo por mil",
      "cost per 1000 impressions",
      "cost per thousand impressions",
    ],
  },
  {
    key: "cpl",
    label: "CPL",
    type: "currency",
    aliases: [
      "cpl",
      "custo por lead",
      "cost per lead",
    ],
  },
  {
    key: "cpa",
    label: "CPA",
    type: "currency",
    aliases: [
      "cpa",
      "custo por aquisicao",
      "custo por aquisição",
      "cost per acquisition",
      "custo por resultado",
      "cost per result",
    ],
  },
  {
    key: "roas",
    label: "ROAS",
    type: "number",
    aliases: [
      "roas",
      "purchase roas",
      "return on ad spend",
      "retorno sobre investimento em anuncios",
      "retorno sobre investimento em anúncios",
    ],
  },
];

const NUMERIC_FIELDS = new Set<CanonicalField>(
  FIELD_REGISTRY.filter((field) =>
    ["number", "currency", "percentage"].includes(field.type)
  ).map((field) => field.key)
);

const SUMMABLE_FIELDS: CanonicalField[] = [
  "impressions",
  "reach",
  "clicks",
  "linkClicks",
  "outboundClicks",
  "landingPageViews",
  "videoViews25",
  "videoViews50",
  "videoViews75",
  "videoViews95",
  "videoViews100",
  "pageEngagement",
  "postEngagement",
  "engagements",
  "results",
  "leads",
  "conversions",
  "purchases",
  "spend",
  "revenue",
];

export function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_/\\|]+/g, " ")
    .replace(/[()[\]{}:;,.]/g, " ")
    .replace(/\s*-\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeFieldAliases(
  aliases: Record<string, CanonicalField>
): Record<string, CanonicalField> {
  return Object.fromEntries(
    Object.entries(aliases).map(([source, target]) => [
      normalizeHeader(source),
      target,
    ])
  );
}

function tokenize(value: string): Set<string> {
  return new Set(
    normalizeHeader(value)
      .split(" ")
      .filter((token) => token.length > 1)
  );
}

function tokenSimilarity(a: string, b: string): number {
  const aa = tokenize(a);
  const bb = tokenize(b);

  if (!aa.size || !bb.size) return 0;

  let intersection = 0;
  for (const token of aa) {
    if (bb.has(token)) intersection++;
  }

  const union = new Set([...aa, ...bb]).size;
  const jaccard = union ? intersection / union : 0;

  const na = normalizeHeader(a);
  const nb = normalizeHeader(b);

  let containment = 0;
  if (na.includes(nb) || nb.includes(na)) {
    const shorter = Math.min(na.length, nb.length);
    const longer = Math.max(na.length, nb.length);
    containment = longer ? shorter / longer : 0;
  }

  return Math.max(jaccard, containment);
}

function matchHeader(
  sourceHeader: string,
  fuzzyThreshold: number,
  fieldAliases: Record<string, CanonicalField>
): Omit<ColumnMapping, "columnIndex" | "source" | "inferredType"> {
  const normalizedSource = normalizeHeader(sourceHeader);
  const mappedField = fieldAliases[normalizedSource];

  if (mappedField && findDefinition(mappedField)) {
    return {
      target: mappedField,
      confidence: 1,
      method: "mapper",
    };
  }

  if (!normalizedSource) {
    return {
      target: null,
      confidence: 0,
      method: "unmapped",
    };
  }

  for (const field of FIELD_REGISTRY) {
    for (const alias of field.aliases) {
      if (sourceHeader.trim().toLowerCase() === alias.trim().toLowerCase()) {
        return {
          target: field.key,
          confidence: 1,
          method: "exact",
        };
      }

      if (normalizedSource === normalizeHeader(alias)) {
        return {
          target: field.key,
          confidence: 0.99,
          method: "normalized",
        };
      }
    }
  }

  let best:
    | {
        target: CanonicalField;
        confidence: number;
      }
    | undefined;

  for (const field of FIELD_REGISTRY) {
    for (const alias of field.aliases) {
      const score = tokenSimilarity(normalizedSource, alias);

      if (!best || score > best.confidence) {
        best = {
          target: field.key,
          confidence: score,
        };
      }
    }
  }

  if (best && best.confidence >= fuzzyThreshold) {
    return {
      target: best.target,
      confidence: Number(best.confidence.toFixed(3)),
      method: "fuzzy",
    };
  }

  return {
    target: null,
    confidence: best ? Number(best.confidence.toFixed(3)) : 0,
    method: "unmapped",
  };
}

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === "";
}

function looksLikeUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^https?:\/\/\S+/i.test(value.trim());
}

function looksLikeDate(value: unknown): boolean {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return true;
  if (typeof value !== "string") return false;

  const v = value.trim();

  return (
    /^\d{4}-\d{1,2}-\d{1,2}$/.test(v) ||
    /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(v)
  );
}

function looksLikeNumber(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string") return false;

  const v = value
    .trim()
    .replace(/\s/g, "")
    .replace(/R\$/gi, "")
    .replace(/US\$/gi, "")
    .replace(/[$€£]/g, "")
    .replace(/%/g, "");

  if (!v) return false;

  const normalized = normalizeNumericString(v);
  return normalized !== null && Number.isFinite(Number(normalized));
}

function inferColumnType(values: unknown[]): FieldType | "unknown" {
  const sample = values.filter((v) => !isEmpty(v)).slice(0, 20);

  if (!sample.length) return "unknown";

  const urlRate = sample.filter(looksLikeUrl).length / sample.length;
  if (urlRate >= 0.7) return "url";

  const dateRate = sample.filter(looksLikeDate).length / sample.length;
  if (dateRate >= 0.7) return "date";

  const percentageRate =
    sample.filter(
      (v) => typeof v === "string" && String(v).trim().includes("%")
    ).length / sample.length;
  if (percentageRate >= 0.7) return "percentage";

  const currencyRate =
    sample.filter(
      (v) =>
        typeof v === "string" &&
        /(R\$|US\$|\$|€|£)/i.test(String(v))
    ).length / sample.length;
  if (currencyRate >= 0.5) return "currency";

  const numberRate = sample.filter(looksLikeNumber).length / sample.length;
  if (numberRate >= 0.7) return "number";

  return "string";
}

/**
 * Converte strings numéricas BR/US comuns em representação JS.
 *
 * Exemplos:
 * "1.234,56" => "1234.56"
 * "1,234.56" => "1234.56"
 * "1234,56"  => "1234.56"
 * "1.234"    => "1234" (heurística de milhar)
 */
function normalizeNumericString(input: string): string | null {
  let value = input
    .trim()
    .replace(/\s/g, "")
    .replace(/R\$/gi, "")
    .replace(/US\$/gi, "")
    .replace(/[$€£]/g, "")
    .replace(/%/g, "");

  if (!value) return null;

  const hasComma = value.includes(",");
  const hasDot = value.includes(".");

  if (hasComma && hasDot) {
    const lastComma = value.lastIndexOf(",");
    const lastDot = value.lastIndexOf(".");

    if (lastComma > lastDot) {
      // BR: 1.234,56
      value = value.replace(/\./g, "").replace(",", ".");
    } else {
      // US: 1,234.56
      value = value.replace(/,/g, "");
    }
  } else if (hasComma) {
    const parts = value.split(",");

    if (parts.length === 2 && parts[1].length <= 2) {
      value = `${parts[0].replace(/\./g, "")}.${parts[1]}`;
    } else {
      value = value.replace(/,/g, "");
    }
  } else if (hasDot) {
    const parts = value.split(".");

    if (
      parts.length > 2 ||
      (parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3)
    ) {
      value = value.replace(/\./g, "");
    }
  }

  value = value.replace(/[^\d.-]/g, "");

  if (!value || value === "-" || value === "." || value === "-.") {
    return null;
  }

  return value;
}

export function parseNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") return null;

  const normalized = normalizeNumericString(value);
  if (normalized === null) return null;

  const result = Number(normalized);
  return Number.isFinite(result) ? result : null;
}

export function parsePercentage(value: unknown): number | null {
  const parsed = parseNumber(value);
  if (parsed === null) return null;

  // O padrão canônico é percentual "humano":
  // 1.5 significa 1,5%, e não 0.015.
  return parsed;
}

export function parseDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value !== "string") return null;

  const v = value.trim();

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v);
  if (iso) {
    const [, year, month, day] = iso;
    return validateDateParts(
      Number(year),
      Number(month),
      Number(day)
    );
  }

  const br = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(v);
  if (br) {
    const [, day, month, year] = br;

    let y = Number(year);
    if (y < 100) y += y >= 70 ? 1900 : 2000;

    // Preferência deliberada por DD/MM/AAAA para planilhas brasileiras.
    return validateDateParts(y, Number(month), Number(day));
  }

  return null;
}

function validateDateParts(
  year: number,
  month: number,
  day: number
): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");

  return `${year}-${mm}-${dd}`;
}

function parseUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return looksLikeUrl(v) ? v : null;
}

function normalizeValue(
  value: unknown,
  field: FieldDefinition
): string | number | null {
  if (isEmpty(value)) return null;

  switch (field.type) {
    case "number":
    case "currency":
      return parseNumber(value);

    case "percentage":
      return parsePercentage(value);

    case "date":
      return parseDate(value);

    case "url":
      return parseUrl(value);

    case "string":
    default:
      return String(value).trim();
  }
}

function findDefinition(
  key: CanonicalField
): FieldDefinition | undefined {
  return FIELD_REGISTRY.find((field) => field.key === key);
}

function safeDivide(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
  multiplier = 1
): number | null {
  if (
    numerator === null ||
    numerator === undefined ||
    denominator === null ||
    denominator === undefined ||
    denominator === 0
  ) {
    return null;
  }

  return (numerator / denominator) * multiplier;
}

function deriveRowMetrics(row: CanonicalRow): CanonicalRow {
  const clicksForRate =
    row.linkClicks ??
    row.outboundClicks ??
    row.clicks ??
    null;

  if (row.frequency == null) {
    row.frequency = safeDivide(row.impressions, row.reach);
  }

  if (row.ctr == null) {
    row.ctr = safeDivide(clicksForRate, row.impressions, 100);
  }

  if (row.cpc == null) {
    row.cpc = safeDivide(row.spend, clicksForRate);
  }

  if (row.cpm == null) {
    row.cpm = safeDivide(row.spend, row.impressions, 1000);
  }

  if (row.cpl == null) {
    row.cpl = safeDivide(row.spend, row.leads);
  }

  if (row.cpa == null) {
    const acquisition =
      row.conversions ??
      row.purchases ??
      row.results ??
      null;

    row.cpa = safeDivide(row.spend, acquisition);
  }

  if (row.roas == null) {
    row.roas = safeDivide(row.revenue, row.spend);
  }

  return row;
}

function detectHeaderRow(
  matrix: unknown[][],
  searchLimit: number,
  fuzzyThreshold: number
): number {
  if (!matrix.length) return 0;

  const limit = Math.min(matrix.length, searchLimit);
  let bestRow = 0;
  let bestScore = -1;

  for (let rowIndex = 0; rowIndex < limit; rowIndex++) {
    const row = matrix[rowIndex] ?? [];
    let score = 0;

    for (const cell of row) {
      if (isEmpty(cell)) continue;

      const match = matchHeader(String(cell), fuzzyThreshold, {});

      if (match.target) {
        score += match.confidence;
      }
    }

    // Favorece linhas que parecem realmente cabeçalhos.
    const nonEmpty = row.filter((cell) => !isEmpty(cell)).length;
    if (nonEmpty >= 3) score += Math.min(nonEmpty / 20, 0.5);

    if (score > bestScore) {
      bestScore = score;
      bestRow = rowIndex;
    }
  }

  return bestRow;
}

function buildMappings(
  headers: string[],
  dataRows: unknown[][],
  fuzzyThreshold: number,
  fieldAliases: Record<string, CanonicalField>
): ColumnMapping[] {
  const preliminary = headers.map((source, columnIndex) => {
    const match = matchHeader(source, fuzzyThreshold, fieldAliases);
    const columnValues = dataRows.map((row) => row?.[columnIndex]);

    return {
      columnIndex,
      source,
      target: match.target,
      confidence: match.confidence,
      method: match.method,
      inferredType: inferColumnType(columnValues),
    } satisfies ColumnMapping;
  });

  /**
   * Evita duas colunas diferentes ocuparem o mesmo campo canônico.
   * Mantemos a de maior confiança.
   */
  const bestByTarget = new Map<CanonicalField, ColumnMapping>();

  for (const mapping of preliminary) {
    if (!mapping.target) continue;

    const current = bestByTarget.get(mapping.target);
    if (!current || mapping.confidence > current.confidence) {
      bestByTarget.set(mapping.target, mapping);
    }
  }

  return preliminary.map((mapping) => {
    if (!mapping.target) return mapping;

    const winner = bestByTarget.get(mapping.target);

    if (winner?.columnIndex !== mapping.columnIndex) {
      return {
        ...mapping,
        target: null,
        method: "unmapped",
      };
    }

    return mapping;
  });
}

function isDataRowEmpty(row: unknown[]): boolean {
  return !row.some((cell) => !isEmpty(cell));
}

function buildCanonicalRow(
  rawRow: unknown[],
  mappings: ColumnMapping[],
  keepUnmapped: boolean,
  deriveMetrics: boolean
): CanonicalRow {
  const output: CanonicalRow = {};
  const unmapped: Record<string, unknown> = {};

  for (const mapping of mappings) {
    const rawValue = rawRow[mapping.columnIndex];

    if (!mapping.target) {
      if (keepUnmapped && !isEmpty(rawValue) && mapping.source) {
        unmapped[mapping.source] = rawValue;
      }
      continue;
    }

    const definition = findDefinition(mapping.target);
    if (!definition) continue;

    const normalized = normalizeValue(rawValue, definition);

    (output as Record<string, unknown>)[mapping.target] = normalized;
  }

  if (keepUnmapped && Object.keys(unmapped).length) {
    output._unmapped = unmapped;
  }

  return deriveMetrics ? deriveRowMetrics(output) : output;
}

function sumField(
  rows: CanonicalRow[],
  key: CanonicalField
): number | undefined {
  let total = 0;
  let hasValue = false;

  for (const row of rows) {
    const value = (row as Record<string, unknown>)[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      total += value;
      hasValue = true;
    }
  }

  return hasValue ? total : undefined;
}

export function buildSheetSummary(rows: CanonicalRow[]): SheetSummary {
  const summary: SheetSummary = {
    rowCount: rows.length,
  };

  for (const field of SUMMABLE_FIELDS) {
    const total = sumField(rows, field);

    if (total !== undefined) {
      (summary as unknown as Record<string, unknown>)[field] = total;
    }
  }

  const clicksForRate =
    summary.linkClicks ??
    summary.outboundClicks ??
    summary.clicks;

  summary.frequency =
    safeDivide(summary.impressions, summary.reach);

  summary.ctr =
    safeDivide(clicksForRate, summary.impressions, 100);

  summary.cpc =
    safeDivide(summary.spend, clicksForRate);

  summary.cpm =
    safeDivide(summary.spend, summary.impressions, 1000);

  summary.cpl =
    safeDivide(summary.spend, summary.leads);

  const acquisition =
    summary.conversions ??
    summary.purchases ??
    summary.results;

  summary.cpa =
    safeDivide(summary.spend, acquisition);

  summary.roas =
    safeDivide(summary.revenue, summary.spend);

  return summary;
}

/**
 * Função principal.
 */
export function transformSheet(
  matrix: unknown[][],
  options: TransformOptions = {}
): SheetTransformResult {
  const {
    headerSearchLimit = 10,
    fuzzyThreshold = 0.78,
    keepUnmapped = true,
    deriveMetrics = true,
    fieldAliases = {},
  } = options;

  if (!Array.isArray(matrix) || matrix.length === 0) {
    return {
      schemaVersion: "1.0",
      headerRowIndex: 0,
      headers: [],
      mappings: [],
      unidentifiedColumns: [],
      rows: [],
      summary: {
        rowCount: 0,
      },
    };
  }

  const headerRowIndex = detectHeaderRow(
    matrix,
    headerSearchLimit,
    fuzzyThreshold
  );

  const rawHeaders = matrix[headerRowIndex] ?? [];
  const headers = rawHeaders.map((header, index) => {
    const text = String(header ?? "").trim();
    return text || `column_${index + 1}`;
  });

  const dataRows = matrix
    .slice(headerRowIndex + 1)
    .filter((row) => Array.isArray(row) && !isDataRowEmpty(row));

  const mappings = buildMappings(
    headers,
    dataRows,
    fuzzyThreshold,
    normalizeFieldAliases(fieldAliases)
  );

  const rows = dataRows.map((rawRow) =>
    buildCanonicalRow(
      rawRow,
      mappings,
      keepUnmapped,
      deriveMetrics
    )
  );

  return {
    schemaVersion: "1.0",
    headerRowIndex,
    headers,
    mappings,
    unidentifiedColumns: mappings
      .filter((mapping) => mapping.target === null)
      .map((mapping) => mapping.source),
    rows,
    summary: buildSheetSummary(rows),
  };
}

/**
 * Se você já possui headers + objetos em vez de matriz,
 * esta função converte para o formato aceito por transformSheet.
 */
export function transformObjectRows(
  rows: Record<string, unknown>[],
  options: TransformOptions = {}
): SheetTransformResult {
  if (!rows.length) {
    return transformSheet([], options);
  }

  const headers = Array.from(
    new Set(rows.flatMap((row) => Object.keys(row)))
  );

  const matrix: unknown[][] = [
    headers,
    ...rows.map((row) => headers.map((header) => row[header])),
  ];

  return transformSheet(matrix, options);
}

/**
 * Exemplo rápido:
 *
 * const values = [
 *   [
 *     "Data",
 *     "Nome da Campanha",
 *     "Criativo",
 *     "Público",
 *     "Link Instagram Ad",
 *     "Impressões",
 *     "Alcance (estimado)",
 *     "Cliques no Link",
 *     "Visualizção de vídeo 75%",
 *     "Visualizção de vídeo 95%",
 *     "Engajamentos - Page",
 *     "Engajamento - Post",
 *     "Investido",
 *     "Link Ad",
 *   ],
 *   [
 *     "31/08/2026",
 *     "Campanha A",
 *     "Criativo 01",
 *     "Broad",
 *     "https://instagram.com/p/abc",
 *     "10.000",
 *     "8.000",
 *     "320",
 *     "1.200",
 *     "800",
 *     "150",
 *     "240",
 *     "R$ 1.250,50",
 *     "https://facebook.com/ads/example",
 *   ],
 * ];
 *
 * const json = transformSheet(values);
 */



