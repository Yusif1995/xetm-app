import type { NextRequest } from "next/server";

// Server-only helpers for verifying the caller's Firebase ID token.
// Uses the Identity Toolkit REST API with the public web API key, so no service account is needed.

const TOKEN_CACHE_MS = 5 * 60 * 1000;
const tokenCache = new Map<string, { uid: string; expiresAt: number }>();

export async function verifyRequestUser(req: NextRequest): Promise<string | null> {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  const idToken = match?.[1]?.trim();
  if (!idToken) return null;

  const now = Date.now();
  const cached = tokenCache.get(idToken);
  if (cached && cached.expiresAt > now) return cached.uid;

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
    const uid: string | undefined = data.users?.[0]?.localId;
    if (!uid) return null;

    if (tokenCache.size > 1000) tokenCache.clear();
    tokenCache.set(idToken, { uid, expiresAt: now + TOKEN_CACHE_MS });
    return uid;
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
