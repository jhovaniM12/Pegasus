"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ConnectionIndicator, SyncIndicator } from "@/components/network-status";
import { ThemeToggle } from "@/components/theme-toggle";
import { Fragment } from "react";

const routeLabels: Record<string, string> = {
  "/": "Dashboard",
  "/fairs": "Ferias",
  "/people": "Personas",
  "/categories": "Categorías",
  "/recordatorios": "Recordatorios",
  "/settings": "Configuración",
};

function buildCrumbs(pathname: string): { label: string; href: string; isLast: boolean }[] {
  if (pathname === "/") {
    return [{ label: "Dashboard", href: "/", isLast: true }];
  }

  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href: string; isLast: boolean }[] = [
    { label: "Dashboard", href: "/", isLast: false },
  ];

  let accumulated = "";
  segments.forEach((segment, index) => {
    accumulated += `/${segment}`;
    const isLast = index === segments.length - 1;
    const knownLabel = routeLabels[accumulated];
    const label = knownLabel ?? segment.charAt(0).toUpperCase() + segment.slice(1);
    crumbs.push({ label, href: accumulated, isLast });
  });

  return crumbs;
}

export function SiteHeader() {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname ?? "/");

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            {crumbs.map((crumb, index) => (
              <Fragment key={crumb.href}>
                {index > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {crumb.isLast ? (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink render={<Link href={crumb.href} />}>
                      {crumb.label}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ThemeToggle />
        <SyncIndicator />
        <ConnectionIndicator />
      </div>
    </header>
  );
}
