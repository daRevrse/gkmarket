"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { productReports, products } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { productReportReasonLabels } from "@/lib/product-reports";

/**
 * Signalement d'un produit par un utilisateur connecté (MVP n°275) :
 * un seul signalement ouvert par utilisateur et par produit, examiné
 * depuis /admin/produits.
 */
export async function reportProduct(
  productId: string,
  reason: string,
  details: string,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Connectez-vous pour signaler un produit." };
  if (!(reason in productReportReasonLabels)) {
    return { error: "Choisissez un motif." };
  }

  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!product) return { error: "Produit introuvable." };

  const [existing] = await db
    .select({ id: productReports.id })
    .from(productReports)
    .where(
      and(
        eq(productReports.productId, productId),
        eq(productReports.reporterId, user.id),
        eq(productReports.status, "open"),
      ),
    )
    .limit(1);
  if (existing) {
    return {
      error: "Vous avez déjà signalé ce produit - notre équipe l'examine.",
    };
  }

  await db.insert(productReports).values({
    productId,
    reporterId: user.id,
    reason,
    details: details.trim() || null,
  });

  return {};
}
