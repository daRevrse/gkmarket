"use server";

import { sendEmail } from "@/lib/email";

const CONTACT_TO = process.env.CONTACT_EMAIL ?? "support@flowkraftagency.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendContactMessage(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<{ error?: string; ok?: boolean }> {
  const name = input.name.trim();
  const email = input.email.trim();
  const subject = input.subject.trim();
  const message = input.message.trim();

  if (!name || !email || !message) {
    return { error: "Nom, email et message sont requis." };
  }
  if (!EMAIL_RE.test(email)) {
    return { error: "Adresse email invalide." };
  }
  if (message.length > 4000) {
    return { error: "Message trop long (4000 caractères max)." };
  }

  await sendEmail({
    toEmail: CONTACT_TO,
    subject: `[Contact Deal Lomé] ${subject || "Sans objet"}`,
    bodyText: `Message reçu via le formulaire de contact.\n\nDe : ${name} <${email}>\nObjet : ${subject || "(aucun)"}\n\n${message}`,
    replyTo: { email, name },
  });

  return { ok: true };
}
