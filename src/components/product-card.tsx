import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatFcfa } from "@/lib/format";

export type CatalogProduct = {
  id: string;
  title: string;
  priceFcfa: number;
  wholesalePriceFcfa: number | null;
  stock: number;
  imageUrl: string | null;
  shopName: string | null;
};

export function ProductCard({ product }: { product: CatalogProduct }) {
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
        ) : null}
      </div>
      <div className="p-3">
        <h3 className="truncate text-sm font-medium">{product.title}</h3>
        <p className="mt-1 font-display font-bold text-gold">
          {formatFcfa(product.priceFcfa)}
        </p>
        {product.shopName ? (
          <p className="mt-0.5 truncate text-xs text-ink-muted">
            {product.shopName}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
