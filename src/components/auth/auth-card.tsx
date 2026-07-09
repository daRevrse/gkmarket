import Link from "next/link";
import { Icon } from "@/components/ui/icon";

/**
 * Gabarit « écran split » des pages d'authentification :
 * panneau gauche = marque (masqué sous lg), panneau droit = formulaire.
 * L'API (title, subtitle, children) reste celle de l'ancienne carte -
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
      {/* Panneau gauche - marque */}
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

        <div className="max-w-md space-y-8">
          <h2
            className="fade-up font-display text-4xl font-extrabold leading-tight xl:text-5xl"
            style={{ animationDelay: "80ms" }}
          >
            Le marché de Lomé,
            <br />
            <span className="text-gold">chez vous</span>.
          </h2>

          {/* Mosaïque produits - photos du catalogue (Unsplash, licence libre) */}
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                id: "1528459801416-a9e53bbf4e17",
                alt: "Tissus wax colorés",
                cls: "row-span-2 aspect-[3/4]",
                delay: 160,
              },
              {
                id: "1511707171634-5f897ff02aa9",
                alt: "Smartphone",
                cls: "aspect-[4/3]",
                delay: 240,
              },
              {
                id: "1596040033229-a9821ebd058d",
                alt: "Épices du marché",
                cls: "aspect-[4/3]",
                delay: 320,
              },
            ].map((img) => (
              <div
                key={img.id}
                className={`fade-up overflow-hidden rounded-xl border border-white/10 ${img.cls}`}
                style={{ animationDelay: `${img.delay}ms` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://images.unsplash.com/photo-${img.id}?auto=format&fit=crop&w=600&q=70`}
                  alt={img.alt}
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>

        <p
          className="fade-up font-label text-xs text-ink-muted"
          style={{ animationDelay: "420ms" }}
        >
          Paiement Mobile Money · Vendeurs vérifiés · Livraison à Lomé
        </p>
      </aside>

      {/* Panneau droit - formulaire */}
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
            Paiement sécurisé, vendeurs vérifiés, livraison à Lomé.
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
