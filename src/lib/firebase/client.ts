"use client";

import { getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";

// En mode émulateur (demo-*), la clé API n'est pas vérifiée.
const app =
  getApps()[0] ??
  initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });

export const auth = getAuth(app);

const emulatorHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
if (emulatorHost && !auth.emulatorConfig) {
  connectAuthEmulator(auth, `http://${emulatorHost}`, {
    disableWarnings: true,
  });
  // L'émulateur ne vérifie pas le reCAPTCHA — on le neutralise pour les tests.
  auth.settings.appVerificationDisabledForTesting = true;
}
