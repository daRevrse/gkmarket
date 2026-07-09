import "server-only";

import { db } from "@/db";
import { emailOutbox } from "@/db/schema";

const FROM_NAME = "Deal Lomé";
const FROM_EMAIL = process.env.EMAIL_FROM ?? "no-reply@deallome.com";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://deallome.com";

// Palette de marque (cf. globals.css) - valeurs en dur car un email HTML ne
// voit pas les variables CSS de l'application.
const NAVY = "#0d1b2a";
const NAVY_DEEP = "#08121c";
const GOLD = "#f5a623";
const INK_MUTED = "#8899aa";

/**
 * Email transactionnel (MVP n°221) via Brevo (plan gratuit 300/jour).
 * Sans BREVO_API_KEY (développement local), l'email n'est pas envoyé mais
 * journalisé dans email_outbox avec le statut « simulated » - même
 * philosophie que les SMS et le Mobile Money simulés.
 * Ne lève jamais : un échec d'email ne doit pas casser l'action métier.
 */
export async function sendEmail(input: {
  toEmail: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
}): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;

  let status = "simulated";
  let error: string | null = null;

  if (apiKey) {
    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: { name: FROM_NAME, email: FROM_EMAIL },
          to: [{ email: input.toEmail }],
          subject: input.subject,
          textContent: input.bodyText,
          ...(input.bodyHtml ? { htmlContent: input.bodyHtml } : {}),
        }),
      });
      if (response.ok) {
        status = "sent";
      } else {
        status = "failed";
        error = `Brevo HTTP ${response.status}`;
      }
    } catch (cause) {
      status = "failed";
      error = cause instanceof Error ? cause.message : "réseau";
    }
  }

  try {
    await db.insert(emailOutbox).values({
      toEmail: input.toEmail,
      subject: input.subject,
      bodyText: input.bodyText,
      status,
      error,
    });
  } catch {
    // Journal indisponible : tant pis, ne pas casser l'action appelante.
  }
}

/** Échappe le HTML : titres et corps contiennent des données utilisateur
 * (noms de boutiques, motifs de litige, n° de commande). */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Gabarit d'email transactionnel de marque : construit le texte brut (repli
 * pour les clients sans HTML) et une version HTML compatible messageries
 * (tables + styles en ligne). À partir du même trio titre / corps / lien que
 * les notifications in-app, pour une communication cohérente « à tous les
 * niveaux ».
 */
export function renderTransactionalEmail(input: {
  title: string;
  body?: string;
  link?: string;
}): { text: string; html: string } {
  const { title, body, link } = input;
  const url = link ? `${SITE_URL}${link}` : null;

  const text = [
    title,
    "",
    body ?? "",
    url ? `\nDétails : ${url}` : "",
    "\n- L'équipe Deal Lomé",
  ].join("\n");

  const bodyHtml = body
    ? escapeHtml(body).replace(/\n/g, "<br>")
    : "";

  const cta = url
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 4px;">
            <tr><td style="border-radius:8px;background:${GOLD};">
              <a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:${NAVY_DEEP};text-decoration:none;border-radius:8px;">Voir les détails</a>
            </td></tr>
          </table>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5f7;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(title)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f5f7;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="480" cellspacing="0" cellpadding="0" border="0" style="width:480px;max-width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e6e8ec;">
        <tr><td style="background:${NAVY};padding:22px 32px;">
          <span style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Deal <span style="color:${GOLD};">Lomé</span></span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:19px;line-height:1.35;font-weight:700;color:${NAVY};">${escapeHtml(title)}</h1>
          ${bodyHtml ? `<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#3a4756;">${bodyHtml}</p>` : ""}
          ${cta}
        </td></tr>
        <tr><td style="padding:20px 32px 28px;border-top:1px solid #eef0f3;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:${INK_MUTED};">
            Vous recevez cet email car vous avez un compte sur <a href="${SITE_URL}" style="color:${INK_MUTED};">deallome.com</a>.<br>
            © 2026 Deal Lomé · GK NÉGOCES - Lomé, Togo
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { text, html };
}
