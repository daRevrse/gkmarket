import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { courierProfiles, deliveries, orders, sellerProfiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { adminStorage } from "@/lib/firebase/admin";

/**
 * Consultation des preuves de livraison. Les fichiers ne sont jamais
 * accessibles directement depuis Storage (règles read: false) : cette route
 * vérifie que le demandeur est partie prenante de la course - acheteur,
 * vendeur, livreur - ou admin.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse(null, { status: 403 });
  }

  const path = new URL(request.url).searchParams.get("path");
  if (!path || !path.startsWith("proofs/")) {
    return new NextResponse(null, { status: 400 });
  }

  if (!user.isAdmin) {
    const [row] = await db
      .select({
        buyerId: orders.buyerId,
        sellerUserId: sellerProfiles.userId,
        courierUserId: courierProfiles.userId,
      })
      .from(deliveries)
      .innerJoin(orders, eq(orders.id, deliveries.orderId))
      .innerJoin(sellerProfiles, eq(sellerProfiles.id, deliveries.sellerId))
      .innerJoin(courierProfiles, eq(courierProfiles.id, deliveries.courierId))
      .where(eq(deliveries.proofPhotoPath, path))
      .limit(1);

    const allowed =
      row &&
      [row.buyerId, row.sellerUserId, row.courierUserId].includes(user.id);
    if (!allowed) {
      return new NextResponse(null, { status: 403 });
    }
  }

  try {
    const file = adminStorage.bucket().file(path);
    const [metadata] = await file.getMetadata();
    const [contents] = await file.download();

    return new NextResponse(new Uint8Array(contents), {
      headers: {
        "Content-Type": metadata.contentType ?? "application/octet-stream",
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
