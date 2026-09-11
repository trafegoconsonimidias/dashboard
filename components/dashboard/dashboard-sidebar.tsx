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
          <SidebarGroupLabel>Planilha</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton isActive tooltip="Dashboard" render={<a href="/dashboard" />}>
                <LayoutDashboardIcon />
                <span>Dashboard</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Fonte de dados" render={<a href="/dashboard" />}>
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
                  {activeDashboard?.name ?? viewer.name}
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
