import DashboardPage from "@/app/dashboard/page"

type DashboardAccessPageProps = {
  params: Promise<{
    accessId: string
  }>
}

export const dynamic = "force-dynamic"

export default async function DashboardAccessPage({
  params,
}: DashboardAccessPageProps) {
  const { accessId } = await params

  return DashboardPage({
    searchParams: Promise.resolve({
      cliente: accessId,
    }),
  })
}
