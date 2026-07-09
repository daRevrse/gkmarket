import Link from "next/link";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  /** Affiche un loader et désactive le bouton (soumission, upload…). */
  loading?: boolean;
};

const variants = {
  // Or massif, texte sombre en gras - CTA principaux
  primary:
    "bg-gold text-navy-deep font-bold hover:bg-gold-light active:bg-gold-dark",
  // Ghost émeraude - actions secondaires
  secondary:
    "border border-emerald text-emerald hover:bg-emerald/10 active:bg-emerald/20",
  ghost: "text-ink-muted hover:text-ink hover:bg-white/5",
  // Actions destructives
  danger: "border border-danger/60 text-danger hover:bg-danger/10",
};

const sizes = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3 text-sm",
  lg: "px-8 py-4 text-base",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-label font-semibold tracking-wide transition-colors disabled:pointer-events-none disabled:opacity-50";

export function Button({
  variant = "primary",
  size = "md",
  className,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner className="size-4" /> : null}
      {children}
    </button>
  );
}

type LinkButtonProps = React.ComponentProps<typeof Link> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: LinkButtonProps) {
  return (
    <Link
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
}
