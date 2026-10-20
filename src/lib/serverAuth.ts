import type { NextRequest } from "next/server";

// Server-only helpers for verifying the caller's Firebase ID token.
// Uses the Identity Toolkit REST API with the public web API key, so no service account is needed.

const TOKEN_CACHE_MS = 5 * 60 * 1000;
const tokenCache = new Map<string, { uid: string; email: string; emailVerified: boolean; expiresAt: number }>();

function bearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function verifyRequestUser(req: NextRequest): Promise<string | null> {
  const idToken = bearerToken(req);
  const account = idToken ? await verifyIdToken(idToken) : null;
  return account?.uid ?? null;
}

// The owner of the whole app (not just a group): the signed-in account whose verified email is
// OWNER_EMAIL on the server. Being listed in admins/{uid} is not enough.
export async function verifyRequestOwner(req: NextRequest): Promise<string | null> {
  const ownerEmail = (process.env.OWNER_EMAIL || "").trim().toLowerCase();
  if (!ownerEmail) return null;
  const idToken = bearerToken(req);
  const account = idToken ? await verifyIdToken(idToken) : null;
  if (!account || !account.emailVerified || account.email.toLowerCase() !== ownerEmail) return null;
  return account.uid;
}

async function verifyIdToken(idToken: string): Promise<{ uid: string; email: string; emailVerified: boolean } | null> {
  const now = Date.now();
  const cached = tokenCache.get(idToken);
  if (cached && cached.expiresAt > now) return cached;

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    console.error("NEXT_PUBLIC_FIREBASE_API_KEY is not set; cannot verify ID tokens.");
    return null;
  }

  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const account = data.users?.[0];
    const uid: string | undefined = account?.localId;
    if (!uid) return null;
    const result = {
      uid,
      email: typeof account.email === "string" ? account.email : "",
      emailVerified: account.emailVerified === true,
    };

    if (tokenCache.size > 1000) tokenCache.clear();
    tokenCache.set(idToken, { ...result, expiresAt: now + TOKEN_CACHE_MS });
    return result;
  } catch (err) {
    console.error("ID token verification failed:", err);
    return null;
  }
}

// Simple per-process fixed-window rate limiter keyed by uid
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  bucket.count += 1;
  return bucket.count > limit;
}

