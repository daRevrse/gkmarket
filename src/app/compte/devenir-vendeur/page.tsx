import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { SellerForm } from "./seller-form";

export default async function DevenirVendeurPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  const profile = user.sellerProfile;

  return (
    <main className="w-full max-w-3xl flex-1">
      <div className="mb-8">
        <Link
          href="/compte"
          className="text-sm text-ink-muted hover:text-emerald"
        >
          ‹ Mon compte
        </Link>
        <h1 className="mt-2 font-display text-3xl font-extrabold">
          Devenir vendeur
        </h1>
        <p className="mt-1 text-ink-muted">
          Vendez vos produits sur Deal Lomé après vérification de votre
          identité.
        </p>
      </div>

      {profile?.status === "pending" ? (
        <Card>
          <div className="flex items-center gap-3">
            <h2 className="font-display text-xl font-bold">
              {profile.shopName}
            </h2>
            <Badge>En attente de validation</Badge>
          </div>
          <p className="mt-3 text-sm text-ink-muted">
            Votre demande a bien été reçue. Notre équipe vérifie vos documents
            - vous serez notifié dès qu&apos;elle est traitée.
          </p>
        </Card>
      ) : profile?.status === "approved" ? (
        <Card>
          <div className="flex items-center gap-3">
            <h2 className="font-display text-xl font-bold">
              {profile.shopName}
            </h2>
            <Badge variant="verified">Vendeur vérifié</Badge>
          </div>
          <p className="mt-3 text-sm text-ink-muted">
            Félicitations, votre boutique est active ! Ajoutez vos produits,
            gérez vos commandes et complétez vos coordonnées de versement pour
            recevoir vos gains.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/vendeur/produits"
              className="rounded-md bg-gold px-4 py-2 font-label text-sm font-bold text-navy-deep hover:bg-gold-light"
            >
              Gérer mes produits
            </Link>
            <Link
              href={`/boutique/${profile.id}`}
              className="rounded-md border border-emerald px-4 py-2 font-label text-sm text-emerald hover:bg-emerald/10"
            >
              Voir ma boutique
            </Link>
            <Link
              href="/compte/profil"
              className="rounded-md border border-white/15 px-4 py-2 font-label text-sm text-ink-muted hover:text-ink"
            >
              Coordonnées de versement
            </Link>
          </div>
        </Card>
      ) : profile?.status === "suspended" ? (
        <Card>
          <div className="flex items-center gap-3">
            <h2 className="font-display text-xl font-bold">
              {profile.shopName}
            </h2>
            <Badge variant="neutral">Suspendu</Badge>
          </div>
          <p className="mt-3 text-sm text-ink-muted">
            Votre boutique est suspendue. Contactez le support Deal Lomé.
          </p>
        </Card>
      ) : (
        <Card>
          <SellerForm rejectionReason={profile?.rejectionReason ?? null} />
        </Card>
      )}
    </main>
  );
}
