import DashboardPage from "@/app/dashboard/page"

type DashboardAccessPageProps = {
  params: Promise<{
    accessId: string
  }>
  searchParams: Promise<{
    sheet?: string
  }>
}

export const dynamic = "force-dynamic"

export default async function DashboardAccessPage({
  params,
  searchParams,
}: DashboardAccessPageProps) {
  const { accessId } = await params
  const { sheet } = await searchParams

  return DashboardPage({
    searchParams: Promise.resolve({
      cliente: accessId,
      sheet,
    }),
  })
}