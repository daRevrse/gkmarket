import { NextResponse } from "next/server";
import { autoReleaseOverdueEscrows } from "@/lib/escrow";

/**
 * Déblocage automatique de l'Escrow (MVP n°119), à appeler périodiquement.
 * En production : Vercel Cron (vercel.json) - la requête porte
 * `Authorization: Bearer ${CRON_SECRET}`. Sans CRON_SECRET configuré
 * (développement local), la route reste ouverte.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authorization = request.headers.get("authorization");
    if (authorization !== `Bearer ${secret}`) {
      return new NextResponse(null, { status: 401 });
    }
  }

  const released = await autoReleaseOverdueEscrows();
  return NextResponse.json({ released });
}
