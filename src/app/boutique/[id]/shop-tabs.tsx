import Link from "next/link";
import { cn } from "@/lib/utils";

export const shopTabs = [
  { key: "accueil", label: "Accueil" },
  { key: "produits", label: "Produits" },
  { key: "profil", label: "Profil" },
  { key: "avis", label: "Avis" },
] as const;

export type ShopTab = (typeof shopTabs)[number]["key"];

export function isShopTab(value: unknown): value is ShopTab {
  return shopTabs.some((tab) => tab.key === value);
}

/** Onglets de la vitrine, rendus côté serveur (simples liens, pas de JS). */
export function ShopTabs({
  shopId,
  active,
  counts,
}: {
  shopId: string;
  active: ShopTab;
  counts?: Partial<Record<ShopTab, number>>;
}) {
  return (
    <nav className="mt-8 flex gap-1 overflow-x-auto border-b border-white/[0.06]">
      {shopTabs.map((tab) => (
        <Link
          key={tab.key}
          href={
            tab.key === "accueil"
              ? `/boutique/${shopId}`
              : `/boutique/${shopId}?onglet=${tab.key}`
          }
          className={cn(
            "-mb-px shrink-0 border-b-2 px-4 py-3 font-label text-sm transition-colors",
            tab.key === active
              ? "border-gold text-gold"
              : "border-transparent text-ink-muted hover:text-ink",
          )}
        >
          {tab.label}
          {counts?.[tab.key] ? (
            <span className="ml-1.5 text-xs text-ink-muted">
              {counts[tab.key]}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
