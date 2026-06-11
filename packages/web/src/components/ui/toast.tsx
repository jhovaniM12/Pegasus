"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error";

type ToastInput = {
  title: string;
  description?: string;
  variant: ToastVariant;
};

type ToastMessage = ToastInput & {
  id: number;
};

type ToastContextValue = {
  toast: (input: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: number) => {
    setMessages((current) => current.filter((message) => message.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = Date.now();
      setMessages((current) => [...current, { ...input, id }]);
      window.setTimeout(() => removeToast(id), 4200);
    },
    [removeToast]
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3 sm:right-6 sm:top-6">
        {messages.map((message) => {
          const Icon = message.variant === "success" ? CheckCircle2 : XCircle;

          return (
            <div
              key={message.id}
              role="status"
              className={cn(
                "flex items-start gap-3 rounded-lg border bg-white px-4 py-3 text-sm shadow-lg",
                message.variant === "success"
                  ? "border-emerald-200 text-emerald-900"
                  : "border-red-200 text-red-900"
              )}
            >
              <Icon
                className={cn(
                  "mt-0.5 size-5 shrink-0",
                  message.variant === "success" ? "text-emerald-600" : "text-red-600"
                )}
              />
              <div className="min-w-0">
                <p className="font-semibold leading-5">{message.title}</p>
                {message.description && (
                  <p className="mt-1 leading-5 text-slate-600">{message.description}</p>
                )}
              </div>
            </div>
          );
        })}
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
