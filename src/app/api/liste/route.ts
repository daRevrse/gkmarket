import { getCurrentUser } from "@/lib/auth";
import { wishlistProductIds } from "@/lib/shopping-list";

/** Produits de « Ma liste » (cœurs des cartes produit) ; 401 pour un visiteur. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ids: [] }, { status: 401 });
  return Response.json(
    { ids: await wishlistProductIds(user.id) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
