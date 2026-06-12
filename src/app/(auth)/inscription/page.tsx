"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
} from "firebase/auth";
import { AuthCard, FormError, FormField } from "@/components/auth/auth-card";
import { AuthTabs, type AuthMethod } from "@/components/auth/auth-tabs";
import { GoogleButton } from "@/components/auth/google-button";
import { PhoneSignupForm } from "@/components/auth/phone-signup-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { auth } from "@/lib/firebase/client";
import { authErrorMessage } from "@/lib/firebase/errors";

export default function InscriptionPage() {
  const router = useRouter();
  const [method, setMethod] = useState<AuthMethod>("email");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      await updateProfile(credential.user, { displayName: fullName });
      // Vérification email (MVP n°6) — politique douce : le lien est envoyé,
      // sans bloquer l'usage du compte. Échec non bloquant.
      sendEmailVerification(credential.user).catch(() => undefined);
      const idToken = await credential.user.getIdToken();

      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, fullName }),
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
      title="Créer un compte"
      subtitle="Rejoignez la marketplace B2B & B2C du Togo."
    >
      <div className="mb-4">
        <GoogleButton label="S'inscrire avec Google" />
      </div>
      <AuthTabs value={method} onChange={setMethod} />
      {method === "phone" ? (
        <PhoneSignupForm />
      ) : (
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormError message={error} />
        <FormField label="Nom complet" htmlFor="fullName">
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
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
        <FormField label="Mot de passe" htmlFor="password">
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="6 caractères minimum"
            autoComplete="new-password"
            minLength={6}
            required
          />
        </FormField>
        <FormField label="Confirmer le mot de passe" htmlFor="confirm">
          <Input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </FormField>
        <Button type="submit" disabled={loading} className="mt-2">
          {loading ? "Création du compte…" : "Créer mon compte"}
        </Button>
      </form>
      )}
      <p className="mt-6 text-center text-sm text-ink-muted">
        Déjà un compte ?{" "}
        <Link href="/connexion" className="text-emerald hover:underline">
          Se connecter
        </Link>
      </p>
    </AuthCard>
  );
}
