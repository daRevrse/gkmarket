"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowTrendingUpIcon,
  BuildingStorefrontIcon,
  CameraIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import { Spinner } from "@/components/ui/spinner";
import type { SearchSuggestions } from "@/app/api/recherche/suggestions/route";
import { formatFcfa } from "@/lib/format";
import { cn } from "@/lib/utils";

const RECENT_KEY = "dl:recherches-recentes";
const RECENT_MAX = 6;

type Item =
  | { kind: "product"; label: string; href: string; imageUrl: string | null; priceFcfa: number }
  | { kind: "category" | "shop"; label: string; href: string }
  | { kind: "recent" | "popular"; label: string };

function readRecent(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((q) => typeof q === "string") : [];
  } catch {
    return [];
  }
}

function saveRecent(query: string) {
  try {
    const next = [query, ...readRecent().filter((q) => q !== query)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Stockage indisponible (navigation privée) : sans incidence.
  }
}

const SECTION_TITLES: Record<Item["kind"], string> = {
  product: "Produits",
  category: "Rayons",
  shop: "Boutiques",
  recent: "Recherches récentes",
  popular: "Tendances",
};

/**
 * Barre de recherche avec autocomplétion (docs/CHANGEMENTS.md §5, lot 4) :
 * produits, rayons et boutiques au fil de la saisie ; recherches récentes
 * (sur l'appareil) et tendances quand le champ est vide. Clavier : flèches,
 * Entrée, Échap.
 */
export function SearchBox({ defaultQuery = "" }: { defaultQuery?: string }) {
  const router = useRouter();
  const listId = useId();
  const [value, setValue] = useState(defaultQuery);
  const [open, setOpen] = useState(false);
  // Recherche par photo (lot 7) : envoi du fichier, puis ouverture des
  // résultats visuels.
  const photoInput = useRef<HTMLInputElement>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [data, setData] = useState<SearchSuggestions | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [active, setActive] = useState(-1);
  const requestRef = useRef<AbortController | null>(null);

  // Suggestions au fil de la saisie (anti-rebond 180 ms).
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;
      fetch(`/api/recherche/suggestions?q=${encodeURIComponent(value)}`, {
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((json: SearchSuggestions | null) => {
          setData(json);
          setActive(-1);
        })
        .catch(() => {});
    }, 180);
    return () => clearTimeout(timer);
  }, [value, open]);

  const trimmed = value.trim();
  const items: Item[] = trimmed.length >= 2
    ? [
        ...(data?.products ?? []).map((p) => ({
          kind: "product" as const,
          label: p.title,
          href: p.href,
          imageUrl: p.imageUrl,
          priceFcfa: p.priceFcfa,
        })),
        ...(data?.categories ?? []).map((c) => ({ kind: "category" as const, label: c.name, href: c.href })),
        ...(data?.shops ?? []).map((s) => ({ kind: "shop" as const, label: s.name, href: s.href })),
      ]
    : [
        ...recent.map((q) => ({ kind: "recent" as const, label: q })),
        ...(data?.popular ?? [])
          .filter((q) => !recent.includes(q))
          .map((q) => ({ kind: "popular" as const, label: q })),
      ];

  function search(query: string) {
    const q = query.trim();
    if (!q) return;
    saveRecent(q);
    setOpen(false);
    setValue(q);
    router.push(`/produits?q=${encodeURIComponent(q)}`);
  }

  /** Envoie la photo choisie et ouvre les résultats visuels. */
  async function searchByPhoto(file: File) {
    setPhotoError(null);
    setPhotoLoading(true);
    try {
      const response = await fetch("/api/recherche/image", {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPhotoError(data.error ?? "La recherche par photo a échoué.");
        return;
      }
      setOpen(false);
      router.push(`/produits?image=${data.id}`);
    } catch {
      setPhotoError("La recherche par photo a échoué. Réessayez.");
    } finally {
      setPhotoLoading(false);
    }
  }

  function choose(item: Item) {
    if ("href" in item) {
      setOpen(false);
      router.push(item.href);
    } else {
      search(item.label);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      if (items.length === 0) return;
      setActive((index) =>
        event.key === "ArrowDown"
          ? (index + 1) % items.length
          : (index - 1 + items.length) % items.length,
      );
    } else if (event.key === "Enter") {
      // Géré ici plutôt que par la soumission implicite du formulaire,
      // variable selon les navigateurs et claviers virtuels.
      event.preventDefault();
      if (open && active >= 0 && items[active]) choose(items[active]);
      else search(value);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const showPanel = open && (items.length > 0 || Boolean(data?.correction));

  return (
    <form
      role="search"
      className="relative min-w-48 flex-1"
      onSubmit={(event) => {
        event.preventDefault();
        search(value);
      }}
    >
      <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
      <input
        type="search"
        name="q"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setRecent(readRecent());
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder="Rechercher un produit, un rayon, une boutique…"
        autoComplete="off"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        className="w-full rounded-md border border-white/10 bg-white/5 py-2.5 pr-11 pl-9 text-sm text-ink placeholder:text-ink-muted/60 focus:border-emerald focus:outline-none"
      />
      {/* Recherche par photo : appareil photo sur mobile, fichier ailleurs. */}
      <button
        type="button"
        title="Rechercher avec une photo"
        aria-label="Rechercher avec une photo"
        disabled={photoLoading}
        onClick={() => photoInput.current?.click()}
        className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-white/5 hover:text-emerald disabled:opacity-60"
      >
        {photoLoading ? (
          <Spinner className="size-4" />
        ) : (
          <CameraIcon className="size-4" />
        )}
      </button>
      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void searchByPhoto(file);
        }}
      />
      {photoError ? (
        <p className="absolute inset-x-0 top-full z-50 mt-1 rounded-md border border-danger/40 bg-navy-deep px-3 py-2 text-xs text-danger">
          {photoError}
        </p>
      ) : null}

      {showPanel ? (
        <div
          // Garde le focus dans le champ pendant le clic sur une suggestion.
          onMouseDown={(event) => event.preventDefault()}
          className="absolute inset-x-0 top-full z-50 mt-1 max-h-[70vh] overflow-y-auto rounded-lg border border-white/10 bg-navy-deep p-1 shadow-2xl"
        >
          {data?.correction && trimmed.length >= 2 ? (
            <p className="px-3 py-2 text-xs text-ink-muted">
              Résultats pour{" "}
              <button
                type="button"
                onClick={() => search(data.correction!)}
                className="font-semibold text-emerald hover:underline"
              >
                « {data.correction} »
              </button>
            </p>
          ) : null}
          <ul id={listId} role="listbox">
            {items.map((item, index) => {
              const showTitle = index === 0 || items[index - 1].kind !== item.kind;
              return (
                <li key={`${item.kind}-${item.label}-${index}`} role="presentation">
                  {showTitle ? (
                    <p className="px-3 pt-2 pb-1 font-label text-[10px] font-semibold tracking-wider text-ink-muted uppercase">
                      {SECTION_TITLES[item.kind]}
                    </p>
                  ) : null}
                  <div
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === active}
                    onClick={() => choose(item)}
                    onMouseEnter={() => setActive(index)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm",
                      index === active ? "bg-white/[0.07]" : "",
                    )}
                  >
                    {item.kind === "product" ? (
                      <span className="size-9 shrink-0 overflow-hidden rounded bg-white/5">
                        {item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.imageUrl} alt="" className="size-full object-cover" />
                        ) : null}
                      </span>
                    ) : item.kind === "category" ? (
                      <Squares2X2Icon className="size-4 shrink-0 text-ink-muted" />
                    ) : item.kind === "shop" ? (
                      <BuildingStorefrontIcon className="size-4 shrink-0 text-ink-muted" />
                    ) : item.kind === "recent" ? (
                      <ClockIcon className="size-4 shrink-0 text-ink-muted" />
                    ) : (
                      <ArrowTrendingUpIcon className="size-4 shrink-0 text-ink-muted" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.kind === "product" ? (
                      <span className="shrink-0 font-display text-xs font-bold text-gold">
                        {formatFcfa(item.priceFcfa)}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
          {trimmed.length >= 2 ? (
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-emerald hover:bg-white/[0.05]"
            >
              <MagnifyingGlassIcon className="size-4" />
              Tous les résultats pour « {trimmed} »
            </button>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
