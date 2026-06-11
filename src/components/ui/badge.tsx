import { cn } from "@/lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "wholesale" | "verified" | "neutral" | "danger";
};

const variants = {
  // B2B « Vente en gros » — contour or
  wholesale: "border border-gold text-gold",
  // « Vendeur vérifié » — fond émeraude
  verified: "bg-emerald text-navy-deep",
  neutral: "border border-white/15 text-ink-muted",
  danger: "border border-danger text-danger",
};

export function Badge({
  variant = "neutral",
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 font-label text-xs font-semibold tracking-wider",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
