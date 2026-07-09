"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addToCart } from "@/app/panier/actions";
import { Button } from "@/components/ui/button";
import { formatFcfa } from "@/lib/format";
import {
  isWholesaleApplied,
  unitPriceFcfa,
  type PricedProduct,
} from "@/lib/pricing";

export function AddToCart({
  productId,
  product,
  minOrderQty,
  stock,
}: {
  productId: string;
  product: PricedProduct;
  minOrderQty: number;
  stock: number;
}) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(minOrderQty);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const wholesale = isWholesaleApplied(product, quantity);

  async function handleAdd() {
    setError(null);
    setMessage(null);
    setLoading(true);
    const result = await addToCart(productId, quantity);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMessage("Ajouté au panier ✓");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-md border border-white/10">
          <button
            type="button"
            aria-label="Diminuer"
            onClick={() => setQuantity((q) => Math.max(minOrderQty, q - 1))}
            className="px-3 py-2 text-ink-muted hover:text-ink"
          >
            -
          </button>
          <span className="min-w-10 text-center font-display font-bold">
            {quantity}
          </span>
          <button
            type="button"
            aria-label="Augmenter"
            onClick={() => setQuantity((q) => Math.min(stock, q + 1))}
            className="px-3 py-2 text-ink-muted hover:text-ink"
          >
            +
          </button>
        </div>
        <Button size="lg" onClick={handleAdd} disabled={loading || stock === 0}>
          {loading ? "Ajout…" : "Ajouter au panier"}
        </Button>
      </div>
      <p className="text-sm text-ink-muted">
        {quantity} ×{" "}
        <span className={wholesale ? "font-semibold text-gold" : undefined}>
          {formatFcfa(unitPriceFcfa(product, quantity))}
        </span>{" "}
        = {formatFcfa(unitPriceFcfa(product, quantity) * quantity)}
        {wholesale ? (
          <span className="ml-2 text-gold">Prix de gros appliqué 🎉</span>
        ) : null}
      </p>
      {message ? <p className="text-sm text-emerald">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
