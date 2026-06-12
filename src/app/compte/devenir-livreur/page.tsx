import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { vehicleTypeLabels } from "@/lib/deliveries";
import { CourierForm } from "./courier-form";

export default async function DevenirLivreurPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  const profile = user.courierProfile;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 md:px-10">
      <div className="mb-8">
        <Link
          href="/compte"
          className="text-sm text-ink-muted hover:text-emerald"
        >
          ← Mon compte
        </Link>
        <h1 className="mt-2 font-display text-3xl font-extrabold">
          Devenir livreur
        </h1>
        <p className="mt-1 text-ink-muted">
          Effectuez les livraisons des vendeurs Deal Lomé et gagnez les frais
          de livraison de chaque course, versés sur votre wallet.
        </p>
      </div>

      {profile?.status === "pending" ? (
        <Card>
          <div className="flex items-center gap-3">
            <h2 className="font-display text-xl font-bold">
              Livreur — {vehicleTypeLabels[profile.vehicleType]}
            </h2>
            <Badge>En attente de validation</Badge>
          </div>
          <p className="mt-3 text-sm text-ink-muted">
            Votre demande a bien été reçue. Notre équipe vérifie vos documents
            — vous serez notifié dès qu&apos;elle est traitée.
          </p>
        </Card>
      ) : profile?.status === "approved" ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="font-display text-xl font-bold">
                  Livreur — {vehicleTypeLabels[profile.vehicleType]}
                </h2>
                <Badge variant="verified">Livreur vérifié</Badge>
              </div>
              <p className="mt-3 text-sm text-ink-muted">
                Félicitations, vous pouvez recevoir des courses ! Les vendeurs
                vous proposent des livraisons selon votre zone.
              </p>
            </div>
            <LinkButton href="/livreur/courses" size="sm">
              Mes courses
            </LinkButton>
          </div>
        </Card>
      ) : profile?.status === "suspended" ? (
        <Card>
          <div className="flex items-center gap-3">
            <h2 className="font-display text-xl font-bold">Livreur</h2>
            <Badge variant="neutral">Suspendu</Badge>
          </div>
          <p className="mt-3 text-sm text-ink-muted">
            Votre profil livreur est suspendu. Contactez le support Deal Lomé.
          </p>
        </Card>
      ) : (
        <Card>
          <CourierForm rejectionReason={profile?.rejectionReason ?? null} />
        </Card>
      )}
    </main>
  );
}
