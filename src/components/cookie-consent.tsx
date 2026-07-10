"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const COOKIE = "cookie_consent";

/**
 * Bandeau de consentement. Deal Lomé n'utilise que des cookies essentiels
 * (session de connexion, panier invité) : c'est donc une information + accusé
 * de réception, mémorisé dans un cookie 1 an.
 */
export function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const accepted = document.cookie
      .split("; ")
      .some((c) => c.startsWith(`${COOKIE}=`));
    // Affichage décidé côté client (le cookie n'existe pas au rendu serveur).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!accepted) setShow(true);
  }, []);

  function accept() {
    document.cookie = `${COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-lg rounded-xl border border-white/10 bg-navy-surface/95 p-4 shadow-xl backdrop-blur md:right-6 md:bottom-6 md:left-auto md:mx-0 md:w-[26rem]">
      <p className="text-sm text-ink-muted">
        Deal Lomé n&apos;utilise que des <span className="text-ink">cookies essentiels</span>{" "}
        (connexion, panier), aucun traceur publicitaire. En savoir plus dans nos{" "}
        <Link href="/cgu" className="text-emerald hover:underline">
          conditions d&apos;utilisation
        </Link>
        .
      </p>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={accept}
          className="rounded-md bg-gold px-4 py-2 font-label text-sm font-semibold text-navy-deep transition-colors hover:bg-gold-light"
        >
          J&apos;ai compris
        </button>
      </div>
    </div>
  );
}
