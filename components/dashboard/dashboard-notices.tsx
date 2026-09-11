import { AlertCircleIcon } from "lucide-react"

export function DashboardNotices({ notices }: { notices: string[] }) {
  if (!notices.length) {
    return null
  }

  return (
    <div className="grid gap-2">
      {notices.map((notice) => (
        <div
          key={notice}
          className="flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground"
        >
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
          <span>{notice}</span>
        </div>
      ))}
    </div>
  )
}
