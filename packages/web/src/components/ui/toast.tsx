"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Scale,
  ShieldOff,
  Stethoscope,
  Trophy,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Input types ─────────────────────────────────────────────────────────────

type SimpleToastInput = {
  variant: "success" | "error";
  title: string;
  description?: string;
};

type NotificationToastInput = {
  variant: "notification";
  /** StageAction type, e.g. "PRE_RING_STARTED". Drives icon and color. */
  notificationType?: string;
  title: string;
  description?: string;
  fairName?: string | null;
  categoryName?: string | null;
  gaitName?: string | null;
  deepLink?: string | null;
  actionLabel?: string;
};

export type ToastInput = SimpleToastInput | NotificationToastInput;
type ToastMessage = ToastInput & { id: number };

type ToastContextValue = { toast: (input: ToastInput) => void };
const ToastContext = createContext<ToastContextValue | null>(null);

const DURATION_MS: Record<ToastInput["variant"], number> = {
  success: 4200,
  error: 4200,
  notification: 8000,
};

// ─── Per-type visual config ───────────────────────────────────────────────────

type AccentConfig = {
  headerBg: string;
  headerBorder: string;
  cardBorder: string;
  iconColor: string;
  labelColor: string;
  btnBg: string;
  btnHover: string;
  closeColor: string;
};

const ACCENT: Record<string, AccentConfig> = {
  /** Veterinario: checkeo pendiente */
  PRE_RING_STARTED: {
    headerBg: "bg-amber-50",
    headerBorder: "border-amber-100",
    cardBorder: "border-amber-200",
    iconColor: "text-amber-500",
    labelColor: "text-amber-800",
    btnBg: "bg-amber-500",
    btnHover: "hover:bg-amber-600",
    closeColor: "text-amber-400 hover:text-amber-600",
  },
  /** Director técnico: pre-pista lista, puede iniciar juzgamiento */
  PRE_RING_CLOSED: {
    headerBg: "bg-emerald-50",
    headerBorder: "border-emerald-100",
    cardBorder: "border-emerald-200",
    iconColor: "text-emerald-600",
    labelColor: "text-emerald-800",
    btnBg: "bg-emerald-600",
    btnHover: "hover:bg-emerald-700",
    closeColor: "text-emerald-400 hover:text-emerald-600",
  },
  /** Jueces + Veterinario: juzgamiento en curso */
  JUDGING_STARTED: {
    headerBg: "bg-blue-50",
    headerBorder: "border-blue-100",
    cardBorder: "border-blue-200",
    iconColor: "text-blue-600",
    labelColor: "text-blue-800",
    btnBg: "bg-blue-600",
    btnHover: "hover:bg-blue-700",
    closeColor: "text-blue-400 hover:text-blue-600",
  },
  /** Director técnico: un juez cerró su FA */
  JUDGE_FA_CLOSED: {
    headerBg: "bg-sky-50",
    headerBorder: "border-sky-100",
    cardBorder: "border-sky-200",
    iconColor: "text-sky-600",
    labelColor: "text-sky-800",
    btnBg: "bg-sky-600",
    btnHover: "hover:bg-sky-700",
    closeColor: "text-sky-400 hover:text-sky-600",
  },
  /** Jueces: ejemplar descalificado — alerta */
  JUDGING_PARTICIPANT_DISQUALIFIED: {
    headerBg: "bg-red-50",
    headerBorder: "border-red-100",
    cardBorder: "border-red-200",
    iconColor: "text-red-600",
    labelColor: "text-red-800",
    btnBg: "bg-red-600",
    btnHover: "hover:bg-red-700",
    closeColor: "text-red-400 hover:text-red-600",
  },
  /** Jueces + Director técnico: juzgamiento cerrado con resultado */
  FA_CONSOLIDATED: {
    headerBg: "bg-violet-50",
    headerBorder: "border-violet-100",
    cardBorder: "border-violet-200",
    iconColor: "text-violet-600",
    labelColor: "text-violet-800",
    btnBg: "bg-violet-600",
    btnHover: "hover:bg-violet-700",
    closeColor: "text-violet-400 hover:text-violet-600",
  },
};

const DEFAULT_ACCENT = ACCENT.PRE_RING_STARTED;

