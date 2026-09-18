import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { addresses } from "@/db/schema";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { formatFcfa, formatPct } from "@/lib/format";
import type { CheckoutSource } from "@/lib/orders";
import { getOrCreateWallet } from "@/lib/wallet";
import {
  getCart,
  getDirectPurchase,
  getPurchaseOrderCheckout,
  type CartSummary,
} from "@/app/panier/queries";
import { CheckoutForm } from "./checkout-form";

export default async function CommandePage({
  searchParams,
}: {
  searchParams: Promise<{ produit?: string; qte?: string; bon?: string }>;
}) {
  const { produit, qte, bon } = await searchParams;
  // Trois origines : panier (défaut), « Acheter maintenant » (un article,
  // panier inchangé) ou bon de commande accepté depuis le chat.
  const selfPath = bon
    ? `/commande?bon=${encodeURIComponent(bon)}`
    : produit
      ? `/commande?produit=${encodeURIComponent(produit)}&qte=${Number(qte) || 1}`
      : "/commande";

  const user = await getCurrentUser();
  // Seul point du parcours où l'authentification est requise. On revient
  // ici après connexion (le panier invité est alors fusionné en base).
  if (!user) redirect(`/connexion?next=${encodeURIComponent(selfPath)}`);

  let cart: CartSummary;
  let source: CheckoutSource | undefined;
  let heading = "Finaliser ma commande";
  let subheading: string | null = null;

  if (bon) {
    const checkout = await getPurchaseOrderCheckout(bon, user.id);
    if ("error" in checkout) {
      return (
        <div className="flex min-h-screen flex-col">
          <SiteHeader />
          <main className="mx-auto w-full max-w-xl flex-1 px-4 py-16 md:px-10">
            <Card className="text-center">
              <p className="text-ink-muted">{checkout.error}</p>
              <Link
                href="/compte/messages"
                className="mt-3 inline-block font-label text-sm text-emerald hover:underline"
              >
                Retour à mes messages ›
              </Link>
            </Card>
          </main>
        </div>
      );
    }
    cart = checkout.summary;
    source = { kind: "purchase_order", purchaseOrderId: bon };
    heading = `Bon de commande ${checkout.number}`;
    const until = checkout.expiresAt.toLocaleString("fr-FR", {
      timeZone: "Africa/Lome",
      day: "2-digit",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
    subheading = `Prix négociés avec ${checkout.shopName}, valables jusqu'au ${until}.${checkout.note ? ` Note du vendeur : ${checkout.note}` : ""}`;
  } else if (produit) {
    const direct = await getDirectPurchase(produit, Number(qte) || 1);
    if (!direct) redirect("/produits");
    cart = direct.summary;
    source = { kind: "direct", productId: produit, quantity: direct.quantity };
    heading = "Achat direct";
    subheading = "Seul cet article est commandé : votre panier reste inchangé.";
  } else {
    cart = await getCart(user.id);
    if (cart.groups.length === 0) redirect("/panier");
  }

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
        <h1 className="font-display text-2xl font-extrabold">{heading}</h1>
        {subheading ? (
          <p className="mt-1 text-sm text-ink-muted">{subheading}</p>
        ) : null}

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
            source={source}
            returnPath={selfPath}
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
                  {cart.serviceFeeTotal > 0 ? (
                    <p className="flex justify-between text-ink-muted">
                      <span>Frais de service ({formatPct(cart.serviceFeePct)})</span>
                      <span>{formatFcfa(cart.serviceFeeTotal)}</span>
                    </p>
                  ) : null}
                  <p className="mt-2 flex justify-between font-display text-lg font-extrabold">
                    <span>Total</span>
                    <span className="text-gold">{formatFcfa(cart.total)}</span>
                  </p>
                  {cart.serviceFeeTotal > 0 ? (
                    <p className="mt-2 text-xs text-ink-muted">
                      Les frais de service financent le paiement sécurisé et
                      la protection acheteur ; ils ne sont pas remboursables.
                    </p>
                  ) : null}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
