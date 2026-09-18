"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type RealtimeEvent =
  | { type: "message"; conversationId: string }
  | { type: "read"; conversationId: string }
  | { type: "typing"; conversationId: string }
  | { type: "resync" };

type Listener = (event: RealtimeEvent) => void;

const RealtimeContext = createContext<Set<Listener> | null>(null);

/**
 * Flux temps réel des espaces connectés (/api/realtime, SSE). Tout événement
 * de données rafraîchit la page courante (fil de messages, badges non-lus) ;
 * les composants peuvent aussi écouter les événements via useRealtime.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [listeners] = useState(() => new Set<Listener>());

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => router.refresh(), 150);
    };

    const source = new EventSource("/api/realtime");
    let hadError = false;
    source.onopen = () => {
      // Reconnexion après coupure : des événements ont pu être manqués.
      if (hadError) refresh();
      hadError = false;
    };
    source.onerror = () => {
      hadError = true;
    };
    source.onmessage = (message) => {
      let event: RealtimeEvent;
      try {
        event = JSON.parse(message.data) as RealtimeEvent;
      } catch {
        return;
      }
      for (const listener of listeners) listener(event);
      if (event.type !== "typing") refresh();
    };

    return () => {
      clearTimeout(refreshTimer);
      source.close();
    };
  }, [router, listeners]);

  return (
    <RealtimeContext.Provider value={listeners}>
      {children}
    </RealtimeContext.Provider>
  );
}

/** Écoute les événements temps réel (sans effet hors RealtimeProvider). */
export function useRealtime(listener: Listener) {
  const listeners = useContext(RealtimeContext);
  const latest = useRef(listener);
  useEffect(() => {
    latest.current = listener;
  });
  useEffect(() => {
    if (!listeners) return;
    const wrapped: Listener = (event) => latest.current(event);
    listeners.add(wrapped);
    return () => {
      listeners.delete(wrapped);
    };
  }, [listeners]);
}
