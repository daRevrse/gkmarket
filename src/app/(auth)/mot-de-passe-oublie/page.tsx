"use client";

import { useState } from "react";
import Link from "next/link";
import { sendPasswordResetEmail } from "firebase/auth";
import { AuthCard, FormError, FormField } from "@/components/auth/auth-card";
import { AuthTabs, type AuthMethod } from "@/components/auth/auth-tabs";
import { PhoneResetForm } from "@/components/auth/phone-reset-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { auth } from "@/lib/firebase/client";
import { authErrorMessage } from "@/lib/firebase/errors";

export default function MotDePasseOubliePage() {
  const [method, setMethod] = useState<AuthMethod>("email");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSent(true);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Mot de passe oublié"
      subtitle="Réinitialisez votre mot de passe par email ou par SMS."
    >
      <AuthTabs value={method} onChange={setMethod} />
      {method === "phone" ? (
        <PhoneResetForm />
      ) : sent ? (
        <p className="rounded-md border border-emerald/40 bg-emerald/10 px-4 py-3 text-sm text-emerald-light">
          Si un compte existe avec cet email, un lien de réinitialisation
          vient de lui être envoyé. Pensez à vérifier vos spams.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormError message={error} />
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
          <Button type="submit" disabled={loading}>
            {loading ? "Envoi…" : "Envoyer le lien"}
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-ink-muted">
        <Link href="/connexion" className="text-emerald hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </AuthCard>
  );
}
