import Link from "next/link";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { productImages, products } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { formatFcfa } from "@/lib/format";
import { ProductActions } from "./product-actions";

const statusLabel: Record<string, { label: string; variant?: "verified" | "neutral" }> = {
  draft: { label: "Brouillon", variant: "neutral" },
  published: { label: "En ligne", variant: "verified" },
  archived: { label: "Archivé", variant: "neutral" },
};

export default async function VendeurProduitsPage() {
  const user = await getCurrentUser();
  const rows = await db
    .select()
    .from(products)
    .leftJoin(
      productImages,
      and(
        eq(productImages.productId, products.id),
        eq(productImages.position, 0),
      ),
    )
    .where(eq(products.sellerId, user!.sellerProfile!.id))
    .orderBy(desc(products.createdAt), asc(productImages.position));

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 md:px-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/compte"
            className="text-sm text-ink-muted hover:text-emerald"
          >
            ← Mon compte
          </Link>
          <h1 className="mt-2 font-display text-3xl font-extrabold">
            Mes produits
          </h1>
          <p className="mt-1 text-ink-muted">
            {user!.sellerProfile!.shopName} — {rows.length} produit
            {rows.length > 1 ? "s" : ""}
          </p>
        </div>
        <LinkButton href="/vendeur/produits/nouveau">
          + Nouveau produit
        </LinkButton>
      </div>

      <div className="flex flex-col gap-4">
        {rows.length === 0 ? (
          <Card className="text-center">
            <p className="text-ink-muted">
              Vous n&apos;avez pas encore de produit. Créez le premier !
            </p>
          </Card>
        ) : (
          rows.map(({ products: product, product_images: image }) => {
            const badge = statusLabel[product.status];
            return (
              <Card key={product.id} className="flex items-center gap-4 p-4">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={image.url}
                    alt={product.title}
                    className="h-20 w-20 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div className="h-20 w-20 shrink-0 rounded-md bg-white/5" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate font-display font-bold">
                      {product.title}
                    </h2>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                    {product.stock === 0 ? (
                      <Badge variant="neutral">Rupture</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">
                    {formatFcfa(product.priceFcfa)} · stock {product.stock}
                    {product.wholesalePriceFcfa
                      ? ` · gros : ${formatFcfa(product.wholesalePriceFcfa)} dès ${product.wholesaleMinQty}`
                      : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Link
                    href={`/vendeur/produits/${product.id}/modifier`}
                    className="text-sm text-emerald hover:underline"
                  >
                    Modifier
                  </Link>
                  <ProductActions
                    productId={product.id}
                    status={product.status}
                  />
                </div>
              </Card>
            );
          })
        )}
      </div>
    </main>
  );
}
