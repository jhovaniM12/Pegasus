/**
 * Full-screen branded loader for Pegasus.
 * Shown while a page is fetching its initial data.
 */
export function PageLoader({ label = "Cargando..." }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[#f5f7fb]">
      {/* Spinning ring with amber/gold Pegasus accent */}
      <div className="relative flex items-center justify-center">
        {/* Outer spinning ring */}
        <span
          className="absolute size-16 animate-spin rounded-full border-2 border-transparent border-t-amber-400"
          style={{ animationDuration: "1s" }}
          aria-hidden
        />
        {/* Inner pulsing ring */}
        <span
          className="absolute size-11 animate-spin rounded-full border border-slate-200 border-t-slate-300"
          style={{ animationDuration: "2s", animationDirection: "reverse" }}
          aria-hidden
        />
        {/* Center mark */}
        <span className="size-5 rounded-full bg-amber-400/20 ring-2 ring-amber-400/40" aria-hidden />
      </div>

      {/* Wordmark */}
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-500">Pegasus</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}
