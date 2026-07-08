export const orderStatusLabels: Record<
  string,
  { label: string; variant?: "verified" | "wholesale" | "neutral" }
> = {
  pending_payment: { label: "En attente de paiement", variant: "neutral" },
  paid: { label: "Payée — fonds sécurisés", variant: "wholesale" },
  processing: { label: "En préparation" },
  shipped: { label: "Expédiée" },
  delivered: { label: "Livrée", variant: "verified" },
  cancelled: { label: "Annulée", variant: "neutral" },
  disputed: { label: "En litige — fonds bloqués", variant: "wholesale" },
  refunded: { label: "Remboursée", variant: "neutral" },
};
