import { NextResponse } from "next/server";

type VerificationCode = { code: string; phoneNumber: string };

/**
 * Aide au développement : expose le dernier code OTP généré par l'émulateur
 * Firebase (qui n'envoie jamais de vrai SMS). Renvoie 404 hors émulateur -
 * cette route n'existe donc pas en production.
 */
export async function GET(request: Request) {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (!host) return new NextResponse(null, { status: 404 });

  const phone = new URL(request.url).searchParams.get("phone");
  const response = await fetch(
    `http://${host}/emulator/v1/projects/${process.env.FIREBASE_PROJECT_ID}/verificationCodes`,
    { cache: "no-store" },
  );
  if (!response.ok) return NextResponse.json({ code: null });

  const data = (await response.json()) as {
    verificationCodes?: VerificationCode[];
  };
  const matching = (data.verificationCodes ?? []).filter(
    (entry) => !phone || entry.phoneNumber === phone,
  );
  return NextResponse.json({
    code: matching.length ? matching[matching.length - 1].code : null,
  });
}
