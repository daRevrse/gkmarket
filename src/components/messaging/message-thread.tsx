"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DocumentTextIcon } from "@heroicons/react/24/outline";
import type { MessageMeta } from "@/db/schema";
import { AudioMessage } from "@/components/messaging/audio-message";
import { useRealtime } from "@/components/realtime/realtime-provider";
import { formatFcfa } from "@/lib/format";
import { productPath } from "@/lib/product-url";
import { cn } from "@/lib/utils";

export type ThreadMessage = {
  id: string;
  senderId: string;
  kind: "text" | "product" | "image" | "file" | "audio";
  body: string;
  productId: string | null;
  meta: MessageMeta | null;
  readAt: Date | null;
  createdAt: Date;
};

// Heure de Lomé explicite : rendu identique serveur/navigateur.
const TIME_ZONE = "Africa/Lome";

function dayKey(date: Date) {
  return date.toLocaleDateString("fr-FR", { timeZone: TIME_ZONE });
}

function dayLabel(date: Date) {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (dayKey(date) === dayKey(today)) return "Aujourd'hui";
  if (dayKey(date) === dayKey(yesterday)) return "Hier";
  return date.toLocaleDateString("fr-FR", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "long",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

function fileSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`
    : `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}

function MessageContent({ message }: { message: ThreadMessage }) {
  const attachmentUrl = `/api/messages/${message.id}/attachment`;
  switch (message.kind) {
    case "product": {
      const product = message.meta?.product;
      if (!product) return null;
      const card = (
        <div className="flex w-64 gap-3">
          <div className="size-16 shrink-0 overflow-hidden rounded-md bg-white/5">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.imageUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-medium">{product.title}</p>
            <p className="mt-0.5 font-display text-sm font-bold text-gold">
              {formatFcfa(product.priceFcfa)}
            </p>
            {product.minOrderQty > 1 ? (
              <p className="text-[11px] text-ink-muted">
                Min. {product.minOrderQty} unités
              </p>
            ) : null}
          </div>
        </div>
      );
      return message.productId ? (
        <Link
          href={productPath({ id: message.productId, title: product.title })}
          className="block hover:opacity-90"
        >
          {card}
        </Link>
      ) : (
        <div className="opacity-60">
          {card}
          <p className="mt-1 text-[11px] text-ink-muted">Produit retiré</p>
        </div>
      );
    }
    case "image":
      return (
        <a href={attachmentUrl} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={attachmentUrl}
            alt="Photo envoyée"
            loading="lazy"
            className="max-h-72 max-w-full rounded-lg object-contain"
          />
        </a>
      );
    case "file":
      return (
        <a
          href={attachmentUrl}
          target="_blank"
          rel="noreferrer"
          className="flex w-60 items-center gap-3 hover:opacity-90"
        >
          <DocumentTextIcon className="size-8 shrink-0 text-emerald" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">
              {message.meta?.file?.name ?? "Document"}
            </span>
            <span className="font-label text-[11px] text-ink-muted">
              PDF · {fileSize(message.meta?.file?.size ?? 0)}
            </span>
          </span>
        </a>
      );
    case "audio":
      return (
        <AudioMessage
          src={attachmentUrl}
          durationSec={message.meta?.audio?.durationSec ?? 0}
        />
      );
    default:
      return (
        <p className="text-sm break-words whitespace-pre-line">{message.body}</p>
      );
  }
}

/**
 * Fil de messages en bulles : les miens à droite (or), l'autre à gauche.
 * Séparateurs par jour, accusé « Vu » sous mon dernier message, indicateur
 * « en train d'écrire » en temps réel, défilement automatique en bas.
 */
export function MessageThread({
  messages,
  meId,
  conversationId,
  otherName,
  senderNames,
}: {
  messages: ThreadMessage[];
  meId: string;
  conversationId: string;
  /** Nom de l'interlocuteur, pour « … écrit ». */
  otherName?: string;
  /** Vue modération : nom de l'auteur au-dessus de chaque bulle. */
  senderNames?: Record<string, string>;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [typing, setTyping] = useState(false);

  useRealtime((event) => {
    if (event.type === "resync" || event.conversationId !== conversationId) {
      return;
    }
    if (event.type === "typing") {
      setTyping(true);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(false), 4000);
    } else if (event.type === "message") {
      clearTimeout(typingTimer.current);
      setTyping(false);
    }
  });

  useEffect(() => () => clearTimeout(typingTimer.current), []);

  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages.length, typing]);

  const lastMineIndex = messages.findLastIndex((m) => m.senderId === meId);

  return (
    <div
      ref={scroller}
      className="flex max-h-[60vh] min-h-64 flex-col gap-3 overflow-y-auto py-4 pr-1"
    >
      {messages.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-muted">
          Démarrez la conversation : présentez-vous et posez votre question.
        </p>
      ) : null}
      {messages.map((message, index) => {
        const mine = message.senderId === meId;
        const newDay =
          index === 0 ||
          dayKey(messages[index - 1].createdAt) !== dayKey(message.createdAt);
        const media = message.kind === "image" || message.kind === "product";
        return (
          <div key={message.id} className="flex flex-col gap-3">
            {newDay ? (
              <p className="self-center rounded-full bg-white/[0.04] px-3 py-1 font-label text-[11px] text-ink-muted">
                {dayLabel(message.createdAt)}
              </p>
            ) : null}
            <div className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
              {senderNames ? (
                <span className="mb-1 font-label text-[11px] text-ink-muted">
                  {senderNames[message.senderId] ?? "?"}
                </span>
              ) : null}
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl",
                  media ? "p-2" : "px-4 py-2.5",
                  mine
                    ? "rounded-br-sm bg-gold/15 text-ink"
                    : "rounded-bl-sm border border-white/[0.08] bg-white/[0.04]",
                )}
              >
                <MessageContent message={message} />
                <p
                  className={cn(
                    "mt-1 font-label text-[10px] text-ink-muted",
                    mine ? "text-right" : "",
                    media ? "px-1" : "",
                  )}
                >
                  {message.createdAt.toLocaleTimeString("fr-FR", {
                    timeZone: TIME_ZONE,
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              {index === lastMineIndex && !senderNames ? (
                <span className="mt-1 font-label text-[10px] text-ink-muted">
                  {message.readAt ? "Vu" : "Envoyé"}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
      {typing ? (
        <p className="animate-pulse text-xs text-ink-muted">
          {`${otherName ?? "Votre interlocuteur"} est en train d'écrire…`}
        </p>
      ) : null}
    </div>
  );
}
