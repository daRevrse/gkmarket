import "server-only";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type {
  orderItems,
  orders,
  purchaseOrderItems,
  purchaseOrders,
} from "@/db/schema";
import { formatFcfa } from "@/lib/format";

const GOLD = rgb(0.92, 0.7, 0.2);
const INK = rgb(0.1, 0.12, 0.16);
const MUTED = rgb(0.45, 0.48, 0.53);
const LINE = rgb(0.85, 0.86, 0.88);

type Order = typeof orders.$inferSelect;
type OrderItem = typeof orderItems.$inferSelect;
type PurchaseOrder = typeof purchaseOrders.$inferSelect;
type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;

function truncate(text: string, max: number) {
  const safe = pdfSafe(text);
  return safe.length > max ? `${safe.slice(0, max - 1)}…` : safe;
}

/** Montant prêt pour le PDF (espaces insécables remplacées). */
function fcfa(amount: number) {
  return pdfSafe(formatFcfa(amount));
}

/**
 * Les polices PDF standard encodent en WinAnsi (CP1252) : on remplace les
 * espaces insécables de toLocaleString('fr-FR') (U+202F/U+00A0) et tout
 * caractère hors plage (emoji…) pour ne jamais faire échouer la génération.
 */
function pdfSafe(text: string) {
  return text
    .replace(/[  ]/g, " ")
    .replace(/[^\x20-\x7E\xA1-\xFF–—‘’“”€…]/g, "?");
}

/** Document commercial générique (facture, bon de commande). */
type CommercialDocument = {
  title: string;
  dateLine: string;
  seller: { name: string; lines: string[] };
  buyer: { name: string; lines: string[] };
  items: {
    title: string;
    quantity: number;
    unitPriceFcfa: number;
    totalFcfa: number;
  }[];
  totals: Array<[label: string, amountFcfa: number, strong: boolean]>;
  /** Avertissement en évidence sous les totaux (ex. facture annulée). */
  highlight?: string;
  /** Mentions de pied de page. */
  footer: string[];
};

/**
 * Mise en page A4 commune : en-tête Deal Lomé, parties, lignes, totaux,
 * mentions. Génération à la volée, jamais stockée.
 */
async function renderCommercialPdf(doc: CommercialDocument): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4 en points
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const left = 50;
  const right = 545;
  let y = 780;

  // En-tête
  page.drawText("Deal", { x: left, y, size: 26, font: bold, color: INK });
  page.drawText("Lomé", {
    x: left + bold.widthOfTextAtSize("Deal ", 26),
    y,
    size: 26,
    font: bold,
    color: GOLD,
  });
  page.drawText("La marketplace B2B & B2C du Togo - deallome.com", {
    x: left,
    y: y - 16,
    size: 9,
    font,
    color: MUTED,
  });

  const title = pdfSafe(doc.title);
  page.drawText(title, {
    x: right - bold.widthOfTextAtSize(title, 14),
    y: y + 6,
    size: 14,
    font: bold,
    color: INK,
  });
  const dateText = pdfSafe(doc.dateLine);
  page.drawText(dateText, {
    x: right - font.widthOfTextAtSize(dateText, 10),
    y: y - 10,
    size: 10,
    font,
    color: MUTED,
  });

  y -= 60;
  page.drawLine({
    start: { x: left, y },
    end: { x: right, y },
    thickness: 1,
    color: LINE,
  });

  // Parties
  y -= 24;
  page.drawText("VENDEUR", { x: left, y, size: 9, font: bold, color: MUTED });
  page.drawText("ACHETEUR", { x: 320, y, size: 9, font: bold, color: MUTED });
  y -= 14;
  page.drawText(truncate(doc.seller.name, 40), { x: left, y, size: 11, font: bold, color: INK });
  page.drawText(truncate(doc.buyer.name, 35), { x: 320, y, size: 11, font: bold, color: INK });
  const partyLines = Math.max(doc.seller.lines.length, doc.buyer.lines.length);
  for (let index = 0; index < partyLines; index++) {
    y -= 13;
    const sellerLine = doc.seller.lines[index];
    const buyerLine = doc.buyer.lines[index];
    if (sellerLine) {
      page.drawText(truncate(sellerLine, 45), { x: left, y, size: 10, font, color: MUTED });
    }
    if (buyerLine) {
      page.drawText(truncate(buyerLine, 40), { x: 320, y, size: 10, font, color: MUTED });
    }
  }

  // Tableau des lignes
  y -= 36;
  page.drawText("ARTICLE", { x: left, y, size: 9, font: bold, color: MUTED });
  page.drawText("QTÉ", { x: 360, y, size: 9, font: bold, color: MUTED });
  page.drawText("PRIX UNITAIRE", { x: 400, y, size: 9, font: bold, color: MUTED });
  const totalHeader = "TOTAL";
  page.drawText(totalHeader, {
    x: right - bold.widthOfTextAtSize(totalHeader, 9),
    y,
    size: 9,
    font: bold,
    color: MUTED,
  });
  y -= 8;
  page.drawLine({
    start: { x: left, y },
    end: { x: right, y },
    thickness: 1,
    color: LINE,
  });

  for (const item of doc.items) {
    y -= 20;
    page.drawText(truncate(item.title, 48), { x: left, y, size: 10, font, color: INK });
    page.drawText(String(item.quantity), { x: 360, y, size: 10, font, color: INK });
    page.drawText(fcfa(item.unitPriceFcfa), { x: 400, y, size: 10, font, color: INK });
    const lineTotal = fcfa(item.totalFcfa);
    page.drawText(lineTotal, {
      x: right - font.widthOfTextAtSize(lineTotal, 10),
      y,
      size: 10,
      font,
      color: INK,
    });
  }

  y -= 12;
  page.drawLine({
    start: { x: left, y },
    end: { x: right, y },
    thickness: 1,
    color: LINE,
  });

  // Totaux
  for (const [label, amount, strong] of doc.totals) {
    y -= 18;
    const f = strong ? bold : font;
    const size = strong ? 12 : 10;
    const value = fcfa(amount);
    page.drawText(pdfSafe(label), { x: 360, y, size, font: f, color: strong ? INK : MUTED });
    page.drawText(value, {
      x: right - f.widthOfTextAtSize(value, size),
      y,
      size,
      font: f,
      color: INK,
    });
  }

  if (doc.highlight) {
    y -= 24;
    page.drawText(pdfSafe(doc.highlight), { x: left, y, size: 10, font: bold, color: GOLD });
  }

  // Mentions
  y = 90;
  page.drawLine({
    start: { x: left, y },
    end: { x: right, y },
    thickness: 1,
    color: LINE,
  });
  for (const line of doc.footer) {
    y -= y === 90 ? 16 : 12;
    page.drawText(pdfSafe(line), { x: left, y, size: 9, font, color: MUTED });
  }

  return pdf.save();
}

