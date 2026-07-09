import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { disputeEvidence, disputes, sellerProfiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { adminStorage } from "@/lib/firebase/admin";

/**
 * Consultation des preuves de litige. Les fichiers ne sont jamais
 * accessibles directement depuis Storage (règles read: false) : cette route
 * vérifie que le demandeur est partie prenante - acheteur, vendeur - ou admin.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse(null, { status: 403 });
  }

  const path = new URL(request.url).searchParams.get("path");
  if (!path || !path.startsWith("disputes/")) {
    return new NextResponse(null, { status: 400 });
  }

  if (!user.isAdmin) {
    const [row] = await db
      .select({
        buyerId: disputes.buyerId,
        sellerUserId: sellerProfiles.userId,
      })
      .from(disputeEvidence)
      .innerJoin(disputes, eq(disputes.id, disputeEvidence.disputeId))
      .innerJoin(sellerProfiles, eq(sellerProfiles.id, disputes.sellerId))
      .where(eq(disputeEvidence.path, path))
      .limit(1);

    const allowed = row && [row.buyerId, row.sellerUserId].includes(user.id);
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
