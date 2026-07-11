"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { productReports, products } from "@/db/schema";
import { logAdmin } from "@/lib/admin-log";
import { getCurrentUser } from "@/lib/auth";
import { and } from "drizzle-orm";

/**
 * Modération produit (MVP n°245-248) : un produit non conforme est archivé
 * (retiré du catalogue). Le vendeur peut le corriger et le republier -
 * une boutique récidiviste se suspend depuis /admin/vendeurs.
 */
export async function moderateProduct(
  productId: string,
  action: "archive" | "restore",
): Promise<{ error?: string }> {
  const admin = await getCurrentUser();
  if (!admin?.isAdmin) return { error: "Réservé aux administrateurs." };

  const updated = await db
    .update(products)
    .set({
      status: action === "archive" ? "archived" : "published",
      updatedAt: new Date(),
    })
    .where(eq(products.id, productId))
    .returning({ id: products.id, title: products.title });
  if (updated.length === 0) return { error: "Produit introuvable." };

  await logAdmin(
    admin.id,
    action === "archive" ? "Produit retiré du catalogue" : "Produit rétabli",
    { targetType: "produit", targetId: productId, details: updated[0].title },
  );

  revalidatePath("/admin/produits");
  revalidatePath("/produits");
  revalidatePath(`/produits/${productId}`);
  revalidatePath("/");
  return {};
}

/**
 * Traitement d'un signalement (MVP n°275) : « archive » retire le produit du
 * catalogue et clôt tous les signalements ouverts de ce produit ; « dismiss »
 * classe le signalement sans suite.
 */
export async function handleProductReport(
  reportId: string,
  outcome: "archive" | "dismiss",
): Promise<{ error?: string }> {
  const admin = await getCurrentUser();
  if (!admin?.isAdmin) return { error: "Réservé aux administrateurs." };

  const [row] = await db
    .select({ report: productReports, title: products.title })
    .from(productReports)
    .innerJoin(products, eq(products.id, productReports.productId))
    .where(and(eq(productReports.id, reportId), eq(productReports.status, "open")))
    .limit(1);
  if (!row) return { error: "Signalement introuvable ou déjà traité." };

  if (outcome === "archive") {
    await db
      .update(products)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(products.id, row.report.productId));
    // Tous les signalements ouverts de ce produit sont réglés d'un coup.
    await db
      .update(productReports)
      .set({ status: "resolved", resolvedById: admin.id, resolvedAt: new Date() })
      .where(
        and(
          eq(productReports.productId, row.report.productId),
          eq(productReports.status, "open"),
        ),
      );
  } else {
    await db
      .update(productReports)
      .set({ status: "dismissed", resolvedById: admin.id, resolvedAt: new Date() })
      .where(eq(productReports.id, reportId));
  }

  await logAdmin(
    admin.id,
    outcome === "archive"
      ? "Signalement traité : produit retiré"
      : "Signalement classé sans suite",
    { targetType: "produit", targetId: row.report.productId, details: row.title },
  );

  revalidatePath("/admin/produits");
  revalidatePath("/produits");
  revalidatePath("/");
  return {};
}
