/**
 * Full-screen branded loader for Pegasus with premium transitions and glow effects.
 * Shown while a page is fetching its initial data.
 */
export function PageLoader({ label = "Cargando..." }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-gradient-to-tr from-slate-50 via-white to-slate-100/70 transition-all duration-300 animate-in fade-in duration-300">
      
      {/* Container for Spinner with Brand Glow */}
      <div className="relative flex items-center justify-center">
        
        {/* Ambient Brand Glow behind the spinner */}
        <div className="absolute size-32 rounded-full bg-amber-400/8 blur-3xl animate-pulse" />
        
        {/* Outer glowing spinning ring */}
        <span
          className="absolute size-20 animate-spin rounded-full border-[3px] border-slate-100/40 border-t-amber-500 shadow-[0_0_15px_-3px_rgba(245,158,11,0.2)]"
          style={{ animationDuration: "1.2s" }}
          aria-hidden
        />
        
        {/* Inner pulsing ring moving in reverse */}
        <span
          className="absolute size-13 animate-spin rounded-full border border-slate-200/80 border-t-slate-400"
          style={{ animationDuration: "2.4s", animationDirection: "reverse" }}
          aria-hidden
        />
        
        {/* Golden Core Center mark */}
        <span className="size-6 rounded-full bg-amber-500/10 ring-[3px] ring-amber-500/35 shadow-[0_0_10px_0_rgba(245,158,11,0.15)] animate-pulse" aria-hidden />
      </div>

      {/* Branded Wordmark & Pulsing Subtitle */}
      <div className="flex flex-col items-center gap-2.5 text-center animate-in fade-in slide-in-from-bottom-3 duration-500 delay-100">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-600 drop-shadow-[0_1px_2px_rgba(217,119,6,0.05)]">
          Pegasus
        </p>
        <p className="animate-pulse text-sm font-medium text-slate-500/90 duration-[1.8s]">
          {label}
        </p>
      </div>
    </div>
  );
}