/** Facture PDF d'une commande payée (MVP n°122, 124). */
export async function generateInvoicePdf(input: {
  order: Order;
  items: OrderItem[];
  shopName: string;
  shopCity: string;
  /** Exemplaire vendeur : sans le téléphone de l'acheteur (anti-contournement). */
  hideBuyerPhone?: boolean;
}): Promise<Uint8Array> {
  const { order, items, shopName, shopCity, hideBuyerPhone } = input;
  return renderCommercialPdf({
    title: `FACTURE ${order.number}`,
    dateLine: `Payée le ${(order.paidAt ?? order.createdAt).toLocaleDateString("fr-FR")}`,
    seller: { name: shopName, lines: [shopCity, "Vendeur vérifié Deal Lomé"] },
    buyer: {
      name: order.shippingName,
      lines: [
        [order.shippingCity, order.shippingDistrict].filter(Boolean).join(" · "),
        ...(hideBuyerPhone ? [] : [order.shippingPhone]),
      ],
    },
    items,
    totals: [
      ["Sous-total", order.subtotalFcfa, false],
      ["Frais de livraison", order.deliveryFeeFcfa, false],
      ...(order.serviceFeeFcfa > 0
        ? [["Frais de service", order.serviceFeeFcfa, false] as [string, number, boolean]]
        : []),
      ["Total payé", order.totalFcfa, true],
    ],
    highlight:
      order.status === "refunded"
        ? order.serviceFeeFcfa > 0
          ? "Commande remboursée après litige (hors frais de service) - cette facture est annulée."
          : "Commande remboursée intégralement après litige - cette facture est annulée."
        : undefined,
    footer: [
      "TVA non applicable (MVP - régime fiscal à préciser).",
      "Paiement sécurisé Deal Lomé : fonds versés au vendeur après confirmation de réception.",
    ],
  });
}

/**
 * Bon de commande PDF (docs/CHANGEMENTS.md §5, lot 3) : proposition du
 * vendeur à prix négociés, à présenter avant acceptation (proforma).
 */
export async function generatePurchaseOrderPdf(input: {
  purchaseOrder: PurchaseOrder;
  items: PurchaseOrderItem[];
  shopName: string;
  shopCity: string;
  buyerName: string;
  serviceFeeFcfa: number;
  stateLabel: string;
}): Promise<Uint8Array> {
  const { purchaseOrder: po, items, serviceFeeFcfa } = input;
  const until = po.expiresAt.toLocaleString("fr-FR", {
    timeZone: "Africa/Lome",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return renderCommercialPdf({
    title: `BON DE COMMANDE ${po.number}`,
    dateLine: `Émis le ${po.createdAt.toLocaleDateString("fr-FR")} - ${input.stateLabel}`,
    seller: { name: input.shopName, lines: [input.shopCity, "Vendeur vérifié Deal Lomé"] },
    buyer: { name: input.buyerName, lines: ["Client Deal Lomé"] },
    items,
    totals: [
      ["Articles", po.subtotalFcfa, false],
      ["Frais de livraison", po.deliveryFeeFcfa, false],
      ...(serviceFeeFcfa > 0
        ? [["Frais de service", serviceFeeFcfa, false] as [string, number, boolean]]
        : []),
      ["Total à payer", po.subtotalFcfa + po.deliveryFeeFcfa + serviceFeeFcfa, true],
    ],
    highlight: po.note ? `Note du vendeur : ${po.note.replace(/\s+/g, " ").slice(0, 110)}` : undefined,
    footer: [
      `Prix valables jusqu'au ${until} (heure de Lomé). Ce document n'est pas une facture.`,
      "À accepter et payer sur deallome.com : fonds versés au vendeur après confirmation de réception.",
      "Frais de service non remboursables.",
    ],
  });
}
