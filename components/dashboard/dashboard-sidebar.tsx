"use client"

import * as React from "react"
import {
  DatabaseIcon,
  LayoutDashboardIcon,
  PanelLeftIcon,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import type {
  DashboardListItem,
  DashboardViewer,
} from "@/lib/dashboard/types"

type DashboardSidebarProps = React.ComponentProps<typeof Sidebar> & {
  activeDashboardSlug: string | null
  dashboards: DashboardListItem[]
  viewer: DashboardViewer
}

export function DashboardSidebar({
  activeDashboardSlug,
  dashboards,
  viewer,
  ...props
}: DashboardSidebarProps) {
  const activeDashboard =
    dashboards.find((dashboard) => dashboard.slug === activeDashboardSlug) ??
    dashboards[0]
  const clientAccessId =
    activeDashboard?.clientAccessId ?? activeDashboard?.slug.split("--")[0] ?? ""

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Dashboard da planilha">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <PanelLeftIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Consoni</span>
                <span className="truncate text-xs">Google Sheets</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{viewer.name}</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton isActive tooltip="Dashboard" render={<a href={`/dashboard/${clientAccessId}`} />}>
                <LayoutDashboardIcon />
                <span>Dashboard</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {dashboards.length ? (
              <SidebarMenuSub>
                {dashboards.map((dashboard) => (
                  <SidebarMenuSubItem key={dashboard.slug}>
                    <SidebarMenuSubButton
                      isActive={dashboard.slug === activeDashboardSlug}
                      render={<a href={buildSheetHref(clientAccessId, dashboard)} />}
                    >
                      <span>{cleanDashboardName(dashboard.name)}</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            ) : null}
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Fonte de dados" render={<a href={`/dashboard/${clientAccessId}`} />}>
                <DatabaseIcon />
                <span>Google Sheets</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-foreground">
                <DatabaseIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {cleanDashboardName(activeDashboard?.name ?? viewer.name)}
                </span>
                <span className="truncate text-xs">{viewer.email}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function buildSheetHref(clientAccessId: string, dashboard: DashboardListItem) {
  const sheet = dashboard.sheetSlug ?? dashboard.slug.split("--").slice(1).join("--")
  const base = `/dashboard/${encodeURIComponent(clientAccessId)}`

  return sheet ? `${base}?sheet=${encodeURIComponent(sheet)}` : base
}

function cleanDashboardName(value: string) {
  return value
    .replace(/^Dashboard\s+/i, "")
    .replace(/\s+-\s+SET\d+\s+Planilha Auxiliar Dashboard$/i, "")
    .replace(/\s+Planilha Auxiliar Dashboard$/i, "")
}