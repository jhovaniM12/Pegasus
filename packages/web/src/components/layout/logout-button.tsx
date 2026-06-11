"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleLogout}
      disabled={isLoading}
      className="h-10 rounded-lg border-slate-200 bg-white px-3 text-slate-700 hover:bg-slate-50 hover:text-slate-950"
    >
      <LogOut className="size-4" />
      {isLoading ? "Cerrando..." : "Cerrar sesión"}
    </Button>
  );
}
