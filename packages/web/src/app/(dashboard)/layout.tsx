import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { LogoutButton } from "@/components/layout/logout-button";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="relative z-0 flex flex-1 flex-col h-svh overflow-hidden bg-[#f5f7fb]">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-md lg:px-7 z-10">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="text-slate-500 hover:bg-slate-100 hover:text-slate-950" />
            <div className="hidden h-8 w-px bg-slate-200 md:block" />
            <div className="hidden md:block">
              <p className="text-sm font-semibold text-slate-950">Panel administrativo</p>
              <p className="text-xs text-slate-500">Operación y catálogos Pegasus</p>
            </div>
          </div>
          <LogoutButton />
        </header>
        <main className="flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
