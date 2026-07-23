import { StageStatus } from "@/types/staged-flow"
import { Badge } from "@/components/ui/badge"

export const stageStatusLabels: Record<StageStatus, string> = {
  NOT_STARTED: "Sin iniciar",
  PRE_RING_STARTED: "Pre-pista iniciada",
  PRE_RING_CLOSED: "Pre-pista cerrada",
  JUDGING_STARTED: "Juzgamiento iniciado",
  FA_CONSOLIDATED: "FA consolidado",
  F1_IN_PROGRESS: "P1 en progreso",
  F1_CONSOLIDATED: "P1 consolidado",
  F2_IN_PROGRESS: "P2 en progreso",
  TIE_BREAK_IN_PROGRESS: "Desempate en curso",
  JUDGING_DESERTED: "Competencia desierta",
  JUDGING_CLOSED: "Resultado oficial",
}

const statusVariants: Record<StageStatus, "default" | "secondary" | "destructive" | "outline" | "success" | "warning"> = {
  NOT_STARTED: "secondary", // Gris
  PRE_RING_STARTED: "default", // Azul
  PRE_RING_CLOSED: "warning", // Amarillo/Atención sin bloqueo
  JUDGING_STARTED: "default", // Azul
  FA_CONSOLIDATED: "success", // Verde
  F1_IN_PROGRESS: "default", // Azul
  F1_CONSOLIDATED: "success", // Verde
  F2_IN_PROGRESS: "default", // Azul
  TIE_BREAK_IN_PROGRESS: "warning", // Atención: empate
  JUDGING_DESERTED: "outline", // Gris: sin premiación
  JUDGING_CLOSED: "success", // Verde: resultado oficial
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
      {stageStatusLabels[status]}
    </Badge>
  )
}
