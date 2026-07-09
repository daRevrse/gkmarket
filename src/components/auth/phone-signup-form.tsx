"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  EmailAuthProvider,
  linkWithCredential,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  updateProfile,
  type ConfirmationResult,
} from "firebase/auth";
import { FormError, FormField } from "@/components/auth/auth-card";
import { DevOtpHint } from "@/components/auth/dev-otp-hint";
import { ResendCode } from "@/components/auth/resend-code";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { auth } from "@/lib/firebase/client";
import { authErrorMessage } from "@/lib/firebase/errors";
import { nextFromLocation } from "@/lib/next-path";
import { normalizeTogoPhone, phoneAliasEmail } from "@/lib/phone";

export function PhoneSignupForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"form" | "otp">("form");
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);

  async function handleSendCode(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const normalized = normalizeTogoPhone(phone);
    if (!normalized) {
      setError("Numéro invalide. Format attendu : 90 12 34 56 (Togo).");
      return;
    }
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
      verifierRef.current ??= new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        { size: "invisible" },
      );
      confirmationRef.current = await signInWithPhoneNumber(
        auth,
        normalized,
        verifierRef.current,
      );
      setVerifiedPhone(normalized);
      setStep("otp");
    } catch (err) {
      setError(authErrorMessage(err));
      // Doc Firebase : après un échec d'envoi, le reCAPTCHA doit être
      // réinitialisé - un jeton consommé ferait échouer la tentative suivante.
      verifierRef.current?.clear();
      verifierRef.current = null;
    } finally {
      setLoading(false);
    }
  }

  // Renvoie un nouveau code au même numéro (le jeton reCAPTCHA précédent est
  // consommé : on repart d'un verifier neuf). Lève en cas d'échec pour que
  // ResendCode réarme son délai.
  async function resendCode() {
    setError(null);
    if (!verifiedPhone) throw new Error("state");
    try {
      // L'ancien verifier vivait dans l'étape précédente (démontée) :
      // son nettoyage peut échouer sans conséquence.
      try {
        verifierRef.current?.clear();
      } catch {}
      verifierRef.current = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
      });
      confirmationRef.current = await signInWithPhoneNumber(
        auth,
        verifiedPhone,
        verifierRef.current,
      );
      setCode("");
    } catch (err) {
      setError(authErrorMessage(err));
      verifierRef.current?.clear();
      verifierRef.current = null;
      throw err;
    }
  }

  async function handleVerifyCode(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const confirmation = confirmationRef.current;
      if (!confirmation || !verifiedPhone) throw new Error("state");

      const credential = await confirmation.confirm(code);

      // Le numéro est vérifié - on attache l'identifiant mot de passe
      // (connexion future : téléphone + mot de passe, sans SMS).
      await linkWithCredential(
        credential.user,
        EmailAuthProvider.credential(phoneAliasEmail(verifiedPhone), password),
      );
      await updateProfile(credential.user, { displayName: fullName });
      const idToken = await credential.user.getIdToken(true);

      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, fullName }),
      });
      if (!response.ok) throw new Error("session");

      router.push(nextFromLocation());
      router.refresh();
    } catch (err) {
      setError(authErrorMessage(err));
      setLoading(false);
    }
  }

  if (step === "otp") {
    return (
      <form onSubmit={handleVerifyCode} className="flex flex-col gap-4">
        <FormError message={error} />
        <p className="text-sm text-ink-muted">
          Un code à 6 chiffres a été envoyé par SMS au{" "}
          <span className="text-ink">{verifiedPhone}</span>.
        </p>
        <DevOtpHint phone={verifiedPhone} />
        <FormField label="Code de vérification" htmlFor="otp">
          <Input
            id="otp"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            maxLength={6}
            required
          />
        </FormField>
        <Button type="submit" loading={loading}>
          {loading ? "Vérification…" : "Vérifier et créer mon compte"}
        </Button>
        <ResendCode onResend={resendCode} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setStep("form");
            setCode("");
            setError(null);
          }}
        >
          Modifier mes informations
        </Button>
        <div id="recaptcha-container" />
      </form>
    );
  }

  return (
    <form onSubmit={handleSendCode} className="flex flex-col gap-4">
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
      <FormField label="Numéro de téléphone" htmlFor="phone">
        <Input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+228 90 12 34 56"
          autoComplete="tel"
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
      <Button type="submit" loading={loading} className="mt-2">
        {loading ? "Envoi du code…" : "Recevoir le code par SMS"}
      </Button>
      <div id="recaptcha-container" />
    </form>
  );
}
