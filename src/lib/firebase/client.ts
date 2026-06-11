"use client";

import { getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectStorageEmulator, getStorage } from "firebase/storage";

// En mode émulateur (demo-*), la clé API n'est pas vérifiée.
const app =
  getApps()[0] ??
  initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });

export const auth = getAuth(app);
export const storage = getStorage(app);

const emulatorHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
if (emulatorHost && !auth.emulatorConfig) {
  connectAuthEmulator(auth, `http://${emulatorHost}`, {
    disableWarnings: true,
  });
  // L'émulateur ne vérifie pas le reCAPTCHA — on le neutralise pour les tests.
  auth.settings.appVerificationDisabledForTesting = true;
}

const storageEmulatorHost =
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST;
if (storageEmulatorHost) {
  const [host, port] = storageEmulatorHost.split(":");
  connectStorageEmulator(storage, host, Number(port));
}
