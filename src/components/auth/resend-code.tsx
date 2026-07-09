"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Renvoi d'un code OTP avec délai de grâce : les codes SMS Firebase expirent
 * au bout de quelques minutes, et Google limite les envois par numéro -
 * le cooldown évite de déclencher ce throttling.
 * `onResend` doit renvoyer un nouveau code (et lever en cas d'échec :
 * le parent affiche l'erreur, ici on ne gère que l'état du bouton).
 */
export function ResendCode({
  onResend,
  cooldownSeconds = 60,
}: {
  onResend: () => Promise<void>;
  cooldownSeconds?: number;
}) {
  const [secondsLeft, setSecondsLeft] = useState(cooldownSeconds);
  const [sending, setSending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  async function handleResend() {
    setSending(true);
    setResent(false);
    try {
      await onResend();
      setResent(true);
      setSecondsLeft(cooldownSeconds);
    } catch {
      // L'erreur est affichée par le parent ; on réarme quand même un petit
      // délai pour éviter le martèlement du bouton.
      setSecondsLeft(15);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <p className="text-xs text-ink-muted">
        Le code expire au bout de quelques minutes.
        {resent ? (
          <span className="text-emerald"> Nouveau code envoyé.</span>
        ) : null}
      </p>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={secondsLeft > 0 || sending}
        onClick={handleResend}
      >
        {sending
          ? "Envoi du code…"
          : secondsLeft > 0
            ? `Renvoyer le code (${secondsLeft} s)`
            : "Renvoyer le code"}
      </Button>
    </div>
  );
}
