import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardSection } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-(--container-page) flex-1 px-4 py-16 md:px-10">
      {/* Hero */}
      <section className="flex flex-col items-center gap-6 py-16 text-center">
        <Badge variant="wholesale">MVP — Lomé</Badge>
        <h1 className="max-w-3xl font-display text-4xl font-extrabold tracking-tight md:text-6xl">
          La marketplace <span className="text-gold">B2B</span> &{" "}
          <span className="text-emerald">B2C</span> du Togo
        </h1>
        <p className="max-w-xl text-lg text-ink-muted">
          Achetez et vendez en toute confiance : paiement sécurisé par Escrow,
          vendeurs vérifiés, livraison locale à Lomé.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Button size="lg">Explorer le catalogue</Button>
          <Button size="lg" variant="secondary">
            Devenir vendeur
          </Button>
        </div>
      </section>

      {/* Vitrine du design system — sera remplacée par la vraie homepage */}
      <section className="grid gap-6 md:grid-cols-3">
        <Card glow>
          <Badge variant="wholesale" className="mb-4">
            Vente en gros
          </Badge>
          <h2 className="font-display text-xl font-bold">Espace B2B</h2>
          <p className="mt-2 text-ink-muted">
            Prix dégressifs par paliers, commandes professionnelles et
            négociation directe avec les fournisseurs.
          </p>
        </Card>

        <Card>
          <Badge variant="verified" className="mb-4">
            Vendeur vérifié
          </Badge>
          <h2 className="font-display text-xl font-bold">
            Confiance d&apos;abord
          </h2>
          <p className="mt-2 text-ink-muted">
            Chaque vendeur est vérifié manuellement. Vos fonds restent bloqués
            en Escrow jusqu&apos;à confirmation de la livraison.
          </p>
        </Card>

        <Card>
          <h2 className="font-display text-xl font-bold">Restez informé</h2>
          <p className="mt-2 mb-4 text-ink-muted">
            Le lancement approche. Laissez-nous votre email.
          </p>
          <CardSection className="flex flex-col gap-3 p-4">
            <Input type="email" placeholder="votre@email.com" />
            <Button className="w-full">S&apos;inscrire</Button>
          </CardSection>
        </Card>
      </section>

      <footer className="mt-16 flex items-center justify-between border-t border-white/[0.04] pt-8 text-sm text-ink-muted">
        <span className="font-label">GK Market</span>
        <span>GK NÉGOCES × FlowKraft Agency</span>
      </footer>
    </main>
  );
}
