import Link from "next/link";
import { Countdown } from "@/components/countdown";
import { Badge } from "@/components/ui/badge";
import { formatFcfa } from "@/lib/format";
import { isPromoActive } from "@/lib/pricing";

export type CatalogProduct = {
  id: string;
  title: string;
  priceFcfa: number;
  wholesalePriceFcfa: number | null;
  stock: number;
  imageUrl: string | null;
  shopName: string | null;
  promoPriceFcfa?: number | null;
  promoEndsAt?: Date | string | null;
};

export function ProductCard({
  product,
  tag,
}: {
  product: CatalogProduct;
  /** Pastille de mise en avant (ex. « À la une », « Sponsorisé »). */
  tag?: string;
}) {
  const promo = isPromoActive({ ...product, wholesaleMinQty: null });
  const promoPct = promo
    ? Math.round(
        ((product.priceFcfa - product.promoPriceFcfa!) / product.priceFcfa) *
          100,
      )
    : 0;
  const endsAtIso = promo
    ? typeof product.promoEndsAt === "string"
      ? product.promoEndsAt
      : product.promoEndsAt!.toISOString()
    : null;

  return (
    <Link
      href={`/produits/${product.id}`}
      className="group overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.03] transition-colors hover:border-emerald/40"
    >
      <div className="relative aspect-square overflow-hidden bg-white/5">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : null}
        {product.stock === 0 ? (
          <span className="absolute top-2 left-2">
            <Badge variant="neutral">Rupture</Badge>
          </span>
        ) : promo ? (
          <span className="absolute top-2 left-2 rounded-full bg-danger px-2.5 py-1 font-label text-[11px] font-bold text-navy-deep">
            −{promoPct} %
          </span>
        ) : null}
        {tag ? (
          <span className="absolute top-2 right-2 rounded-full bg-gold/90 px-2.5 py-1 font-label text-[11px] font-bold text-navy-deep">
            {tag}
          </span>
        ) : null}
      </div>
      <div className="p-3">
        <h3 className="truncate text-sm font-medium">{product.title}</h3>
        {promo ? (
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <p className="font-display font-bold text-gold">
              {formatFcfa(product.promoPriceFcfa!)}
            </p>
            <p className="text-xs text-ink-muted line-through">
              {formatFcfa(product.priceFcfa)}
            </p>
          </div>
        ) : (
          <p className="mt-1 font-display font-bold text-gold">
            {formatFcfa(product.priceFcfa)}
          </p>
        )}
        {endsAtIso ? <Countdown endsAt={endsAtIso} className="mt-0.5" /> : null}
        {product.shopName ? (
          <p className="mt-0.5 truncate text-xs text-ink-muted">
            {product.shopName}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
