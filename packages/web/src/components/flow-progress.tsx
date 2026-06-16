import { StageStatus } from "@/types/staged-flow"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

const stages: { status: StageStatus[]; label: string }[] = [
  { status: ["PRE_RING_STARTED"], label: "Pre-pista" },
  { status: ["PRE_RING_CLOSED"], label: "Aprobación" },
  { status: ["JUDGING_STARTED", "FA_CONSOLIDATED"], label: "FA" },
  { status: ["F1_IN_PROGRESS", "F1_CONSOLIDATED", "F2_IN_PROGRESS", "TIE_BREAK_IN_PROGRESS"], label: "F1 / F2" },
  { status: ["JUDGING_CLOSED", "JUDGING_DESERTED"], label: "Resultado" },
]

export function FlowProgress({ currentStatus }: { currentStatus: StageStatus }) {
  const currentStageIndex = stages.findIndex((stage) => stage.status.includes(currentStatus))

  // Si no ha iniciado (NOT_STARTED), el índice será -1, así que no hay etapa completada ni en progreso.
  const isFinished = currentStatus === "JUDGING_CLOSED" || currentStatus === "JUDGING_DESERTED"

  return (
    <div className="flex w-full items-center">
      {stages.map((stage, index) => {
        const isCompleted = isFinished || (currentStageIndex !== -1 && index < currentStageIndex)
        const isCurrent = index === currentStageIndex

        return (
          <div key={index} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors md:size-8",
                  isCompleted
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : isCurrent
                      ? "border-blue-600 bg-blue-50 text-blue-600"
                      : "border-slate-200 bg-slate-50 text-slate-400"
                )}
              >
                {isCompleted ? <Check className="size-4" /> : index + 1}
              </div>
              <span
                className={cn(
                  "hidden text-xs font-medium md:block",
                  isCompleted ? "text-slate-900" : isCurrent ? "text-blue-700" : "text-slate-500"
                )}
              >
                {stage.label}
              </span>
            </div>
            {index < stages.length - 1 && (
              <div
                className={cn(
                  "mx-2 h-0.5 w-full flex-1 rounded-full transition-colors md:mx-4",
                  isCompleted ? "bg-emerald-500" : "bg-slate-200"
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
