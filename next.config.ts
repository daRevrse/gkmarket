import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sortie autonome pour une image Docker minimale (.next/standalone).
  output: "standalone",
  // Un package-lock.json parasite existe dans le profil utilisateur ;
  // on fixe la racine pour que Next ne s'y trompe pas.
  turbopack: {
    root: path.join(__dirname),
  },
  // Modules natifs (libvips, onnxruntime) : jamais bundlés par Turbopack.
  serverExternalPackages: [
    "firebase-admin",
    "@huggingface/transformers",
    "onnxruntime-node",
  ],
  // Le runtime onnxruntime est chargé dynamiquement : le traçage n'en garde
  // qu'une partie (binaire absent, et seulement la variante ESM de
  // onnxruntime-common) et la recherche par image tombe en 500 à l'exécution.
  outputFileTracingIncludes: {
    "/**": [
      "./node_modules/onnxruntime-node/**",
      "./node_modules/onnxruntime-common/**",
      "./node_modules/@huggingface/transformers/**",
    ],
  },
};

export default nextConfig;
