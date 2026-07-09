import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ProductForm } from "../product-form";
import { getCategoryOptions } from "../queries";

export default async function NouveauProduitPage() {
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
          Nouveau produit
        </h1>
        <p className="mt-1 text-ink-muted">
          Le produit est créé en brouillon ; publiez-le quand il est prêt.
        </p>
      </div>
      <Card>
        <ProductForm categories={options} />
      </Card>
    </main>
  );
}
