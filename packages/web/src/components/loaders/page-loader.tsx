import { PegasoLogo } from "@/components/brand/pegaso-logo";

type PageLoaderProps = {
  label?: string;
  /** When true, covers the viewport. When false, fills the parent container. */
  fullScreen?: boolean;
};

/**
 * Branded loader for Pegaso. Used while a page fetches its initial data.
 */
export function PageLoader({
  label = "Cargando...",
  fullScreen = true,
}: PageLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={
        fullScreen
          ? "fixed inset-0 z-40 flex flex-col items-center justify-center gap-8 bg-[#f5f7fb] animate-in fade-in duration-300"
          : "flex min-h-48 flex-col items-center justify-center gap-6 py-12 animate-in fade-in duration-300"
      }
    >
      <div className="relative flex items-center justify-center">
        <div className="absolute size-32 rounded-full bg-zapote/10 blur-3xl" aria-hidden />

        <span
          className="absolute size-20 motion-safe:animate-spin rounded-full border-[3px] border-slate-200/60 border-t-zapote shadow-[0_0_18px_-4px_rgba(255,149,0,0.35)]"
          style={{ animationDuration: "1.2s" }}
          aria-hidden
        />

        <span
          className="absolute size-14 motion-safe:animate-spin rounded-full border border-slate-200/80 border-t-slate-400"
          style={{ animationDuration: "2.4s", animationDirection: "reverse" }}
          aria-hidden
        />

        <div
          className="relative flex size-14 items-center justify-center rounded-full bg-white p-1.5 ring-[3px] ring-zapote/30 shadow-sm"
          aria-hidden
        >
          <PegasoLogo size="xs" className="size-full" priority />
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-zapote">Pegaso</p>
        <p className="text-sm font-medium text-slate-500">{label}</p>
      </div>
    </div>
  );
}
