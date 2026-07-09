// Libellés partagés du module Livraison (itération 6).

export const deliveryStatusLabels: Record<
  string,
  { label: string; variant?: "verified" | "wholesale" | "neutral" }
> = {
  proposed: { label: "Course proposée", variant: "neutral" },
  accepted: { label: "Course acceptée", variant: "wholesale" },
  refused: { label: "Course refusée", variant: "neutral" },
  picked_up: { label: "Colis récupéré - en route" },
  delivered: { label: "Colis remis", variant: "verified" },
  cancelled: { label: "Course annulée", variant: "neutral" },
};

export const vehicleTypeLabels: Record<string, string> = {
  moto: "Moto",
  tricycle: "Tricycle",
  voiture: "Voiture",
  camionnette: "Camionnette",
};
