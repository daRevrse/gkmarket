import { StarIcon as StarOutline } from "@heroicons/react/24/outline";
import { StarIcon as StarSolid } from "@heroicons/react/24/solid";
import { cn } from "@/lib/utils";

/** Note en étoiles (affichage seul). La demi-étoile est arrondie au plus proche. */
export function Stars({
  rating,
  size = "sm",
  className,
}: {
  rating: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const filled = Math.round(rating);
  const starClass = size === "md" ? "size-5" : "size-4";
  return (
    <span
      className={cn("inline-flex items-center gap-0.5 text-gold", className)}
      role="img"
      aria-label={`${rating.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} sur 5`}
    >
      {[1, 2, 3, 4, 5].map((star) =>
        star <= filled ? (
          <StarSolid key={star} className={starClass} />
        ) : (
          <StarOutline key={star} className={cn(starClass, "text-ink-muted/50")} />
        ),
      )}
    </span>
  );
}

/** Note moyenne accompagnée du nombre d'avis. */
export function RatingSummaryLine({
  average,
  count,
  size = "sm",
  emptyLabel = "Pas encore d'avis",
}: {
  average: number;
  count: number;
  size?: "sm" | "md";
  emptyLabel?: string;
}) {
  if (count === 0) {
    return <span className="text-sm text-ink-muted">{emptyLabel}</span>;
  }
  return (
    <span className="inline-flex items-center gap-2">
      <Stars rating={average} size={size} />
      <span className={size === "md" ? "font-display font-bold" : "text-sm"}>
        {average.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}
      </span>
      <span className="text-sm text-ink-muted">
        {`(${count} avis)`}
      </span>
    </span>
  );
}
