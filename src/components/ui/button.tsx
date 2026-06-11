import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
};

const variants = {
  // Or massif, texte sombre en gras — CTA principaux
  primary:
    "bg-gold text-navy-deep font-bold hover:bg-gold-light active:bg-gold-dark",
  // Ghost émeraude — actions secondaires
  secondary:
    "border border-emerald text-emerald hover:bg-emerald/10 active:bg-emerald/20",
  ghost: "text-ink-muted hover:text-ink hover:bg-white/5",
};

const sizes = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3 text-sm",
  lg: "px-8 py-4 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-label font-semibold tracking-wide transition-colors disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
