import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, sellerProfiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { generateInvoicePdf } from "@/lib/invoice";

/**
 * Téléchargement de la facture PDF (MVP n°122, 124, 154) — réservé à
 * l'acheteur, au vendeur de la commande et aux admins. Disponible dès que
 * la commande est payée.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 403 });

  const { orderId } = await params;
  const [row] = await db
    .select({
      order: orders,
      shopName: sellerProfiles.shopName,
      shopCity: sellerProfiles.city,
      sellerUserId: sellerProfiles.userId,
    })
    .from(orders)
    .innerJoin(sellerProfiles, eq(sellerProfiles.id, orders.sellerId))
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!row) return new NextResponse(null, { status: 404 });

  const allowed =
    user.isAdmin || row.order.buyerId === user.id || row.sellerUserId === user.id;
  if (!allowed) return new NextResponse(null, { status: 403 });
  if (!row.order.paidAt) {
    return new NextResponse(
      "Facture disponible après paiement de la commande.",
      { status: 409 },
    );
  }

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .orderBy(asc(orderItems.title));

  const pdf = await generateInvoicePdf({
    order: row.order,
    items,
    shopName: row.shopName,
    shopCity: row.shopCity,
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="facture-${row.order.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
