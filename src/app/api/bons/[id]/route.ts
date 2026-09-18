import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  orders,
  purchaseOrderItems,
  purchaseOrders,
  sellerProfiles,
  users,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { generatePurchaseOrderPdf } from "@/lib/invoice";
import { feeFromPct } from "@/lib/orders";
import { purchaseOrderState } from "@/lib/purchase-orders";
import { getPlatformSettings } from "@/lib/settings";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATE_LABELS = {
  sent: "en attente d'acceptation",
  accepted: "accepté",
  declined: "refusé",
  cancelled: "annulé",
  expired: "expiré",
} as const;

/**
 * Bon de commande PDF (proforma) - réservé à l'acheteur, au vendeur et aux
 * admins. Frais de service au taux actuel tant que le bon n'est pas accepté,
 * ceux de la commande ensuite.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 403 });
  const { id } = await params;
  if (!UUID_RE.test(id)) return new NextResponse(null, { status: 404 });

  const [row] = await db
    .select({
      po: purchaseOrders,
      shopName: sellerProfiles.shopName,
      shopCity: sellerProfiles.city,
      sellerUserId: sellerProfiles.userId,
      buyerName: users.fullName,
      orderServiceFee: orders.serviceFeeFcfa,
    })
    .from(purchaseOrders)
    .innerJoin(sellerProfiles, eq(sellerProfiles.id, purchaseOrders.sellerId))
    .innerJoin(users, eq(users.id, purchaseOrders.buyerId))
    .leftJoin(orders, eq(orders.id, purchaseOrders.orderId))
    .where(eq(purchaseOrders.id, id))
    .limit(1);
  if (!row) return new NextResponse(null, { status: 404 });

  const allowed =
    user.isAdmin || row.po.buyerId === user.id || row.sellerUserId === user.id;
  if (!allowed) return new NextResponse(null, { status: 403 });

  const [items, { serviceFeePct }] = await Promise.all([
    db
      .select()
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.purchaseOrderId, id))
      .orderBy(asc(purchaseOrderItems.position)),
    getPlatformSettings(),
  ]);

  const pdf = await generatePurchaseOrderPdf({
    purchaseOrder: row.po,
    items,
    shopName: row.shopName,
    shopCity: row.shopCity,
    buyerName: row.buyerName ?? "Acheteur",
    // Bon accepté : frais réellement facturés sur la commande.
    serviceFeeFcfa:
      row.orderServiceFee ?? feeFromPct(row.po.subtotalFcfa, serviceFeePct),
    stateLabel: STATE_LABELS[purchaseOrderState(row.po)],
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="bon-de-commande-${row.po.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
