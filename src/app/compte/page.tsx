import Link from "next/link";
import { redirect } from "next/navigation";
import { DeleteAccount } from "@/components/auth/delete-account";
import { LogoutButton } from "@/components/auth/logout-button";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardSection } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";

const profileStatusLabel: Record<string, string> = {
  pending: "En attente de validation",
  approved: "Vérifié",
  rejected: "Refusé",
  suspended: "Suspendu",
};

export default async function ComptePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  return (
    <main className="mx-auto w-full max-w-(--container-page) flex-1 px-4 py-12 md:px-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold">
            Bonjour{user.fullName ? `, ${user.fullName}` : ""} 👋
          </h1>
          <p className="mt-1 text-ink-muted">{user.email}</p>
        </div>
        <LogoutButton />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="font-display text-xl font-bold">Mes casquettes</h2>
          <p className="mt-1 mb-4 text-sm text-ink-muted">
            Tout compte GK Market peut acheter. Activez d&apos;autres rôles
            selon vos besoins.
          </p>
          <div className="flex flex-col gap-3">
            <CardSection className="flex items-center justify-between p-4">
              <span className="font-medium">Acheteur</span>
              <Badge variant="verified">Actif</Badge>
            </CardSection>
            <CardSection className="flex items-center justify-between p-4">
              <span className="font-medium">Vendeur</span>
              {user.sellerProfile ? (
                <Link
                  href={
                    user.sellerProfile.status === "approved"
                      ? "/vendeur/produits"
                      : "/compte/devenir-vendeur"
                  }
                  className="flex items-center gap-2"
                >
                  <Badge
                    variant={
                      user.sellerProfile.status === "approved"
                        ? "verified"
                        : "neutral"
                    }
                  >
                    {profileStatusLabel[user.sellerProfile.status]}
                  </Badge>
                  <span className="text-sm text-emerald">
                    {user.sellerProfile.status === "approved"
                      ? "Mes produits →"
                      : "Détails →"}
                  </span>
                </Link>
              ) : (
                <LinkButton
                  href="/compte/devenir-vendeur"
                  size="sm"
                  variant="secondary"
                >
                  Devenir vendeur
                </LinkButton>
              )}
            </CardSection>
            <CardSection className="flex items-center justify-between p-4">
              <span className="font-medium">Livreur</span>
              {user.courierProfile ? (
                <Link
                  href={
                    user.courierProfile.status === "approved"
                      ? "/livreur/courses"
                      : "/compte/devenir-livreur"
                  }
                  className="flex items-center gap-2"
                >
                  <Badge
                    variant={
                      user.courierProfile.status === "approved"
                        ? "verified"
                        : "neutral"
                    }
                  >
                    {profileStatusLabel[user.courierProfile.status]}
                  </Badge>
                  <span className="text-sm text-emerald">
                    {user.courierProfile.status === "approved"
                      ? "Mes courses →"
                      : "Détails →"}
                  </span>
                </Link>
              ) : (
                <LinkButton
                  href="/compte/devenir-livreur"
                  size="sm"
                  variant="secondary"
                >
                  Devenir livreur
                </LinkButton>
              )}
            </CardSection>
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-xl font-bold">Mon activité</h2>
          <p className="mt-1 mb-4 text-sm text-ink-muted">
            Commandes, wallet et adresses arrivent dans les prochaines
            itérations.
          </p>
          <div className="flex flex-col gap-3">
            <Link href="/compte/commandes" className="group">
              <CardSection className="flex items-center justify-between p-4 transition-colors group-hover:bg-white/[0.06]">
                <span>Mes commandes</span>
                <span className="text-emerald">Voir →</span>
              </CardSection>
            </Link>
            <Link href="/compte/wallet" className="group">
              <CardSection className="flex items-center justify-between p-4 transition-colors group-hover:bg-white/[0.06]">
                <span>Mon wallet</span>
                <span className="text-emerald">Gérer →</span>
              </CardSection>
            </Link>
            <Link href="/compte/adresses" className="group">
              <CardSection className="flex items-center justify-between p-4 transition-colors group-hover:bg-white/[0.06]">
                <span>Mes adresses de livraison</span>
                <span className="text-emerald">Gérer →</span>
              </CardSection>
            </Link>
          </div>
        </Card>
      </div>

      {user.isAdmin ? (
        <Card className="mt-6 border-gold/30">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-bold">
                Administration
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                Validation des vendeurs et gestion de la marketplace.
              </p>
            </div>
            <LinkButton href="/admin" size="sm">
              Ouvrir l&apos;admin
            </LinkButton>
          </div>
        </Card>
      ) : null}

      <div className="mt-6">
        <DeleteAccount />
      </div>
    </main>
  );
}
