import Link from "next/link";
import { Eye, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { JudgeFormat, JudgeFormatKey, JudgeFormatStatus } from "@/types/staged-flow";

const FORMAT_LABELS: Record<JudgeFormatKey, string> = {
  FA: "Formato FA",
  F1: "Formato F1",
  F2: "Formato F2",
  TIE_BREAK: "Formato desempate",
};

const STATUS_LABELS: Record<JudgeFormatStatus, string> = {
  NOT_AVAILABLE: "Sin iniciar",
  PENDING: "Sin iniciar",
  STARTED: "Iniciado",
  CLOSED: "Cerrado",
};

function formatButtonLabel(format: JudgeFormat): string {
  const base = FORMAT_LABELS[format.key];

  if (format.isActive && format.formStatus === "PENDING") {
    if (format.key === "FA") {
      return `Iniciar ${base}`;
    }
    if (format.key === "TIE_BREAK") {
      if (format.participantCount != null) {
        return `Iniciar juzgamiento de desempate (${format.participantCount} finalistas)`;
      }
      return "Iniciar juzgamiento de desempate";
    }
    if (format.participantCount != null) {
      return `Iniciar Juzgamiento ${format.key} (${format.participantCount} finalistas)`;
    }
    return `Iniciar Juzgamiento ${format.key}`;
  }

  if (format.isActive && format.formStatus === "STARTED") {
    if (format.key === "TIE_BREAK") {
      return "Continuar juzgamiento de desempate";
    }
    return `Continuar ${base} (${STATUS_LABELS.STARTED})`;
  }

  return `Ver ${base} (${STATUS_LABELS[format.formStatus]})`;
}

function formatButtonClass(format: JudgeFormat): string {
  if (format.formStatus === "NOT_AVAILABLE") {
    return "bg-slate-200 text-slate-500 hover:bg-slate-200 cursor-not-allowed";
  }
  if (format.isActive) {
    return "bg-violet-600 hover:bg-violet-700 text-white";
  }
  return "bg-slate-600 hover:bg-slate-700 text-white";
}

type JudgeFormatActionsProps = {
  stageId: string;
  formats: JudgeFormat[];
  officialResultAvailable?: boolean;
  onStartFa?: () => void;
  onStartRound?: (format: JudgeFormat) => void;
};

function shouldStartFa(format: JudgeFormat): boolean {
  return format.key === "FA" && format.isActive && format.formStatus === "PENDING";
}

function shouldStartRound(format: JudgeFormat): boolean {
  return (
    (format.key === "F1" || format.key === "F2" || format.key === "TIE_BREAK") &&
    format.isActive &&
    format.formStatus === "PENDING"
  );
}

export function JudgeFormatActions({
  stageId,
  formats,
  officialResultAvailable = false,
  onStartFa,
  onStartRound,
}: JudgeFormatActionsProps) {
  const visibleFormats = formats.filter(
    (format) =>
      (format.formStatus !== "NOT_AVAILABLE" || format.key !== "TIE_BREAK") &&
      !(officialResultAvailable && format.key === "TIE_BREAK")
  );

  if (visibleFormats.length === 0 && !officialResultAvailable) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-col gap-2">
      {visibleFormats.map((format) => {
        const disabled = format.formStatus === "NOT_AVAILABLE";
        const href = `/staff/categories/${stageId}?view=${format.key}`;
        const Icon = format.isActive && !disabled ? Play : Eye;
        const startsFa = shouldStartFa(format);
        const startsRound = shouldStartRound(format);

        if (disabled) {
          return (
            <Button
              key={format.key}
              type="button"
              disabled
              className={`w-full rounded-md ${formatButtonClass(format)}`}
            >
              <Icon className="size-4" />
              {formatButtonLabel(format)}
            </Button>
          );
        }

        if (startsFa && onStartFa) {
          return (
            <Button
              key={format.key}
              type="button"
              className={`w-full rounded-md ${formatButtonClass(format)}`}
              onClick={onStartFa}
            >
              <Icon className="size-4" />
              {formatButtonLabel(format)}
            </Button>
          );
        }

        if (startsRound && onStartRound) {
          return (
            <Button
              key={format.key}
              type="button"
              className={`w-full rounded-md ${formatButtonClass(format)}`}
              onClick={() => onStartRound(format)}
            >
              <Icon className="size-4" />
              {formatButtonLabel(format)}
            </Button>
          );
        }

        return (
          <Button
            key={format.key}
            className={`w-full rounded-md ${formatButtonClass(format)}`}
            nativeButton={false}
            render={<Link href={href} />}
          >
            <Icon className="size-4" />
            {formatButtonLabel(format)}
          </Button>
        );
      })}
      {officialResultAvailable && (
        <Button
          className="w-full rounded-md bg-slate-800 text-white hover:bg-slate-900"
          nativeButton={false}
          render={<Link href={`/staff/categories/${stageId}`} />}
        >
          <Eye className="size-4" />
          Ver resultado oficial
        </Button>
      )}
    </div>
  );
}
