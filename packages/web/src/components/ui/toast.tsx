"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastInput = {
  variant: "success" | "error";
  title: string;
  description?: string;
};

type ToastMessage = ToastInput & { id: number };

type ToastContextValue = { toast: (input: ToastInput) => void };
const ToastContext = createContext<ToastContextValue | null>(null);

const DURATION_MS = 4200;

function SimpleToast({
  message,
  onDismiss,
}: {
  message: ToastMessage;
  onDismiss: () => void;
}) {
  const Icon = message.variant === "success" ? CheckCircle2 : XCircle;

  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg",
        message.variant === "success"
          ? "border-emerald-200 bg-emerald-50"
          : "border-red-200 bg-red-50"
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-5 shrink-0",
          message.variant === "success" ? "text-emerald-600" : "text-red-600"
        )}
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "font-semibold leading-5",
            message.variant === "success" ? "text-emerald-900" : "text-red-900"
          )}
        >
          {message.title}
        </p>
        {message.description && (
          <p
            className={cn(
              "mt-1 leading-5",
              message.variant === "success" ? "text-emerald-800/80" : "text-red-800/80"
            )}
          >
            {message.description}
          </p>
        )}
      </div>
      <button
        type="button"
        aria-label="Cerrar"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onDismiss();
        }}
        className={cn(
          "ml-1 shrink-0 transition-colors",
          message.variant === "success"
            ? "text-emerald-500 hover:text-emerald-700"
            : "text-red-400 hover:text-red-600"
        )}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  const timeoutsRef = useRef(new Map<number, number>());
  const nextIdRef = useRef(0);

  const removeToast = useCallback((id: number) => {
    const timeoutId = timeoutsRef.current.get(id);
    if (timeoutId != null) {
      window.clearTimeout(timeoutId);
      timeoutsRef.current.delete(id);
    }
    setMessages((current) => current.filter((m) => m.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = ++nextIdRef.current;
      setMessages((current) => [...current, { ...input, id }]);
      const timeoutId = window.setTimeout(() => removeToast(id), DURATION_MS);
      timeoutsRef.current.set(id, timeoutId);
    },
    [removeToast]
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[70] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3 sm:right-6 sm:top-6">
        {messages.map((message) => (
          <div key={message.id} className="pointer-events-auto">
            <SimpleToast message={message} onDismiss={() => removeToast(message.id)} />
          </div>
        ))}
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
