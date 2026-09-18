"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DocumentTextIcon } from "@heroicons/react/24/outline";
import type { MessageMeta } from "@/db/schema";
import { AudioMessage } from "@/components/messaging/audio-message";
import {
  PurchaseOrderCard,
  type ThreadViewer,
} from "@/components/messaging/purchase-order-card";
import { useRealtime } from "@/components/realtime/realtime-provider";
import { formatFcfa } from "@/lib/format";
import type { PurchaseOrderView } from "@/lib/purchase-orders";
import { productPath } from "@/lib/product-url";
import { cn } from "@/lib/utils";

export type ThreadMessage = {
  id: string;
  senderId: string;
  kind:
    | "text"
    | "product"
    | "image"
    | "file"
    | "audio"
    | "quote_request"
    | "purchase_order";
  body: string;
  productId: string | null;
  purchaseOrderId: string | null;
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

type DealContext = {
  viewer: ThreadViewer;
  purchaseOrders: Record<string, PurchaseOrderView>;
  serviceFeePct: number;
  /** Fil vendeur : base des liens « Établir / modifier un bon de commande ». */
  sellerThreadPath?: string;
};

function MessageContent({
  message,
  deal,
}: {
  message: ThreadMessage;
  deal: DealContext;
}) {
  const attachmentUrl = `/api/messages/${message.id}/attachment`;
  switch (message.kind) {
    case "purchase_order": {
      const po = message.purchaseOrderId
        ? deal.purchaseOrders[message.purchaseOrderId]
        : undefined;
      if (!po) return <p className="text-sm text-ink-muted">Bon de commande</p>;
      return (
        <PurchaseOrderCard
          po={po}
          viewer={deal.viewer}
          serviceFeePct={deal.serviceFeePct}
          editHref={
            deal.sellerThreadPath
              ? `${deal.sellerThreadPath}?bon=modifier&id=${po.id}`
              : undefined
          }
        />
      );
    }
    case "quote_request": {
      const quote = message.meta?.quote;
      const product = message.meta?.product;
      return (
        <div className="flex w-72 max-w-full flex-col gap-2 text-sm">
          <p className="font-display font-bold">Demande de devis</p>
          {product ? (
            <p>
              {product.title}{" "}
              <span className="text-ink-muted">
                ({formatFcfa(product.priceFcfa)} au catalogue)
              </span>
            </p>
          ) : null}
          <p className="text-ink-muted">
            Quantité souhaitée :{" "}
            <span className="text-ink">{quote?.quantity ?? "-"}</span>
          </p>
          {quote?.note ? (
            <p className="whitespace-pre-line text-ink-muted">{quote.note}</p>
          ) : null}
          {deal.viewer === "seller" && deal.sellerThreadPath ? (
            <Link
              href={`${deal.sellerThreadPath}?bon=nouveau${message.productId ? `&produit=${message.productId}` : ""}&qte=${quote?.quantity ?? 1}`}
              className="font-label text-xs text-emerald hover:underline"
            >
              Établir un bon de commande ›
            </Link>
          ) : null}
        </div>
      );
    }
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
        <div className="flex flex-col gap-2">
          <Link
            href={productPath({ id: message.productId, title: product.title })}
            className="block hover:opacity-90"
          >
            {card}
          </Link>
          {deal.viewer === "seller" && deal.sellerThreadPath ? (
            <Link
              href={`${deal.sellerThreadPath}?bon=nouveau&produit=${message.productId}`}
              className="px-1 font-label text-xs text-emerald hover:underline"
            >
              Proposer un bon de commande ›
            </Link>
          ) : null}
        </div>
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
  viewer,
  purchaseOrders = {},
  serviceFeePct = 0,
  sellerThreadPath,
}: {
  messages: ThreadMessage[];
  meId: string;
  conversationId: string;
  viewer: ThreadViewer;
  /** Bons de commande référencés par les messages, à jour de leur état. */
  purchaseOrders?: Record<string, PurchaseOrderView>;
  serviceFeePct?: number;
  sellerThreadPath?: string;
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
  const deal: DealContext = { viewer, purchaseOrders, serviceFeePct, sellerThreadPath };

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
        const card =
          message.kind === "purchase_order" || message.kind === "quote_request";
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
                  media ? "p-2" : card ? "p-4" : "px-4 py-2.5",
                  mine
                    ? "rounded-br-sm bg-gold/15 text-ink"
                    : "rounded-bl-sm border border-white/[0.08] bg-white/[0.04]",
                )}
              >
                <MessageContent message={message} deal={deal} />
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
