import { ExternalLinkIcon, Table2Icon } from "lucide-react"

import { EmptyPanel } from "@/components/dashboard/empty-state"
import { formatDate, formatMetric } from "@/lib/dashboard/format"
import type {
  DashboardSnapshot,
  DashboardTableColumn,
} from "@/lib/dashboard/types"

export function DashboardDataTable({ snapshot }: { snapshot: DashboardSnapshot }) {
  const table = snapshot.model.table

  return (
    <section className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 className="text-base font-semibold tracking-normal">
            Linhas recentes
          </h2>
          <p className="text-sm text-muted-foreground">
            {snapshot.sheet.rowCount} registro(s) lidos
          </p>
        </div>
        <Table2Icon className="size-5 text-muted-foreground" />
      </div>

      {table.columns.length && table.rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                {table.columns.map((column) => (
                  <th key={column.key} className="px-4 py-3 font-medium">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row) => (
                <tr key={row.id} className="border-t">
                  {table.columns.map((column) => (
                    <td key={column.key} className="px-4 py-3">
                      <TableCell column={column} value={row.cells[column.key]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-4">
          <EmptyPanel message="Nenhuma linha mapeada para exibir." />
        </div>
      )}
    </section>
  )
}

function TableCell({
  column,
  value,
}: {
  column: DashboardTableColumn
  value: string | number | null | undefined
}) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">-</span>
  }

  if (column.type === "url" && typeof value === "string") {
    return (
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-foreground underline-offset-2 hover:underline"
      >
        Abrir
        <ExternalLinkIcon className="size-3" />
      </a>
    )
  }

  if (typeof value === "number") {
    return formatMetric(value, column.type)
  }

  if (column.type === "date") {
    return formatDate(value)
  }

  return <span className="line-clamp-2">{value}</span>
}
