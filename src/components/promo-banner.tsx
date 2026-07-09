import { LinkButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type HouseBanner = {
  kicker?: string;
  title: string;
  text?: string;
  ctaLabel: string;
  ctaHref: string;
  /** Image décorative (masquée sur mobile). */
  image?: string;
  tone?: "gold" | "surface";
  /** Transparence : marque le bandeau comme une annonce sponsorisée. */
  sponsored?: boolean;
};

/**
 * Bandeau promo « maison » inséré dans le flux (accueil, rayons). Pensé pour
 * héberger des mises en avant internes ou des emplacements sponsorisés, tout
 * en s'adaptant au mobile - plutôt que des colonnes de pub latérales qui
 * n'existent pas sur petit écran.
 */
export function PromoBanner({ banner }: { banner: HouseBanner }) {
  const { kicker, title, text, ctaLabel, ctaHref, image, tone = "surface", sponsored } =
    banner;

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border p-6 md:p-8",
        tone === "gold"
          ? "border-gold/30 bg-gold/[0.07]"
          : "border-white/10 bg-navy-surface",
      )}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-2/5 object-cover opacity-25 md:block"
        />
      ) : null}
      <div className="relative z-10 max-w-xl">
        {sponsored ? (
          <span className="font-label text-[10px] font-bold uppercase tracking-wide text-ink-muted/70">
            Annonce
          </span>
        ) : null}
        {kicker ? (
          <p className="font-label text-xs font-bold tracking-wide text-gold uppercase">
            {kicker}
          </p>
        ) : null}
        <h2 className="mt-1 font-display text-2xl font-extrabold md:text-3xl">
          {title}
        </h2>
        {text ? <p className="mt-2 text-ink-muted">{text}</p> : null}
        <LinkButton href={ctaHref} className="mt-5">
          {ctaLabel}
        </LinkButton>
      </div>
    </section>
  );
}
