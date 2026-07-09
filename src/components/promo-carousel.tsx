"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { ProductCard, type CatalogProduct } from "@/components/product-card";

const AUTO_ADVANCE_MS = 3500;

/**
 * Carrousel auto-défilant de cartes produit (offres & promos). Avance tout
 * seul, boucle en fin de piste, se met en pause au survol. Flèches (chevrons)
 * pour la navigation manuelle sur desktop.
 */
export function PromoCarousel({ products }: { products: CatalogProduct[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || products.length < 2) return;
    const timer = setInterval(() => {
      const el = trackRef.current;
      if (!el) return;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
      el.scrollTo({
        left: atEnd ? 0 : el.scrollLeft + el.clientWidth * 0.8,
        behavior: "smooth",
      });
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [paused, products.length]);

  function nudge(direction: number) {
    const el = trackRef.current;
    if (el) {
      el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
    }
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        ref={trackRef}
        className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-1"
      >
        {products.map((product) => (
          <div
            key={product.id}
            className="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[15.7%]"
          >
            <ProductCard product={product} />
          </div>
        ))}
      </div>

      {products.length > 2 ? (
        <>
          <button
            type="button"
            aria-label="Offres précédentes"
            onClick={() => nudge(-1)}
            className="absolute top-1/2 -left-3 z-10 hidden -translate-y-1/2 rounded-full bg-navy-surface/90 p-2 text-ink ring-1 ring-white/10 backdrop-blur transition-colors hover:bg-navy-surface md:block"
          >
            <ChevronLeftIcon className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Offres suivantes"
            onClick={() => nudge(1)}
            className="absolute top-1/2 -right-3 z-10 hidden -translate-y-1/2 rounded-full bg-navy-surface/90 p-2 text-ink ring-1 ring-white/10 backdrop-blur transition-colors hover:bg-navy-surface md:block"
          >
            <ChevronRightIcon className="size-5" />
          </button>
        </>
      ) : null}
    </div>
  );
}
