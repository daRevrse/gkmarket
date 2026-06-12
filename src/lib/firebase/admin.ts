import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getStorage, type Storage } from "firebase-admin/storage";

// Deux modes :
// - Émulateur local : FIREBASE_AUTH_EMULATOR_HOST est défini, aucune clé requise.
// - Production : FIREBASE_SERVICE_ACCOUNT contient le JSON du compte de service.
function getAdminApp() {
  const existing = getApps()[0];
  if (existing) return existing;

  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    return initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
  }

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccount) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT manquant (ou FIREBASE_AUTH_EMULATOR_HOST pour le développement local).",
    );
  }
  return initializeApp({
    credential: cert(JSON.parse(serviceAccount)),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

// Initialisation paresseuse : `next build` importe les modules serveur sans
// les exécuter (« Collecting page data ») — exiger les clés à ce moment-là
// ferait échouer tout build sans environnement (CI, Vercel). L'app n'est
// donc créée qu'au premier accès réel, à l'exécution.
let app: App | undefined;

function lazy<T extends object>(factory: (app: App) => T): T {
  let instance: T | undefined;
  return new Proxy({} as T, {
    get(_, prop) {
      instance ??= factory((app ??= getAdminApp()));
      const value = instance[prop as keyof T];
      return typeof value === "function" ? value.bind(instance) : value;
    },
  });
}

export const adminAuth: Auth = lazy((app) => getAuth(app));
export const adminStorage: Storage = lazy((app) => getStorage(app));
