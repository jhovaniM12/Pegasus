"use client";

import { ChevronDown, LogOut, UserCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type StaffUserMenuUser = {
  personName?: string | null;
  email?: string | null;
  roleLabel?: string | null;
};

type StaffUserMenuProps = {
  currentUser: StaffUserMenuUser | null;
  onLogout: () => void;
  className?: string;
};

export function StaffUserMenu({
  currentUser,
  onLogout,
  className = "",
}: StaffUserMenuProps) {
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
