import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { SESSION_COOKIE } from "@/lib/auth";
import { adminAuth } from "@/lib/firebase/admin";
import { isPhoneAliasEmail } from "@/lib/phone";

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 5; // 5 jours

/**
 * Échange un ID token Firebase (obtenu côté client après connexion/inscription)
 * contre un cookie de session httpOnly, et synchronise l'utilisateur en base.
 */
export async function POST(request: NextRequest) {
  const { idToken, fullName } = (await request.json()) as {
    idToken?: string;
    fullName?: string;
  };
  if (!idToken) {
    return NextResponse.json({ error: "idToken manquant" }, { status: 400 });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });

    // L'identifiant interne dérivé du téléphone n'est pas un vrai email.
    const email = isPhoneAliasEmail(decoded.email) ? null : (decoded.email ?? null);

    await db
      .insert(users)
      .values({
        firebaseUid: decoded.uid,
        email,
        phone: decoded.phone_number ?? null,
        fullName: fullName ?? decoded.name ?? null,
      })
      .onConflictDoUpdate({
        target: users.firebaseUid,
        set: {
          email,
          phone: decoded.phone_number ?? null,
          ...(fullName ? { fullName } : {}),
          updatedAt: sql`now()`,
        },
      });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_MS / 1000,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Token invalide" }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
