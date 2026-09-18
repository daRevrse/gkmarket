"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { sendProductCard } from "@/app/compte/messages/actions";
import { Button } from "@/components/ui/button";
import { formatFcfa } from "@/lib/format";

/**
 * « Se renseigner sur ce produit » : fiche de l'article d'où vient
 * l'acheteur, prête à être envoyée dans le fil (façon Alibaba).
 */
export function ProductInquiryCard({
  conversationId,
  product,
}: {
  conversationId: string;
  product: {
    id: string;
    title: string;
    imageUrl: string | null;
    priceFcfa: number;
    minOrderQty: number;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setLoading(true);
    setError(null);
    const result = await sendProductCard(conversationId, product.id);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.replace(pathname, { scroll: false });
    router.refresh();
  }

  return (
    <div className="mb-3 rounded-lg border border-gold/30 bg-gold/[0.06] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-label text-xs text-ink-muted">
          Se renseigner sur ce produit :
        </p>
        <button
          type="button"
          onClick={() => router.replace(pathname, { scroll: false })}
          aria-label="Ne pas envoyer la fiche produit"
          className="text-ink-muted hover:text-ink"
        >
          <XMarkIcon className="size-4" />
        </button>
      </div>
      <div className="flex items-center gap-3">
        <div className="size-14 shrink-0 overflow-hidden rounded-md bg-white/5">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{product.title}</p>
          <p className="font-display text-sm font-bold text-gold">
            {formatFcfa(product.priceFcfa)}
          </p>
          {product.minOrderQty > 1 ? (
            <p className="text-[11px] text-ink-muted">
              Commande min. : {product.minOrderQty} unités
            </p>
          ) : null}
        </div>
        <Button size="sm" onClick={send} loading={loading}>
          Envoyer
        </Button>
      </div>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
