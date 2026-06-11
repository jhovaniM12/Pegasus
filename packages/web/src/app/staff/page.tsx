"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronDown, Gauge, LogOut, UserCircle, Users } from "lucide-react";
import { ConnectionIndicator } from "@/components/network-status";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type StaffCategory = {
  fair: {
    id: string;
    name: string | null;
  };
  gait: {
    id: string;
    name: string | null;
  };
  category: {
    id: string;
    name: string | null;
    minAgeMonths: number;
    maxAgeMonths: number;
  };
  totalEntries: number;
};

type CurrentUser = {
  personName: string | null;
  email: string | null;
  role: string;
  roleLabel: string;
};

function formatAgeRange(minAgeMonths: number, maxAgeMonths: number): string {
  return `${minAgeMonths} - ${maxAgeMonths} meses`;
}

function StaffUserMenu({
  currentUser,
  onLogout,
  className = "",
}: {
  currentUser: CurrentUser | null;
  onLogout: () => void;
  className?: string;
}) {
  const displayName = currentUser?.personName ?? currentUser?.email ?? "Usuario";
  const roleLabel = currentUser?.roleLabel ?? "Staff";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={`flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 ${className}`}
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-white text-slate-500">
              <UserCircle className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-950">{displayName}</p>
              <p className="text-xs text-slate-500">{roleLabel}</p>
            </div>
            <ChevronDown className="size-4 shrink-0 text-slate-500" />
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block truncate text-sm font-semibold text-slate-950">{displayName}</span>
            <span className="mt-1 block text-xs font-normal text-slate-500">{roleLabel}</span>
            {currentUser?.email && currentUser.email !== currentUser.personName && (
              <span className="mt-1 block truncate text-xs font-normal text-slate-500">
                {currentUser.email}
              </span>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="cursor-pointer" variant="destructive" onClick={onLogout}>
            <LogOut className="size-4" />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function StaffPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<StaffCategory[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me"),
      fetch("/api/staff/categories"),
    ])
      .then(async ([userResponse, categoriesResponse]) => {
        if (!userResponse.ok || !categoriesResponse.ok) {
          throw new Error("No autorizado");
        }

        const userPayload = (await userResponse.json()) as { data?: CurrentUser };
        const categoriesPayload = (await categoriesResponse.json()) as { data?: StaffCategory[] };

        setCurrentUser(userPayload.data ?? null);
        setCategories(categoriesPayload.data ?? []);
      })
      .catch(() => {
        router.push("/login/staff");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login/staff");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur md:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Pegasus</p>
            <h1 className="text-xl font-semibold tracking-normal text-slate-950">Categorías asignadas</h1>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            <ConnectionIndicator />
            <StaffUserMenu currentUser={currentUser} onLogout={logout} className="max-w-72" />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 lg:py-8">
        <div className="mb-4 flex items-center gap-3 sm:hidden">
          <ConnectionIndicator className="shrink-0" />
          <StaffUserMenu currentUser={currentUser} onLogout={logout} className="w-full bg-white" />
        </div>

        {loading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-44 animate-pulse rounded-lg border border-slate-200 bg-white"
              />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white px-6 py-12 text-center">
            <p className="text-sm font-medium text-slate-700">No hay categorías asignadas.</p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {categories.map((item) => (
              <article
                key={`${item.fair.id}-${item.category.id}`}
                className="flex min-h-44 flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        <CalendarDays className="size-3.5" />
                        <span className="truncate">{item.fair.name ?? "Feria sin nombre"}</span>
                      </div>
                      <h2 className="mt-3 text-sm font-semibold leading-5 text-slate-950">
                        {item.category.name ?? "Categoría sin nombre"}
                      </h2>
                    </div>
                    <Badge variant="secondary" className="w-fit shrink-0 rounded-md">
                      {item.gait.name ?? "Sin andar"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                        <Gauge className="size-3.5" />
                        Edad
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-950">
                        {formatAgeRange(item.category.minAgeMonths, item.category.maxAgeMonths)}
                      </p>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                        <Users className="size-3.5" />
                        Inscritos
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-950">
                        {item.totalEntries}
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
