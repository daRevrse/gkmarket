"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addToCart } from "@/app/panier/actions";
import { Button } from "@/components/ui/button";
import { addWishlistToCart, toggleWishlist } from "./actions";

/** Actions d'un article de « Ma liste » : panier (quantité minimum) et retrait. */
export function ListItemActions({
  productId,
  minOrderQty,
  available,
}: {
  productId: string;
  minOrderQty: number;
  available: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"cart" | "remove" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function add() {
    setBusy("cart");
    const result = await addToCart(productId, minOrderQty);
    setBusy(null);
    setMessage(result.error ?? "Ajouté au panier");
    router.refresh();
  }

  async function remove() {
    setBusy("remove");
    await toggleWishlist(productId);
    router.refresh();
  }

  return (
    <div className="mt-auto flex flex-col gap-1.5 pt-3">
      {available ? (
        <Button size="sm" onClick={add} loading={busy === "cart"}>
          Ajouter au panier
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="ghost"
        onClick={remove}
        loading={busy === "remove"}
      >
        Retirer
      </Button>
      {message ? (
        <p className="text-center text-xs text-emerald">
          {message === "Ajouté au panier" ? (
            <Link href="/panier" className="underline">
              {message}
            </Link>
          ) : (
            message
          )}
        </p>
      ) : null}
    </div>
  );
}

/** « Tout ajouter au panier » (produits disponibles, quantité minimum). */
export function AddAllToCart() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    const result = await addWishlistToCart();
    setLoading(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMessage(
      `${result.added} article${(result.added ?? 0) > 1 ? "s" : ""} ajouté${(result.added ?? 0) > 1 ? "s" : ""} au panier` +
        (result.skipped ? ` (${result.skipped} indisponible${result.skipped > 1 ? "s" : ""})` : ""),
    );
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="secondary" size="sm" onClick={run} loading={loading}>
        Tout ajouter au panier
      </Button>
      {message ? (
        <p className="text-xs text-emerald">
          {message} ·{" "}
          <Link href="/panier" className="underline">
            Voir le panier
          </Link>
        </p>
      ) : null}
    </div>
  );
}