const ICON_BY_TYPE: Record<string, LucideIcon> = {
  PRE_RING_STARTED: Stethoscope,
  PRE_RING_CLOSED: CheckCircle2,
  JUDGING_STARTED: Scale,
  JUDGE_FA_CLOSED: ClipboardCheck,
  JUDGING_PARTICIPANT_DISQUALIFIED: ShieldOff,
  FA_CONSOLIDATED: Trophy,
};

// ─── Toast subcomponents ──────────────────────────────────────────────────────

function SimpleToast({
  message,
  onDismiss,
}: {
  message: ToastMessage & { variant: "success" | "error" };
  onDismiss: () => void;
}) {
  const Icon = message.variant === "success" ? CheckCircle2 : XCircle;

  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-lg border bg-white px-4 py-3 text-sm shadow-lg",
        message.variant === "success" ? "border-emerald-200" : "border-red-200"
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-5 shrink-0",
          message.variant === "success" ? "text-emerald-600" : "text-red-600"
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-5">{message.title}</p>
        {message.description && (
          <p className="mt-1 leading-5 text-slate-600">{message.description}</p>
        )}
      </div>
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onDismiss}
        className="ml-1 shrink-0 text-slate-400 hover:text-slate-600"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function NotificationToast({
  message,
  onDismiss,
}: {
  message: ToastMessage & { variant: "notification" };
  onDismiss: () => void;
}) {
  const type = message.notificationType ?? "";
  const accent = ACCENT[type] ?? DEFAULT_ACCENT;
  const Icon: LucideIcon = ICON_BY_TYPE[type] ?? Stethoscope;

  // "Pre-pista iniciada - Paso Fino" → typeLabel="Pre-pista iniciada"
  const dashIdx = message.title.indexOf(" - ");
  const typeLabel = dashIdx >= 0 ? message.title.slice(0, dashIdx) : message.title;

  // Category+gait detail below the fair name
  const detailLabel =
    message.categoryName && message.gaitName
      ? `${message.categoryName} — ${message.gaitName}`
      : dashIdx >= 0
        ? message.title.slice(dashIdx + 3)
        : "";

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-white shadow-xl",
        accent.cardBorder
      )}
    >
      {/* Header: icon + event label + fair + category/gait */}
      <div
        className={cn(
          "flex items-start gap-3 border-b px-4 py-3",
          accent.headerBg,
          accent.headerBorder
        )}
      >
        <Icon className={cn("mt-0.5 size-5 shrink-0", accent.iconColor)} />
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-semibold", accent.labelColor)}>{typeLabel}</p>
          {message.fairName && (
            <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide leading-4 text-slate-700">
              {message.fairName}
            </p>
          )}
          {detailLabel && (
            <p className="mt-0.5 text-xs text-slate-500">{detailLabel}</p>
          )}
        </div>
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onDismiss}
          className={cn("ml-1 mt-0.5 shrink-0 transition-colors", accent.closeColor)}
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Body text */}
      {message.description && (
        <p className="px-4 py-3 text-sm leading-5 text-slate-600">{message.description}</p>
      )}

      {/* CTA */}
      {message.deepLink && (
        <div className={cn("px-4 pb-4", !message.description && "pt-3")}>
          <a
            href={message.deepLink}
            onClick={onDismiss}
            className={cn(
              "flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors",
              accent.btnBg,
              accent.btnHover
            )}
          >
            {message.actionLabel ?? "Ver categoría"}
            <ArrowRight className="size-3.5" />
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: number) => {
    setMessages((current) => current.filter((m) => m.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = Date.now();
      setMessages((current) => [...current, { ...input, id }]);
      window.setTimeout(() => removeToast(id), DURATION_MS[input.variant]);
    },
    [removeToast]
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3 sm:right-6 sm:top-6">
        {messages.map((message) =>
          message.variant === "notification" ? (
            <NotificationToast
              key={message.id}
              message={message as ToastMessage & { variant: "notification" }}
              onDismiss={() => removeToast(message.id)}
            />
          ) : (
            <SimpleToast
              key={message.id}
              message={message as ToastMessage & { variant: "success" | "error" }}
              onDismiss={() => removeToast(message.id)}
            />
          )
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast debe usarse dentro de ToastProvider.");
  }

  return context;
}
