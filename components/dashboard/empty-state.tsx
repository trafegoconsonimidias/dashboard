import { AlertCircleIcon } from "lucide-react"

export function EmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="flex min-h-[420px] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
        <AlertCircleIcon className="mx-auto size-9 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-semibold tracking-normal">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

export function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-44 items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}
