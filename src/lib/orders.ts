export const orderStatusLabels: Record<
  string,
  { label: string; variant?: "verified" | "wholesale" | "neutral" }
> = {
  pending_payment: { label: "En attente de paiement", variant: "neutral" },
  paid: { label: "Payée - fonds sécurisés", variant: "wholesale" },
  processing: { label: "En préparation" },
  shipped: { label: "Expédiée" },
  delivered: { label: "Livrée", variant: "verified" },
  cancelled: { label: "Annulée", variant: "neutral" },
  disputed: { label: "En litige - fonds bloqués", variant: "wholesale" },
  refunded: { label: "Remboursée", variant: "neutral" },
};

/** Frais au pourcentage, arrondis au franc (frais de service, Mobile Money). */
export function feeFromPct(amountFcfa: number, pct: number): number {
  return Math.round((amountFcfa * pct) / 100);
}

/**
 * Montant remboursable d'une commande payée : tout sauf les frais de
 * service, non remboursables (docs/CHANGEMENTS.md §5).
 */
export function refundableFcfa(order: {
  totalFcfa: number;
  serviceFeeFcfa: number;
}): number {
  return order.totalFcfa - order.serviceFeeFcfa;
}

/** Origine d'un passage en caisse : panier (défaut), achat direct ou bon de commande. */
export type CheckoutSource =
  | { kind: "direct"; productId: string; quantity: number }
  | { kind: "purchase_order"; purchaseOrderId: string };
