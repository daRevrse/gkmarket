import { cn } from "@/lib/utils";

/** Indicateur de chargement (soumission de formulaire, upload…). */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin", className)}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label="Chargement"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        className="opacity-25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Voile de chargement à superposer sur une zone (ex. pendant un upload). */
export function LoadingOverlay({ label }: { label?: string }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-[inherit] bg-navy-deep/70 backdrop-blur-sm">
      <Spinner className="size-6 text-gold" />
      {label ? <p className="text-sm text-ink-muted">{label}</p> : null}
    </div>
  );
}
