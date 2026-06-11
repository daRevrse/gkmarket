import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
                <Badge
                  variant={
                    user.sellerProfile.status === "approved"
                      ? "verified"
                      : "neutral"
                  }
                >
                  {profileStatusLabel[user.sellerProfile.status]}
                </Badge>
              ) : (
                <Button size="sm" variant="secondary" disabled>
                  Bientôt disponible
                </Button>
              )}
            </CardSection>
            <CardSection className="flex items-center justify-between p-4">
              <span className="font-medium">Livreur</span>
              {user.courierProfile ? (
                <Badge
                  variant={
                    user.courierProfile.status === "approved"
                      ? "verified"
                      : "neutral"
                  }
                >
                  {profileStatusLabel[user.courierProfile.status]}
                </Badge>
              ) : (
                <Button size="sm" variant="secondary" disabled>
                  Bientôt disponible
                </Button>
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
            <CardSection className="flex items-center justify-between p-4 opacity-60">
              <span>Mes commandes</span>
              <Badge>À venir</Badge>
            </CardSection>
            <CardSection className="flex items-center justify-between p-4 opacity-60">
              <span>Mon wallet</span>
              <Badge>À venir</Badge>
            </CardSection>
            <Link href="/compte/adresses" className="group">
              <CardSection className="flex items-center justify-between p-4 transition-colors group-hover:bg-white/[0.06]">
                <span>Mes adresses de livraison</span>
                <span className="text-emerald">Gérer →</span>
              </CardSection>
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}
