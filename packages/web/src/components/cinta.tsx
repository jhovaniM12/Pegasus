import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const CINTA_CLIP_PATH =
  "polygon(0 0, 100% 0, calc(100% - 12px) 50%, 100% 100%, 0 100%, 12px 50%)";

const BORDER_FALLBACK = "rgba(15, 23, 42, 0.28)";

export type CintaVariant =
  | "primer"
  | "segundo"
  | "tercer"
  | "cuarto"
  | "quinto"
  | "sin_cinta"
  | "empate"
  | "provisional";

const VARIANT_CLASSES: Record<CintaVariant, string> = {
  primer: "bg-yellow-200 text-yellow-800",
  segundo: "bg-red-200 text-red-800",
  tercer: "bg-orange-200 text-orange-800",
  cuarto: "bg-emerald-200 text-emerald-800",
  quinto: "bg-blue-200 text-blue-800",
  sin_cinta: "bg-gray-200 text-gray-600",
  empate: "bg-yellow-300 text-yellow-900",
  provisional: "bg-gray-200 text-gray-500",
};

const VARIANT_BORDER_CLASSES: Record<CintaVariant, string> = {
  primer: "bg-yellow-500/70",
  segundo: "bg-red-500/70",
  tercer: "bg-orange-500/70",
  cuarto: "bg-emerald-600/60",
  quinto: "bg-blue-500/70",
  sin_cinta: "bg-slate-400/70",
  empate: "bg-yellow-600/70",
  provisional: "bg-slate-400/60",
};

type CintaProps = {
  text: string;
  /** Variante por defecto cuando no hay color configurado por ROOT. */
  variant?: CintaVariant;
  /** Color de fondo configurado por ROOT (`awardDistinctive.colorHex`). */
  colorHex?: string | null;
  icon?: LucideIcon;
  className?: string;
};

function darkenHex(hex: string, amount = 0.22): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return BORDER_FALLBACK;

  const channel = (start: number) =>
    Math.max(0, Math.min(255, Math.round(parseInt(clean.slice(start, start + 2), 16) * (1 - amount))));

  const r = channel(0);
  const g = channel(2);
  const b = channel(4);

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function Cinta({ text, variant = "sin_cinta", colorHex, icon: Icon, className }: CintaProps) {
  const usesConfiguredColor = Boolean(colorHex);
  const variantClasses = usesConfiguredColor ? "text-slate-900" : VARIANT_CLASSES[variant];
  const borderColor = usesConfiguredColor && colorHex ? darkenHex(colorHex) : undefined;
  const borderClass = usesConfiguredColor ? undefined : VARIANT_BORDER_CLASSES[variant];

  return (
    <span
      className={cn("inline-flex p-[1.5px]", borderClass)}
      style={{
        clipPath: CINTA_CLIP_PATH,
        WebkitClipPath: CINTA_CLIP_PATH,
        backgroundColor: borderColor,
        filter: "drop-shadow(0 1px 1px rgba(15, 23, 42, 0.08))",
      }}
    >
      <span
        className={cn(
          "inline-flex min-w-[7.25rem] items-center justify-center whitespace-nowrap px-6 py-1.5 text-sm font-bold",
          variantClasses,
          className
        )}
        style={{
          clipPath: CINTA_CLIP_PATH,
          WebkitClipPath: CINTA_CLIP_PATH,
          backgroundColor: usesConfiguredColor ? colorHex ?? undefined : undefined,
          width: "100%",
        }}
      >
        {Icon ? <Icon className="mr-1.5 size-4 stroke-[2.5]" /> : null}
        {text}
      </span>
    </span>
  );
}
