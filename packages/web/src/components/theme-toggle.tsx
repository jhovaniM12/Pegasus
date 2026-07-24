"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

function subscribeToNothing() {
  return () => undefined;
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const mounted = useSyncExternalStore(subscribeToNothing, () => true, () => false);
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const label = mounted && isDark ? "Activar modo claro" : "Activar modo oscuro";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={!mounted}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "relative flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-card-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
        className
      )}
    >
      {mounted && isDark ? (
        <Sun className="size-4" aria-hidden="true" />
      ) : (
        <Moon className="size-4" aria-hidden="true" />
      )}
    </button>
  );
}
