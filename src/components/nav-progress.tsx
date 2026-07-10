"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";

type NavProgressState = { active: boolean; progress: number };

const NavProgressContext = createContext<NavProgressState>({
  active: false,
  progress: 0,
});

/** État de la barre de progression de navigation (lu par le header). */
export function useNavProgress() {
  return useContext(NavProgressContext);
}

/**
 * Suit les navigations (clic sur lien interne, retour/avance) et expose une
 * progression 0-100. Placé dans le layout racine : il PERSISTE d'une page à
 * l'autre, donc la barre reste continue même quand l'en-tête se remonte.
 */
export function NavProgressProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<NavProgressState>({
    active: false,
    progress: 0,
  });
  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);
  const safety = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pathname = usePathname();
  const searchParams = useSearchParams();

  const finish = useCallback(() => {
    if (safety.current) {
      clearTimeout(safety.current);
      safety.current = null;
    }
    if (trickle.current) {
      clearInterval(trickle.current);
      trickle.current = null;
    }
    setState({ active: true, progress: 100 });
    setTimeout(() => setState({ active: false, progress: 0 }), 350);
  }, []);

  const begin = useCallback(() => {
    if (trickle.current) return; // déjà en cours
    setState({ active: true, progress: 12 });
    trickle.current = setInterval(() => {
      setState((s) => ({
        active: true,
        progress: s.progress >= 90 ? s.progress : s.progress + (90 - s.progress) * 0.14,
      }));
    }, 180);
    if (safety.current) clearTimeout(safety.current);
    safety.current = setTimeout(finish, 8000); // filet de sécurité
  }, [finish]);

  // Début : clic sur lien interne, ou retour/avance navigateur.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor = (event.target as HTMLElement | null)?.closest?.("a[href]");
      if (!anchor) return;
      const target = anchor.getAttribute("target");
      if ((target && target !== "_self") || anchor.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL((anchor as HTMLAnchorElement).href, location.href);
      } catch {
        return;
      }
      if (url.origin !== location.origin) return;
      if (url.href === location.href) return; // même page
      if (url.pathname === location.pathname && url.hash) return; // ancre interne
      begin();
    }
    // Phase CAPTURE : on intercepte le clic avant que Next (Link) n'appelle
    // preventDefault() pour sa navigation SPA — sinon `defaultPrevented`
    // serait déjà vrai et on manquerait la navigation.
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", begin);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", begin);
    };
  }, [begin]);

  // Fin : la nouvelle route est rendue (chemin ou query a changé).
  useEffect(() => {
    if (trickle.current) finish();
  }, [pathname, searchParams, finish]);

  useEffect(() => {
    return () => {
      if (trickle.current) clearInterval(trickle.current);
      if (safety.current) clearTimeout(safety.current);
    };
  }, []);

  return (
    <NavProgressContext.Provider value={state}>
      {children}
    </NavProgressContext.Provider>
  );
}
