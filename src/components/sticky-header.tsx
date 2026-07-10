"use client";

import { useEffect, useRef, useState } from "react";
import { useNavProgress } from "@/components/nav-progress";
import { cn } from "@/lib/utils";

/**
 * En-tête collant : reste en haut, se masque quand on défile vers le bas et
 * réapparaît dès qu'on remonte. Une barre de progression de navigation (façon
 * YouTube) se confond avec la bordure du bas pendant le chargement d'une page.
 */
export function StickyHeader({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const { active, progress } = useNavProgress();

  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;
      if (y < 80) setHidden(false);
      else if (delta > 6) setHidden(true);
      else if (delta < -6) setHidden(false);
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Pendant un chargement, on garde l'en-tête visible (la barre est dessus).
  const isHidden = hidden && !active;

  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b border-white/[0.06] bg-navy/85 backdrop-blur transition-transform duration-300",
        isHidden ? "-translate-y-full" : "translate-y-0",
      )}
    >
      {children}
      {active ? (
        <span
          className="pointer-events-none absolute inset-x-0 -bottom-px z-10 h-0.5 overflow-hidden"
          aria-hidden="true"
        >
          <span
            className="block h-full rounded-r-full bg-gold shadow-[0_0_8px_1px] shadow-gold/70 transition-[width] duration-200 ease-out"
            style={{ width: `${progress}%` }}
          />
        </span>
      ) : null}
    </header>
  );
}
