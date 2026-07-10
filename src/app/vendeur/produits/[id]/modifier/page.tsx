import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { productImages, products } from "@/db/schema";
import { Card } from "@/components/ui/card";
import { requireApprovedSeller } from "@/lib/auth";
import { ProductForm } from "../../product-form";
import { getCategoryOptions } from "../../queries";

export default async function ModifierProduitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireApprovedSeller();

  const [product] = await db
    .select()
    .from(products)
    .where(
      and(eq(products.id, id), eq(products.sellerId, user.sellerProfile.id)),
    )
    .limit(1);
  if (!product) notFound();

  const images = await db
    .select({ path: productImages.path, url: productImages.url })
    .from(productImages)
    .where(eq(productImages.productId, id))
    .orderBy(asc(productImages.position));

  const options = await getCategoryOptions();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 md:px-10">
      <div className="mb-8">
        <Link
          href="/vendeur/produits"
          className="text-sm text-ink-muted hover:text-emerald"
        >
          ‹ Mes produits
        </Link>
        <h1 className="mt-2 font-display text-3xl font-extrabold">
          Modifier le produit
        </h1>
      </div>
      <Card>
        <ProductForm
          categories={options}
          initial={{
            id: product.id,
            title: product.title,
            description: product.description,
            categoryId: product.categoryId,
            originCountry: product.originCountry,
            priceFcfa: product.priceFcfa,
            wholesalePriceFcfa: product.wholesalePriceFcfa,
            wholesaleMinQty: product.wholesaleMinQty,
            promoPriceFcfa: product.promoPriceFcfa,
            promoEndsAt: product.promoEndsAt
              ? product.promoEndsAt.toISOString().slice(0, 10)
              : null,
            stock: product.stock,
            minOrderQty: product.minOrderQty,
            weightGrams: product.weightGrams,
            prepDelayDays: product.prepDelayDays,
            images,
          }}
        />
      </Card>
    </main>
  );
}
