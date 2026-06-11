"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getAdditionalUserInfo,
  RecaptchaVerifier,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  updatePassword,
  type ConfirmationResult,
  type User,
} from "firebase/auth";
import { FormError, FormField } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { auth } from "@/lib/firebase/client";
import { authErrorMessage } from "@/lib/firebase/errors";
import { normalizeTogoPhone, phoneAliasEmail } from "@/lib/phone";

export function PhoneResetForm() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [step, setStep] = useState<"phone" | "otp" | "password">("phone");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  const userRef = useRef<User | null>(null);

  async function handleSendCode(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const normalized = normalizeTogoPhone(phone);
    if (!normalized) {
      setError("Numéro invalide. Format attendu : 90 12 34 56 (Togo).");
      return;
    }

    setLoading(true);
    try {
      verifierRef.current ??= new RecaptchaVerifier(
        auth,
        "recaptcha-container-reset",
        { size: "invisible" },
      );
      confirmationRef.current = await signInWithPhoneNumber(
        auth,
        normalized,
        verifierRef.current,
      );
      setStep("otp");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const confirmation = confirmationRef.current;
      if (!confirmation) throw new Error("state");

      const credential = await confirmation.confirm(code);

      // La vérification OTP crée un compte si le numéro est inconnu :
      // on le supprime aussitôt pour ne pas laisser de compte orphelin.
      if (getAdditionalUserInfo(credential)?.isNewUser) {
        await credential.user.delete();
        setError("Aucun compte n'existe avec ce numéro.");
        setStep("phone");
        setCode("");
        return;
      }

      userRef.current = credential.user;
      setStep("password");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSetPassword(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    setLoading(true);
    try {
      const user = userRef.current;
      if (!user) throw new Error("state");

      // L'OTP vient d'être validé : la session est « récente », Firebase
      // autorise le changement de mot de passe sans re-authentification.
      await updatePassword(user, password);

      // Le changement de mot de passe révoque les jetons en cours :
      // on se reconnecte avec le nouveau mot de passe.
      const normalized = normalizeTogoPhone(phone);
      if (!normalized) throw new Error("state");
      const credential = await signInWithEmailAndPassword(
        auth,
        phoneAliasEmail(normalized),
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

  if (step === "password") {
    return (
      <form onSubmit={handleSetPassword} className="flex flex-col gap-4">
        <FormError message={error} />
        <p className="text-sm text-ink-muted">
          Numéro vérifié ✓ — choisissez votre nouveau mot de passe.
        </p>
        <FormField label="Nouveau mot de passe" htmlFor="newPassword">
          <Input
            id="newPassword"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="6 caractères minimum"
            autoComplete="new-password"
            minLength={6}
            required
          />
        </FormField>
        <FormField label="Confirmer le mot de passe" htmlFor="confirmPassword">
          <Input
            id="confirmPassword"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </FormField>
        <Button type="submit" disabled={loading}>
          {loading ? "Enregistrement…" : "Changer mon mot de passe"}
        </Button>
      </form>
    );
  }

  if (step === "otp") {
    return (
      <form onSubmit={handleVerifyCode} className="flex flex-col gap-4">
        <FormError message={error} />
        <p className="text-sm text-ink-muted">
          Un code à 6 chiffres a été envoyé par SMS à votre numéro.
        </p>
        <FormField label="Code de vérification" htmlFor="resetOtp">
          <Input
            id="resetOtp"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            maxLength={6}
            required
          />
        </FormField>
        <Button type="submit" disabled={loading}>
          {loading ? "Vérification…" : "Vérifier le code"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSendCode} className="flex flex-col gap-4">
      <FormError message={error} />
      <FormField label="Numéro de téléphone" htmlFor="resetPhone">
        <Input
          id="resetPhone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+228 90 12 34 56"
          autoComplete="tel"
          required
        />
      </FormField>
      <Button type="submit" disabled={loading}>
        {loading ? "Envoi du code…" : "Recevoir un code par SMS"}
      </Button>
      <div id="recaptcha-container-reset" />
    </form>
  );
}
