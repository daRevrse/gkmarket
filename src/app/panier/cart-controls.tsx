"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clearCart, removeCartItem, updateCartQuantity } from "./actions";
import { Button } from "@/components/ui/button";

export function QuantityStepper({
  itemId,
  quantity,
  minOrderQty,
  stock,
}: {
  itemId: string;
  quantity: number;
  minOrderQty: number;
  stock: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function change(next: number) {
    setLoading(true);
    await updateCartQuantity(itemId, next);
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="flex items-center rounded-md border border-white/10">
      <button
        type="button"
        aria-label="Diminuer"
        disabled={loading || quantity <= minOrderQty}
        onClick={() => change(quantity - 1)}
        className="px-3 py-1.5 text-ink-muted hover:text-ink disabled:opacity-40"
      >
        -
      </button>
      <span className="min-w-9 text-center text-sm font-bold">{quantity}</span>
      <button
        type="button"
        aria-label="Augmenter"
        disabled={loading || quantity >= stock}
        onClick={() => change(quantity + 1)}
        className="px-3 py-1.5 text-ink-muted hover:text-ink disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}

export function RemoveItemButton({ itemId }: { itemId: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await removeCartItem(itemId);
        router.refresh();
      }}
      className="text-sm text-danger/80 hover:text-danger"
    >
      Supprimer
    </button>
  );
}

export function ClearCartButton() {
  const [confirm, setConfirm] = useState(false);

  if (!confirm) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}>
        Vider le panier
      </Button>
    );
  }
  return (
    <div className="flex gap-2">
      <Button
        variant="danger"
        size="sm"
        onClick={async () => {
          await clearCart();
          setConfirm(false);
        }}
      >
        Confirmer
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
        Annuler
      </Button>
    </div>
  );
}
