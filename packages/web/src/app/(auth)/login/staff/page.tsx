"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PegasusLogo } from "@/components/brand/pegasus-logo";

function getAccessErrorMessage(data: unknown): string {
  if (
    data &&
    typeof data === "object" &&
    "error" in data &&
    data.error &&
    typeof data.error === "object" &&
    "message" in data.error &&
    typeof data.error.message === "string"
  ) {
    return data.error.message;
  }

  return "No se pudo validar el código.";
}

const STAFF_ROLES = new Set(["JUDGE", "TECHNICAL_DIRECTOR", "VETERINARIAN"]);

function readUserRole(data: unknown): string | null {
  if (
    data &&
    typeof data === "object" &&
    "data" in data &&
    data.data &&
    typeof data.data === "object" &&
    "role" in data.data &&
    typeof data.data.role === "string"
  ) {
    return data.data.role;
  }

  return null;
}

export default function AccessPage() {
  const router = useRouter();
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    void fetch("/api/auth/me")
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<unknown>;
      })
      .then((data) => {
        const role = readUserRole(data);
        if (role && STAFF_ROLES.has(role)) {
          router.replace("/staff");
        }
      })
      .finally(() => {
        setIsCheckingSession(false);
      });
  }, [router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/access-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(getAccessErrorMessage(data));
      }

      router.push("/staff");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo validar el código.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10">
      <div className="absolute inset-0 bg-[url('/login-hero.png')] bg-cover bg-center" />
      <div className="absolute inset-0 bg-slate-950/45" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/45 via-transparent to-slate-950/20" />

      {isCheckingSession ? (
        <div className="relative z-10 text-sm font-medium text-white/90">Cargando...</div>
      ) : (
        <div className="relative z-10 w-full max-w-sm rounded-lg border border-white/25 bg-white/92 p-6 shadow-2xl backdrop-blur-md">
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <PegasusLogo size="2xl" priority />
            <p className="text-xs text-slate-500">Acceso de staff</p>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-normal text-slate-950">Ingresa tu código</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Usa el código asignado por el usuario ROOT para consultar tus categorías.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="accessCode" className="text-sm font-semibold text-slate-800">
                Código de acceso
              </Label>
              <Input
                id="accessCode"
                value={accessCode}
                onChange={(event) => setAccessCode(event.target.value.toUpperCase().slice(0, 6))}
                placeholder="ABC123"
                required
                minLength={6}
                maxLength={6}
                className="h-16 text-center text-2xl font-semibold uppercase tracking-[0.22em]"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                {error}
              </div>
            )}

            <Button className="h-14 w-full text-base" type="submit" disabled={isLoading}>
              {isLoading ? "Validando..." : "Entrar"}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
