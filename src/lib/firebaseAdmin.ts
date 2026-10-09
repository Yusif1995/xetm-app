// Server-only Firebase Admin SDK access. Bypasses security rules, so only use it in API routes
// after verifying the caller.
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let app: App | null = null;

function getAdminApp(): App | null {
  if (app) return app;
  if (getApps().length > 0) {
    app = getApps()[0];
    return app;
  }

  // Tests and local emulators: no credentials needed
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    app = initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-xetm" });
    return app;
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.error("FIREBASE_SERVICE_ACCOUNT is not set; server-side Firestore access is disabled.");
    return null;
  }
  try {
    const serviceAccount = JSON.parse(raw);
    app = initializeApp({ credential: cert(serviceAccount) });
    return app;
  } catch (err) {
    console.error("FIREBASE_SERVICE_ACCOUNT is not valid service account JSON:", err instanceof Error ? err.message : err);
    return null;
  }
}

export function getAdminDb(): Firestore | null {
  const adminApp = getAdminApp();
  return adminApp ? getFirestore(adminApp) : null;
}
