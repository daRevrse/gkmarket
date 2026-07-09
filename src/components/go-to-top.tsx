"use client";

import { useEffect, useState } from "react";
import { ChevronUpIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

/** Bouton flottant « revenir en haut », visible après un défilement notable. */
export function GoToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 500);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      aria-label="Revenir en haut"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={cn(
        "fixed right-5 bottom-5 z-40 flex size-11 items-center justify-center rounded-full bg-gold text-navy-deep shadow-lg ring-1 ring-black/10 transition-all duration-300 hover:bg-gold-light md:right-8 md:bottom-8",
        show
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-4 opacity-0",
      )}
    >
      <ChevronUpIcon className="size-6" strokeWidth={2.5} />
    </button>
  );
}
