import "server-only";

import { db } from "@/db";
import { emailOutbox } from "@/db/schema";

const FROM_NAME = "Deal Lomé";
const FROM_EMAIL = process.env.EMAIL_FROM ?? "no-reply@deallome.com";

/**
 * Email transactionnel (MVP n°221) via Brevo (plan gratuit 300/jour).
 * Sans BREVO_API_KEY (développement local), l'email n'est pas envoyé mais
 * journalisé dans email_outbox avec le statut « simulated » — même
 * philosophie que les SMS et le Mobile Money simulés.
 * Ne lève jamais : un échec d'email ne doit pas casser l'action métier.
 */
export async function sendEmail(input: {
  toEmail: string;
  subject: string;
  bodyText: string;
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
