"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import {
  ChatBubbleLeftRightIcon,
  BuildingStorefrontIcon,
} from "@heroicons/react/24/outline";
import { contactSeller } from "@/app/compte/messages/actions";
import { addToCart } from "@/app/panier/actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { WishlistButton } from "@/components/wishlist";
import { formatFcfa } from "@/lib/format";
import {
  isWholesaleApplied,
  unitPriceFcfa,
  type PricedProduct,
} from "@/lib/pricing";
import { cn } from "@/lib/utils";

function ChatSubmit({ className, compact }: { className?: string; compact?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "inline-flex w-full items-center justify-center gap-2 rounded-md border border-emerald font-label text-sm font-semibold tracking-wide text-emerald transition-colors hover:bg-emerald/10 disabled:opacity-60",
        compact ? "px-3 py-3" : "px-5 py-3",
        className,
      )}
    >
      {pending ? (
        <Spinner className="size-4" />
      ) : (
        <ChatBubbleLeftRightIcon className="size-5" />
      )}
      {compact ? "Discuter" : "Discuter avec le vendeur"}
    </button>
  );
}

/**
 * Actions de la fiche produit (docs/CHANGEMENTS.md §5, lot 2) : quantité,
 * Acheter maintenant (achat direct de cet article seul), Ajouter au panier,
 * Discuter avec le vendeur (fil avec la fiche produit), Ma liste. Sur mobile,
 * une barre fixe reprend Boutique / Ma liste / Discuter / Acheter.
 */
export function ProductBuyActions({
  productId,
  productPath,
  sellerId,
  product,
  minOrderQty,
  stock,
  initialInList,
}: {
  productId: string;
  productPath: string;
  sellerId: string;
  product: PricedProduct;
  minOrderQty: number;
  stock: number;
  initialInList: boolean;
}) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(Math.min(minOrderQty, stock) || 1);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [buying, setBuying] = useState(false);

  const inStock = stock > 0 && stock >= minOrderQty;
  const wholesale = isWholesaleApplied(product, quantity);
  const unitPrice = unitPriceFcfa(product, quantity);
  const chatAction = contactSeller.bind(null, sellerId, productPath, {
    productId,
  });

  // La barre mobile occupe le bas de l'écran : on remonte le bouton
  // « retour en haut » d'autant (variable lue par GoToTop).
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--mobile-action-bar", "4.5rem");
    return () => {
      root.style.removeProperty("--mobile-action-bar");
    };
  }, []);

  async function handleAdd() {
    setError(null);
    setMessage(null);
    setAdding(true);
    const result = await addToCart(productId, quantity);
    setAdding(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMessage("Ajouté au panier");
    router.refresh();
  }

  function handleBuy() {
    setBuying(true);
    router.push(`/commande?produit=${productId}&qte=${quantity}`);
  }

  return (
    <div className="flex flex-col gap-4">
      {inStock ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-md border border-white/10">
              <button
                type="button"
                aria-label="Diminuer la quantité"
                onClick={() => setQuantity((q) => Math.max(minOrderQty, q - 1))}
                className="px-3 py-2 text-ink-muted hover:text-ink"
              >
                -
              </button>
              <input
                type="number"
                inputMode="numeric"
                aria-label="Quantité"
                min={minOrderQty}
                max={stock}
                value={quantity}
                onChange={(e) => {
                  const value = Math.round(Number(e.target.value));
                  if (Number.isFinite(value)) setQuantity(value);
                }}
                onBlur={() =>
                  setQuantity((q) => Math.max(minOrderQty, Math.min(stock, q || minOrderQty)))
                }
                className="w-16 bg-transparent text-center font-display font-bold [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                type="button"
                aria-label="Augmenter la quantité"
                onClick={() => setQuantity((q) => Math.min(stock, q + 1))}
                className="px-3 py-2 text-ink-muted hover:text-ink"
              >
                +
              </button>
            </div>
            <p className="text-sm text-ink-muted">
              {quantity} ×{" "}
              <span className={wholesale ? "font-semibold text-gold" : undefined}>
                {formatFcfa(unitPrice)}
              </span>{" "}
              = {formatFcfa(unitPrice * quantity)}
            </p>
          </div>
          {wholesale ? (
            <p className="text-sm text-gold">Prix de gros appliqué</p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-ink-muted">
          Produit momentanément indisponible : ajoutez-le à votre liste ou
          interrogez le vendeur sur le réassort.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {inStock ? (
          <>
            <Button size="lg" onClick={handleBuy} loading={buying}>
              Acheter maintenant
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={handleAdd}
              loading={adding}
            >
              Ajouter au panier
            </Button>
          </>
        ) : null}
        <form action={chatAction}>
          <ChatSubmit />
        </form>
        <WishlistButton
          productId={productId}
          initialInList={initialInList}
          variant="button"
        />
      </div>

      {message ? (
        <p className="text-sm text-emerald">
          {message} ·{" "}
          <Link href="/panier" className="underline">
            Voir le panier
          </Link>
        </p>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {/* Barre d'actions fixe sur mobile */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-navy-deep/95 px-3 py-2.5 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <Link
            href={`/boutique/${sellerId}`}
            aria-label="Voir la boutique"
            className="flex w-12 shrink-0 flex-col items-center gap-0.5 text-ink-muted hover:text-ink"
          >
            <BuildingStorefrontIcon className="size-5" />
            <span className="font-label text-[10px]">Boutique</span>
          </Link>
          <WishlistButton productId={productId} initialInList={initialInList} />
          <form action={chatAction} className="flex-1">
            <ChatSubmit compact />
          </form>
          {inStock ? (
            <Button onClick={handleBuy} loading={buying} className="flex-1 px-3">
              Acheter
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
