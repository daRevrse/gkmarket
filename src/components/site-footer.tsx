import Link from "next/link";
import {
  CreditCardIcon,
  DevicePhoneMobileIcon,
  ShoppingBagIcon,
  WalletIcon,
} from "@heroicons/react/24/outline";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/5 bg-[#060f1a] px-4 pt-16 pb-10 md:px-10">
      <div className="mx-auto mb-12 grid max-w-(--container-page) grid-cols-2 gap-8 md:grid-cols-4">
        <div className="col-span-2 space-y-5 md:col-span-1">
          <Link
            href="/"
            className="flex items-center gap-2 font-display text-xl font-extrabold"
          >
            <ShoppingBagIcon className="size-6 text-gold" />
            Deal <span className="text-gold">Lomé</span>
          </Link>
          <p className="text-ink-muted">
            La marketplace des commerçants du Togo. Achetez et vendez en toute
            confiance.
          </p>
        </div>
        {(
          [
            [
              "Société",
              [
                ["À propos", null],
                ["Carrières", null],
                ["Presse", null],
                ["Contact", "/contact"],
              ],
            ],
            [
              "Acheteurs",
              [
                ["Suivi de commande", "/compte/commandes"],
                ["Livraison & tarifs", "/faq"],
                ["Retours & litiges", "/faq"],
                ["Aide & FAQ", "/faq"],
              ],
            ],
            [
              "Vendeurs & livreurs",
              [
                ["Vendre sur Deal Lomé", "/compte/devenir-vendeur"],
                ["Conditions vendeur", "/cgv-vendeur"],
                ["Portail marchand", "/vendeur"],
                ["Devenir livreur", "/compte/devenir-livreur"],
              ],
            ],
          ] as [string, [string, string | null][]][]
        ).map(([title, links]) => (
          <div key={title}>
            <h4 className="mb-5 font-bold">{title}</h4>
            <ul className="space-y-3 font-label text-sm text-ink-muted">
              {links.map(([label, href]) => (
                <li key={label}>
                  {href ? (
                    <Link
                      href={href}
                      className="transition-colors hover:text-gold"
                    >
                      {label}
                    </Link>
                  ) : (
                    <span className="cursor-default">{label}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto flex max-w-(--container-page) flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 md:flex-row">
        <p className="font-label text-xs text-ink-muted">
          © 2026 Deal Lomé · GK NÉGOCES. Tous droits réservés.
        </p>
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-label text-xs text-ink-muted">
          {[
            ["Conditions d'utilisation", "/cgu"],
            ["Conditions de vente", "/cgv"],
            ["Mentions légales", "/mentions-legales"],
            ["Contact", "/contact"],
          ].map(([label, href]) => (
            <Link key={href} href={href} className="transition-colors hover:text-gold">
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4 text-ink-muted">
          <CreditCardIcon className="size-6" />
          <DevicePhoneMobileIcon className="size-6" />
          <WalletIcon className="size-6" />
        </div>
      </div>
    </footer>
  );
}
