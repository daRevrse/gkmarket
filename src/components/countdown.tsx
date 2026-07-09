"use client";

import { useEffect, useState } from "react";
import { ClockIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

function remaining(endsAt: string): string | null {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return days > 0
    ? `${days}j ${pad(h)}:${pad(m)}:${pad(sec)}`
    : `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

/** Compte à rebours d'expiration d'une offre - disparaît une fois échue. */
export function Countdown({
  endsAt,
  className,
}: {
  endsAt: string;
  className?: string;
}) {
  // Rendu serveur stable (-) puis tic-tac côté client pour éviter tout
  // écart d'hydratation.
  const [label, setLabel] = useState<string | null>("-");

  useEffect(() => {
    setLabel(remaining(endsAt));
    const timer = setInterval(() => setLabel(remaining(endsAt)), 1000);
    return () => clearInterval(timer);
  }, [endsAt]);

  if (label === null) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-label text-[11px] font-semibold text-danger tabular-nums",
        className,
      )}
    >
      <ClockIcon className="size-3.5" />
      {label}
    </span>
  );
}
