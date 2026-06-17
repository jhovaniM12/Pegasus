"use client";

import { Bell, Calendar, Home, List, Settings, Shield, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
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
    title: "Configuración",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="px-4 py-5 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-base font-bold text-sidebar-primary-foreground">
            P
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="text-sm font-semibold leading-none text-white">Pegasus</p>
            <p className="mt-1 text-xs text-white/55">Panel root</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 group-data-[collapsible=icon]:px-0">
        <SidebarGroup className="group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
          <SidebarGroupLabel className="px-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-white/40">
            Navegación
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1 group-data-[collapsible=icon]:items-center">
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    className="h-10 rounded-lg px-3 text-white/72 hover:bg-white/8 hover:text-white data-active:bg-white/12 data-active:text-white group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:[&>span]:hidden"
                    isActive={
                      pathname === item.url ||
                      (item.url !== "/" && pathname?.startsWith(item.url))
                    }
                    tooltip={item.title}
                    render={
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    }
                  />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-4 py-4 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2">
        <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3 group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-white/10 group-data-[collapsible=icon]:p-0">
          <div className="flex size-8 items-center justify-center rounded-md bg-white/10 text-white">
            <Shield className="size-4" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-xs font-semibold text-white">Root</p>
            <p className="truncate text-xs text-white/45">Acceso administrativo</p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
