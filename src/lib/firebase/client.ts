"use client";

import { getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import {
  connectStorageEmulator,
  getStorage,
  type FirebaseStorage,
} from "firebase/storage";

function createFirebase() {
  // En mode émulateur (demo-*), la clé API n'est pas vérifiée.
  const app =
    getApps()[0] ??
    initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });

  const auth = getAuth(app);
  const storage = getStorage(app);

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

  return { auth, storage };
}

// Le prérendu (`next build`) importe ce module sans jamais utiliser Firebase :
// tous les usages sont dans des handlers ou des useEffect, exécutés dans le
// navigateur. On n'initialise donc que côté client — un build sans variables
// d'environnement (CI) reste possible.
export const { auth, storage } =
  typeof window === "undefined"
    ? ({ auth: null, storage: null } as unknown as {
        auth: Auth;
        storage: FirebaseStorage;
      })
    : createFirebase();
