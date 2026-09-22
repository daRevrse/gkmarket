import "server-only";

import sharp from "sharp";

// Filigrane des médias téléchargés (docs/CHANGEMENTS.md §5, lot 6) : le
// téléchargement est réservé aux comptes connectés et l'image repart marquée
// « Deal Lomé ». Les photos affichées sur le site restent, elles, non
// marquées — le filigrane porte sur le fichier téléchargé.

/** Largeur maximale du fichier produit (les photos vendeur font ~1 à 3 Mpx). */
const MAX_WIDTH = 2000;

const MARK = "Deal Lomé";
const DOMAIN = "deallome.com";

/**
 * Police du conteneur (Dockerfile : fonts-dejavu-core). Sans police
 * installée, librsvg rend des carrés vides à la place du texte — c'est
 * arrivé en production au premier déploiement.
 */
const FONT = "DejaVu Sans, Helvetica, Arial, sans-serif";

/**
 * Calque SVG : une trame diagonale discrète sur toute l'image plus la
 * marque au centre. Les couleurs sont choisies pour rester lisibles aussi
 * bien sur une photo claire (packshot sur fond blanc) que sur une photo
 * sombre : texte clair doublé d'un contour foncé.
 */
function overlaySvg(width: number, height: number) {
  const base = Math.min(width, height);
  const tile = Math.max(140, Math.round(base / 3));
  const tileFont = Math.round(tile / 7);

  const markSize = Math.round(base / 8);
  const domainSize = Math.round(base / 24);
  const stroke = Math.max(1, Math.round(markSize / 16));
  const middle = Math.round(height / 2);

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <pattern id="trame" width="${tile}" height="${tile}" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
      <text x="0" y="${Math.round(tile / 2)}" font-family="${FONT}"
            font-size="${tileFont}" font-weight="bold"
            fill="#9aa4b0" fill-opacity="0.3">${MARK}</text>
    </pattern>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#trame)"/>
  <g font-family="${FONT}" text-anchor="middle" paint-order="stroke"
     stroke="#0b1727" stroke-opacity="0.45" stroke-linejoin="round">
    <text x="${Math.round(width / 2)}" y="${middle}" font-size="${markSize}"
          font-weight="bold" stroke-width="${stroke}"
          fill="#ffffff" fill-opacity="0.72">${MARK}</text>
    <text x="${Math.round(width / 2)}" y="${middle + Math.round(markSize * 0.85)}"
          font-size="${domainSize}" font-weight="bold"
          stroke-width="${Math.max(1, Math.round(stroke / 2))}"
          fill="#e0b64a" fill-opacity="0.95">${DOMAIN}</text>
  </g>
</svg>`,
  );
}

/**
 * Applique le filigrane à une image et renvoie un JPEG prêt au
 * téléchargement.
 */
export async function watermarkImage(input: Buffer): Promise<Buffer> {
  const image = sharp(input, { failOn: "none" }).rotate();
  const meta = await image.metadata();
  const resized =
    meta.width && meta.width > MAX_WIDTH ? image.resize({ width: MAX_WIDTH }) : image;

  // Dimensions après rotation EXIF et redimensionnement éventuel.
  const flat = await resized.jpeg({ quality: 90 }).toBuffer({ resolveWithObject: true });
  const { width, height } = flat.info;

  return sharp(flat.data)
    .composite([{ input: overlaySvg(width, height), top: 0, left: 0 }])
    .jpeg({ quality: 88 })
    .toBuffer();
}
