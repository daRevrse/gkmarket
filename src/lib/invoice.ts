import "server-only";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { orderItems, orders } from "@/db/schema";
import { formatFcfa } from "@/lib/format";

const GOLD = rgb(0.92, 0.7, 0.2);
const INK = rgb(0.1, 0.12, 0.16);
const MUTED = rgb(0.45, 0.48, 0.53);
const LINE = rgb(0.85, 0.86, 0.88);

type Order = typeof orders.$inferSelect;
type OrderItem = typeof orderItems.$inferSelect;

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

/**
 * Facture PDF d'une commande payée (MVP n°122, 124) — générée à la volée,
 * jamais stockée. Mise en page A4 simple : en-tête Deal Lomé, parties,
 * lignes, totaux, mentions.
 */
export async function generateInvoicePdf(input: {
  order: Order;
  items: OrderItem[];
  shopName: string;
  shopCity: string;
}): Promise<Uint8Array> {
  const { order, items, shopName, shopCity } = input;

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
  page.drawText("La marketplace B2B & B2C du Togo — deallome.com", {
    x: left,
    y: y - 16,
    size: 9,
    font,
    color: MUTED,
  });

  const invoiceTitle = `FACTURE ${order.number}`;
  page.drawText(invoiceTitle, {
    x: right - bold.widthOfTextAtSize(invoiceTitle, 14),
    y: y + 6,
    size: 14,
    font: bold,
    color: INK,
  });
  const dateText = pdfSafe(
    `Payée le ${(order.paidAt ?? order.createdAt).toLocaleDateString("fr-FR")}`,
  );
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
  page.drawText(truncate(shopName, 40), { x: left, y, size: 11, font: bold, color: INK });
  page.drawText(truncate(order.shippingName, 35), { x: 320, y, size: 11, font: bold, color: INK });
  y -= 13;
  page.drawText(pdfSafe(shopCity), { x: left, y, size: 10, font, color: MUTED });
  page.drawText(
    pdfSafe(
      [order.shippingCity, order.shippingDistrict].filter(Boolean).join(" · "),
    ),
    { x: 320, y, size: 10, font, color: MUTED },
  );
  y -= 13;
  page.drawText("Vendeur vérifié Deal Lomé", { x: left, y, size: 10, font, color: MUTED });
  page.drawText(pdfSafe(order.shippingPhone), { x: 320, y, size: 10, font, color: MUTED });

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

  for (const item of items) {
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
  const totals: Array<[string, string, boolean]> = [
    ["Sous-total", fcfa(order.subtotalFcfa), false],
    ["Frais de livraison", fcfa(order.deliveryFeeFcfa), false],
    ["Total payé", fcfa(order.totalFcfa), true],
  ];
  for (const [label, value, strong] of totals) {
    y -= 18;
    const f = strong ? bold : font;
    const size = strong ? 12 : 10;
    page.drawText(label, { x: 360, y, size, font: f, color: strong ? INK : MUTED });
    page.drawText(value, {
      x: right - f.widthOfTextAtSize(value, size),
      y,
      size,
      font: f,
      color: INK,
    });
  }

  if (order.status === "refunded") {
    y -= 24;
    page.drawText(
      "Commande remboursée intégralement après litige — cette facture est annulée.",
      { x: left, y, size: 10, font: bold, color: GOLD },
    );
  }

  // Mentions
  y = 90;
  page.drawLine({
    start: { x: left, y },
    end: { x: right, y },
    thickness: 1,
    color: LINE,
  });
  y -= 16;
  page.drawText(
    "TVA non applicable (MVP — régime fiscal à préciser).",
    { x: left, y, size: 9, font, color: MUTED },
  );
  y -= 12;
  page.drawText(
    "Paiement sécurisé Deal Lomé : fonds versés au vendeur après confirmation de réception.",
    { x: left, y, size: 9, font, color: MUTED },
  );

  return pdf.save();
}
