import { DashboardClient } from "@/components/dashboard/dashboard-client"
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { getDashboardAccess } from "@/lib/dashboard/access"
import { buildDashboardSnapshot } from "@/lib/dashboard/snapshot"

export const dynamic = "force-dynamic"

type DashboardPageProps = {
  searchParams: Promise<{
    cliente?: string
  }>
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const { cliente } = await searchParams
  const access = await getDashboardAccess(cliente)
  const initialSnapshot = access.activeSource
    ? await buildDashboardSnapshot(access.activeSource)
    : null
  const activeDashboardSlug =
    access.activeSource?.clientSlug ?? access.dashboards[0]?.slug ?? null

  return (
    <SidebarProvider>
      <DashboardSidebar
        activeDashboardSlug={activeDashboardSlug}
        dashboards={access.dashboards}
        viewer={access.viewer}
      />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-vertical:h-4 data-vertical:self-auto"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage>Dashboard da planilha</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <DashboardClient
          activeClientSlug={activeDashboardSlug}
          dashboards={access.dashboards}
          initialSnapshot={initialSnapshot}
          notices={access.notices}
        />
      </SidebarInset>
    </SidebarProvider>
  )
}
