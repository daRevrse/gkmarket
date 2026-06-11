import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { formatFcfa } from "@/lib/format";
import { ClearCartButton, QuantityStepper, RemoveItemButton } from "./cart-controls";
import { getCart } from "./queries";

export default async function PanierPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  const cart = await getCart(user.id);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 md:px-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-2xl font-extrabold">
            Mon panier{" "}
            {cart.itemCount > 0 ? (
              <span className="text-ink-muted">
                ({cart.itemCount} article{cart.itemCount > 1 ? "s" : ""})
              </span>
            ) : null}
          </h1>
          {cart.groups.length > 0 ? <ClearCartButton /> : null}
        </div>

        {cart.groups.length === 0 ? (
          <Card className="mt-6 text-center">
            <p className="text-ink-muted">Votre panier est vide.</p>
            <LinkButton href="/produits" className="mt-4">
              Explorer le catalogue
            </LinkButton>
          </Card>
        ) : (
          <div className="mt-6 flex flex-col gap-6">
            {cart.groups.map((group) => (
              <Card key={group.sellerId} className="p-0">
                <div className="border-b border-white/[0.06] px-5 py-3">
                  <span className="text-sm text-ink-muted">Vendu par</span>{" "}
                  <span className="font-display font-bold">{group.shopName}</span>
                </div>
                <div className="flex flex-col divide-y divide-white/[0.04]">
                  {group.lines.map((line) => (
                    <div key={line.itemId} className="flex items-center gap-4 px-5 py-4">
                      {line.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={line.imageUrl}
                          alt={line.title}
                          className="h-16 w-16 shrink-0 rounded-md object-cover"
                        />
                      ) : (
                        <div className="h-16 w-16 shrink-0 rounded-md bg-white/5" />
                      )}
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/produits/${line.productId}`}
                          className="block truncate text-sm font-medium hover:text-emerald"
                        >
                          {line.title}
                        </Link>
                        <p className="mt-0.5 text-sm text-ink-muted">
                          {formatFcfa(line.unitPrice)} / unité
                          {line.wholesaleApplied ? (
                            <Badge variant="wholesale" className="ml-2">
                              Prix de gros
                            </Badge>
                          ) : null}
                        </p>
                      </div>
                      <QuantityStepper
                        itemId={line.itemId}
                        quantity={line.quantity}
                        minOrderQty={line.minOrderQty}
                        stock={line.stock}
                      />
                      <span className="min-w-24 text-right font-display font-bold text-gold">
                        {formatFcfa(line.lineTotal)}
                      </span>
                      <RemoveItemButton itemId={line.itemId} />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-6 border-t border-white/[0.06] px-5 py-3 text-sm">
                  <span className="text-ink-muted">
                    Sous-total : <span className="text-ink">{formatFcfa(group.subtotal)}</span>
                  </span>
                  <span className="text-ink-muted">
                    Livraison estimée :{" "}
                    <span className="text-ink">{formatFcfa(group.deliveryFee)}</span>
                  </span>
                </div>
              </Card>
            ))}

            <Card className="flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm text-ink-muted">
                <p>
                  Sous-total :{" "}
                  <span className="text-ink">{formatFcfa(cart.subtotal)}</span>
                </p>
                <p>
                  Livraison estimée ({cart.groups.length} vendeur
                  {cart.groups.length > 1 ? "s" : ""}) :{" "}
                  <span className="text-ink">{formatFcfa(cart.deliveryTotal)}</span>
                </p>
                <p className="mt-1 font-display text-lg font-extrabold text-ink">
                  Total : <span className="text-gold">{formatFcfa(cart.total)}</span>
                </p>
              </div>
              <LinkButton href="/commande" size="lg">
                Passer la commande
              </LinkButton>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
