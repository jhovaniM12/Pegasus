import { StageStatus } from "@/types/staged-flow"
import { Badge } from "@/components/ui/badge"

const statusLabels: Record<StageStatus, string> = {
  NOT_STARTED: "Sin iniciar",
  PRE_RING_STARTED: "Pre-pista iniciada",
  PRE_RING_CLOSED: "Pre-pista cerrada",
  JUDGING_STARTED: "Juzgamiento iniciado",
  FA_CONSOLIDATED: "FA consolidado",
  JUDGING_CLOSED: "Juzgamiento cerrado",
}

const statusVariants: Record<StageStatus, "default" | "secondary" | "destructive" | "outline" | "success" | "warning"> = {
  NOT_STARTED: "secondary", // Gris
  PRE_RING_STARTED: "default", // Azul
  PRE_RING_CLOSED: "warning", // Amarillo/Atención sin bloqueo
  JUDGING_STARTED: "default", // Azul
  FA_CONSOLIDATED: "success", // Verde
  JUDGING_CLOSED: "secondary", // Gris oscuro/Neutro
}

// Map custom variants to tailwind classes if the badge component doesn't support them natively
const variantStyles: Record<string, string> = {
  default: "bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200",
  secondary: "bg-slate-100 text-slate-800 hover:bg-slate-200 border-slate-200",
  destructive: "bg-red-100 text-red-800 hover:bg-red-200 border-red-200",
  outline: "",
  success: "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-200",
  warning: "bg-orange-100 text-orange-800 hover:bg-orange-200 border-orange-200",
}

export function StageStatusBadge({ status, className }: { status: StageStatus; className?: string }) {
  const variant = statusVariants[status] || "outline"
  const customClass = variantStyles[variant] || ""

  return (
    <Badge className={`w-fit rounded-md font-medium px-2.5 py-0.5 border ${customClass} ${className || ""}`} variant="outline">
      {statusLabels[status]}
    </Badge>
  )
}
