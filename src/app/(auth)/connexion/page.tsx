"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { AuthCard, FormError, FormField } from "@/components/auth/auth-card";
import { AuthTabs, type AuthMethod } from "@/components/auth/auth-tabs";
import { PhoneLoginForm } from "@/components/auth/phone-login-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { auth } from "@/lib/firebase/client";
import { authErrorMessage } from "@/lib/firebase/errors";

export default function ConnexionPage() {
  const router = useRouter();
  const [method, setMethod] = useState<AuthMethod>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const idToken = await credential.user.getIdToken();

      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!response.ok) throw new Error("session");

      router.push("/compte");
      router.refresh();
    } catch (err) {
      setError(authErrorMessage(err));
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Se connecter"
      subtitle="Heureux de vous revoir sur GK Market."
    >
      <AuthTabs value={method} onChange={setMethod} />
      {method === "phone" ? (
        <PhoneLoginForm />
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
        <FormField label="Mot de passe" htmlFor="password">
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </FormField>
        <div className="text-right">
          <Link
            href="/mot-de-passe-oublie"
            className="text-sm text-ink-muted hover:text-emerald"
          >
            Mot de passe oublié ?
          </Link>
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? "Connexion…" : "Se connecter"}
        </Button>
      </form>
      )}
      <p className="mt-6 text-center text-sm text-ink-muted">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="text-emerald hover:underline">
          Créer un compte
        </Link>
      </p>
    </AuthCard>
  );
}
