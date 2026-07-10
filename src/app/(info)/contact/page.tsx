"use client";

import { useState } from "react";
import { FormError, FormField } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendContactMessage } from "./actions";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const result = await sendContactMessage({ name, email, subject, message });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSent(true);
  }

  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">Nous contacter</h1>
      <p className="mt-2 text-ink-muted">
        Une question, un problème sur une commande ? Écrivez-nous, nous
        répondons sous 48 h ouvrées.
      </p>

      {sent ? (
        <div className="mt-8 rounded-xl border border-emerald/40 bg-emerald/10 px-5 py-6">
          <p className="font-display text-lg font-bold text-emerald-light">
            Message envoyé ✓
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Merci, {name.split(" ")[0] || "à vous"}. Nous vous répondrons par
            email dès que possible.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <FormError message={error} />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Nom complet" htmlFor="name">
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Kossi Mensah"
                autoComplete="name"
                required
              />
            </FormField>
            <FormField label="Email" htmlFor="email">
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                autoComplete="email"
                required
              />
            </FormField>
          </div>
          <FormField label="Objet" htmlFor="subject">
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Objet de votre message"
            />
          </FormField>
          <FormField label="Message" htmlFor="message">
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              maxLength={4000}
              required
              className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted/60 focus:border-emerald focus:outline-none"
              placeholder="Décrivez votre demande…"
            />
          </FormField>
          <Button type="submit" loading={loading} className="self-start">
            {loading ? "Envoi…" : "Envoyer le message"}
          </Button>
        </form>
      )}
    </>
  );
}
