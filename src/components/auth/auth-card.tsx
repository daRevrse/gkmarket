import Link from "next/link";
import { Icon } from "@/components/ui/icon";

/**
 * Gabarit « écran split » des pages d'authentification :
 * panneau gauche = marque (masqué sous lg), panneau droit = formulaire.
 * L'API (title, subtitle, children) reste celle de l'ancienne carte —
 * les pages connexion / inscription / mot-de-passe-oublie sont inchangées.
 */
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-1">
      {/* Panneau gauche — marque */}
      <aside className="dot-grid relative hidden w-1/2 flex-col justify-between overflow-hidden border-r border-white/5 bg-navy-deep p-12 lg:flex xl:p-16">
        {/* Cercles décoratifs plats */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -bottom-40 size-[480px] rounded-full border border-gold/10"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -bottom-64 size-[480px] rounded-full border border-emerald/10"
        />

        <Link
          href="/"
          className="fade-up flex items-center gap-2 font-display text-2xl font-extrabold"
        >
          <Icon name="bag" className="size-6 text-gold" />
          Deal <span className="text-gold">Lomé</span>
        </Link>

        <div className="max-w-md space-y-10">
          <h2
            className="fade-up font-display text-4xl font-extrabold leading-tight xl:text-5xl"
            style={{ animationDelay: "80ms" }}
          >
            Le commerce du Togo,
            <br />
            en toute <span className="text-gold">confiance</span>.
          </h2>

          <ul className="space-y-4">
            {[
              {
                icon: "shield",
                title: "Paiement Escrow",
                desc: "Vos fonds sont protégés jusqu'à réception de la commande.",
              },
              {
                icon: "check",
                title: "Vendeurs vérifiés",
                desc: "Chaque boutique est contrôlée avant d'être publiée.",
              },
              {
                icon: "truck",
                title: "Livraison locale",
                desc: "À domicile ou en point relais, partout à Lomé.",
              },
            ].map((f, i) => (
              <li
                key={f.title}
                className="fade-up glass flex items-start gap-4 rounded-lg p-4"
                style={{ animationDelay: `${160 + i * 80}ms` }}
              >
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-gold/10 text-gold">
                  <Icon name={f.icon} className="size-4.5" />
                </span>
                <div>
                  <p className="font-bold">{f.title}</p>
                  <p className="text-sm text-ink-muted">{f.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <figure
          className="fade-up max-w-md"
          style={{ animationDelay: "480ms" }}
        >
          <blockquote className="text-sm italic text-ink-muted">
            “En tant que vendeuse, j'ai triplé mon chiffre d'affaires en moins
            de 6 mois. La plateforme est intuitive.”
          </blockquote>
          <figcaption className="mt-3 flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-full bg-white/5 font-label text-xs font-bold">
              AT
            </span>
            <span className="font-label text-xs text-ink-muted">
              Aminata T. — Boutique de mode, Lomé
            </span>
          </figcaption>
        </figure>
      </aside>

      {/* Panneau droit — formulaire */}
      <section className="flex flex-1 items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="mb-10 flex items-center justify-center gap-2 font-display text-2xl font-extrabold lg:hidden"
          >
            <Icon name="bag" className="size-6 text-gold" />
            Deal <span className="text-gold">Lomé</span>
          </Link>

          <h1 className="font-display text-3xl font-bold">{title}</h1>
          {subtitle ? (
            <p className="mt-2 text-sm text-ink-muted">{subtitle}</p>
          ) : null}
          <div className="mt-8">{children}</div>

          <p className="mt-10 text-center font-label text-xs text-ink-muted lg:hidden">
            Paiement Escrow, vendeurs vérifiés, livraison à Lomé.
          </p>
        </div>
      </section>
    </main>
  );
}

export function FormField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={htmlFor}
        className="font-label text-sm font-medium text-ink-muted"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-md border border-danger/40 bg-danger-deep/20 px-4 py-3 text-sm text-danger">
      {message}
    </p>
  );
}
