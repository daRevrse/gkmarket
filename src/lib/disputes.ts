// Libellés partagés du module Litiges (itération 7).

export const disputeReasonLabels: Record<string, string> = {
  damaged: "Colis endommagé",
  lost: "Colis perdu",
  not_received: "Commande jamais reçue",
  not_as_described: "Produit non conforme à l'annonce",
  late: "Retard de livraison important",
  other: "Autre problème",
};

export const disputeStatusLabels: Record<
  string,
  { label: string; variant?: "verified" | "wholesale" | "neutral" }
> = {
  open: { label: "Litige en cours", variant: "wholesale" },
  resolved: { label: "Litige résolu", variant: "verified" },
};

export const disputeResolutionLabels: Record<string, string> = {
  refund_total: "Remboursement intégral de l'acheteur",
  refund_partial: "Remboursement partiel de l'acheteur",
  release_seller: "Fonds versés au vendeur (litige rejeté)",
};
