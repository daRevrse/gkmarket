"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, sendEmailVerification } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

/**
 * Vérification email (MVP n°6), politique douce : bandeau d'invitation tant
 * que l'email n'est pas vérifié, sans bloquer l'usage du compte.
 */
export function EmailVerificationBanner() {
  const [needsVerification, setNeedsVerification] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setNeedsVerification(Boolean(user?.email && !user.emailVerified));
    });
  }, []);

  if (!needsVerification) return null;

  async function resend() {
    setError(false);
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
        setSent(true);
      }
    } catch {
      setError(true);
    }
  }

  return (
    <p className="mb-6 rounded-md border border-gold/40 bg-gold/10 px-4 py-3 text-sm">
      Votre adresse email n&apos;est pas encore vérifiée — pensez à cliquer le
      lien reçu par email.{" "}
      {sent ? (
        <span className="text-emerald">Email renvoyé ✓</span>
      ) : (
        <button onClick={resend} className="text-emerald hover:underline">
          Renvoyer l&apos;email
        </button>
      )}
      {error ? (
        <span className="text-danger"> L&apos;envoi a échoué, réessayez.</span>
      ) : null}
    </p>
  );
}
