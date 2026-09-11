import type { FieldType } from "@/engine/engine"

export type MetricFormatType = FieldType | "integer"

export function formatMetric(value: number, type: MetricFormatType) {
  if (!Number.isFinite(value)) {
    return "-"
  }

  if (type === "currency") {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: value >= 1000 ? 0 : 2,
    }).format(value)
  }

  if (type === "percentage") {
    return `${new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: 2,
    }).format(value)}%`
  }

  return new Intl.NumberFormat("pt-BR", {
    notation: Math.abs(value) >= 100_000 ? "compact" : "standard",
    maximumFractionDigits: type === "integer" ? 0 : 2,
  }).format(value)
}

export function formatDate(value: string) {
  const [year, month, day] = value.split("-")

  if (!year || !month || !day) {
    return value
  }

  return `${day}/${month}/${year}`
}

export function formatShortDate(value: string) {
  const [year, month, day] = value.split("-")

  if (!year || !month || !day) {
    return value
  }

  return `${day}/${month}`
}

export function formatDateTime(value?: string) {
  if (!value) {
    return "aguardando leitura"
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value))
}
