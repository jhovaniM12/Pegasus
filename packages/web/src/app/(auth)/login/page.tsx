"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PegasusLogo } from "@/components/brand/pegasus-logo";

function getLoginErrorMessage(data: unknown): string {
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

  return "No se pudo iniciar sesión.";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(getLoginErrorMessage(data));
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-[#f7f8f5] lg:grid-cols-[minmax(480px,0.92fr)_1.08fr]">
      <div className="flex min-h-screen w-full items-center justify-center px-6 py-10 sm:px-10 lg:px-16">
        <div className="w-full max-w-[420px]">
          <div className="mb-10">
            <PegasusLogo size="lg" priority />
            <p className="mt-4 text-sm text-slate-500">Panel administrativo</p>
          </div>

          <div className="mb-8">
            <h1 className="text-4xl font-semibold tracking-normal text-slate-950">Iniciar sesión</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Ingresa tus credenciales para acceder al panel de control.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-slate-700">Email corporativo</Label>
              <Input
                id="email"
                type="email"
                placeholder="root@pegaso.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 rounded-lg border-slate-200 bg-white px-4 text-slate-950 shadow-sm placeholder:text-slate-400 focus-visible:border-slate-400 focus-visible:ring-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-slate-700">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Ingresa tu contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 rounded-lg border-slate-200 bg-white px-4 pr-12 text-slate-950 shadow-sm focus-visible:border-slate-400 focus-visible:ring-slate-200"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                {error}
              </div>
            )}

            <Button
              className="h-12 w-full rounded-lg bg-primary text-base font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? "Verificando..." : "Iniciar sesión"}
            </Button>
          </form>
        </div>
      </div>

      <div className="relative hidden min-h-screen overflow-hidden lg:block">
        <div className="absolute inset-0 bg-[url('/login-hero.png')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/20 via-transparent to-slate-950/45" />
        <div className="absolute inset-x-0 bottom-0 p-12">
          <div className="max-w-md rounded-lg border border-white/15 bg-white/12 p-6 text-white shadow-2xl backdrop-blur-md">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/70">Control operativo</p>
            <p className="mt-3 text-2xl font-semibold leading-tight">
              Gestión con datos centralizados y acceso seguro.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
