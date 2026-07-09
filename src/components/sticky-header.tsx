"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * En-tête collant : reste en haut, se masque quand on défile vers le bas et
 * réapparaît dès qu'on remonte (comportement « show on scroll up »).
 */
export function StickyHeader({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;
      if (y < 80) {
        setHidden(false); // toujours visible en haut de page
      } else if (delta > 6) {
        setHidden(true); // on descend -> on masque
      } else if (delta < -6) {
        setHidden(false); // on remonte -> on montre
      }
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b border-white/[0.06] bg-navy/85 backdrop-blur transition-transform duration-300",
        hidden ? "-translate-y-full" : "translate-y-0",
      )}
    >
      {children}
    </header>
  );
}
