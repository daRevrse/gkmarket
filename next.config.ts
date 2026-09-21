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
  // Le binaire onnxruntime est chargé dynamiquement : le traçage ne le voit
  // pas et la sortie standalone partirait sans lui (recherche par image HS).
  outputFileTracingIncludes: {
    "/**": ["./node_modules/onnxruntime-node/**"],
  },
};

export default nextConfig;
