/**
 * Minimal Pegaso brand mark for loaders and empty states.
 */
export function PegasoMark({ className = "size-7 text-zapote" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M6 22c3-6 8-10 14-12 1 4-1 8-4 11-2 2-5 3-8 2 3-2 5-5 6-9-5 2-9 5-12 8Z"
        fill="currentColor"
        fillOpacity="0.9"
      />
      <path
        d="M20 10c4-1 7 1 9 5-3-1-6 0-8 2 1-3 0-5-1-7Z"
        fill="currentColor"
        fillOpacity="0.55"
      />
      <circle cx="23" cy="12" r="1.25" fill="currentColor" />
    </svg>
  );
}
