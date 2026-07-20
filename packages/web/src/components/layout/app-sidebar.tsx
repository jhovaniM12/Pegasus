"use client";

import { Bell, Calendar, DatabaseZap, Home, List, Settings, Shield, Users } from "lucide-react";

import { NavMain } from "@/components/layout/nav-main";
import { NavUser } from "@/components/layout/nav-user";
import { PegasoLogo } from "@/components/brand/pegaso-logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";

const navigationItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
  },
  {
    title: "Ferias",
    url: "/fairs",
    icon: Calendar,
  },
  {
    title: "Personas",
    url: "/people",
    icon: Users,
  },
  {
    title: "Ejemplares",
    url: "/horses",
    icon: Shield,
  },
  {
    title: "Categorías",
    url: "/categories",
    icon: List,
  },
  {
    title: "Recordatorios",
    url: "/recordatorios",
    icon: Bell,
  },
  {
    title: "Sincronizador",
    url: "/sincronizador",
    icon: DatabaseZap,
  },
  {
    title: "Configuración",
    url: "/settings",
    icon: Settings,
  },
];

const rootUser = {
  name: "Root",
  role: "Acceso administrativo",
  initials: "RO",
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border" {...props}>
      <SidebarHeader className="px-2 py-3">
        <div className="flex items-center gap-3 px-2 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <PegasoLogo size="sm" className="shrink-0 rounded-md bg-white/95 p-0.5" />
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="text-sm font-semibold leading-none text-sidebar-foreground">
              Pegaso
            </p>
            <p className="mt-1 text-xs text-sidebar-foreground/55">
              Panel root
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-0">
        <NavMain items={navigationItems} />
      </SidebarContent>

      <SidebarFooter className="px-2 pb-3">
        <NavUser user={rootUser} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
