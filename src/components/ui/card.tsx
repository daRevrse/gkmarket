import { cn } from "@/lib/utils";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Ajoute la sous-lueur dorée réservée aux éléments premium / mis en avant. */
  glow?: boolean;
};

export function Card({ glow = false, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "glass rounded-xl p-8 shadow-card",
        glow && "glow-gold",
        className,
      )}
      {...props}
    />
  );
}

export function CardSection({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-lg bg-white/[0.03] p-6", className)}
      {...props}
    />
  );
}
