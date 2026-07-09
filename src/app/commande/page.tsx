import { redirect } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { addresses } from "@/db/schema";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { formatFcfa } from "@/lib/format";
import { getOrCreateWallet } from "@/lib/wallet";
import { getCart } from "@/app/panier/queries";
import { CheckoutForm } from "./checkout-form";

export default async function CommandePage() {
  const user = await getCurrentUser();
  // Seul point du parcours où l'authentification est requise. On revient
  // ici après connexion (le panier invité est alors fusionné en base).
  if (!user) redirect("/connexion?next=/commande");

  const cart = await getCart(user.id);
  if (cart.groups.length === 0) redirect("/panier");

  const userAddresses = await db
    .select()
    .from(addresses)
    .where(eq(addresses.userId, user.id))
    .orderBy(desc(addresses.isDefault), asc(addresses.createdAt));

  const wallet = await getOrCreateWallet(user.id);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 md:px-10">
        <h1 className="font-display text-2xl font-extrabold">
          Finaliser ma commande
        </h1>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <CheckoutForm
            addresses={userAddresses.map((address) => ({
              id: address.id,
              label: address.label,
              recipientName: address.recipientName,
              recipientPhone: address.recipientPhone,
              city: address.city,
              district: address.district,
              isDefault: address.isDefault,
            }))}
            walletBalance={wallet.balanceFcfa}
            total={cart.total}
          />

          <div className="lg:sticky lg:top-6 lg:self-start">
            <Card>
              <h2 className="font-display text-lg font-bold">Récapitulatif</h2>
              <div className="mt-4 flex flex-col gap-4">
                {cart.groups.map((group) => (
                  <div key={group.sellerId} className="text-sm">
                    <p className="font-medium">{group.shopName}</p>
                    <ul className="mt-1 flex flex-col gap-1 text-ink-muted">
                      {group.lines.map((line) => (
                        <li key={line.itemId} className="flex justify-between gap-2">
                          <span className="truncate">
                            {line.quantity} × {line.title}
                          </span>
                          <span className="shrink-0">
                            {formatFcfa(line.lineTotal)}
                          </span>
                        </li>
                      ))}
                      <li className="flex justify-between gap-2">
                        <span>Livraison</span>
                        <span>{formatFcfa(group.deliveryFee)}</span>
                      </li>
                    </ul>
                  </div>
                ))}
                <div className="border-t border-white/10 pt-3 text-sm">
                  <p className="flex justify-between text-ink-muted">
                    <span>Sous-total</span>
                    <span>{formatFcfa(cart.subtotal)}</span>
                  </p>
                  <p className="flex justify-between text-ink-muted">
                    <span>Livraison</span>
                    <span>{formatFcfa(cart.deliveryTotal)}</span>
                  </p>
                  <p className="mt-2 flex justify-between font-display text-lg font-extrabold">
                    <span>Total</span>
                    <span className="text-gold">{formatFcfa(cart.total)}</span>
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
