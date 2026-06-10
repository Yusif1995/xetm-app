import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase (Server-side)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

// Configure web-push with VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    "mailto:info@xetm.app",
    vapidPublicKey,
    vapidPrivateKey
  );
}

export async function POST(req: NextRequest) {
  try {
    const { uid, pageNumbers } = await req.json();

    if (!uid || !pageNumbers || !Array.isArray(pageNumbers) || pageNumbers.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
    }

    // 1. Get the sender's user document to get their name
    const senderRef = doc(db, "users", uid);
    const senderSnap = await getDoc(senderRef);
    if (!senderSnap.exists()) {
      return NextResponse.json({ error: "Sender not found" }, { status: 404 });
    }
    const senderName = senderSnap.data().name || "Bir iştirakçı";

    // 2. Get all users
    const usersSnap = await getDocs(collection(db, "users"));
    const notifications: Promise<unknown>[] = [];

    // Formulate the push notification payload
    const payload = JSON.stringify({
      title: "Quran Xətm - Yeni Tamamlama!",
      body: `${senderName} yeni səhifəni tamamladı: Səhifə ${pageNumbers.sort((a, b) => a - b).join(", ")}`,
      icon: "/icon.png",
      badge: "/favicon.ico",
      vibrate: [200, 100, 200],
      data: { url: "/dashboard" }
    });

    usersSnap.forEach((userDoc) => {
      const userUid = userDoc.id;
      // Skip the sender themselves
      if (userUid === uid) return;

      const userData = userDoc.data();
      const subscriptions: string[] = userData.pushSubscriptions || [];

      subscriptions.forEach((subStr) => {
        try {
          const subscription = JSON.parse(subStr);
          const promise = webpush.sendNotification(subscription, payload)
            .catch(async (err) => {
              console.error(`Error sending push to user ${userUid}:`, err.statusCode);
              // If subscription is invalid (e.g. 410 Gone, 404 Not Found), remove it from Firestore
              if (err.statusCode === 410 || err.statusCode === 404) {
                console.log(`Removing stale subscription for user ${userUid}`);
                const { arrayRemove, updateDoc } = await import("firebase/firestore");
                const userRef = doc(db, "users", userUid);
                await updateDoc(userRef, {
                  pushSubscriptions: arrayRemove(subStr)
                });
              }
            });
          notifications.push(promise);
        } catch (e) {
          console.error("Failed to parse push subscription JSON:", e);
        }
      });
    });

    await Promise.all(notifications);

    return NextResponse.json({ success: true, count: notifications.length });
  } catch (error) {
    console.error("Error in send-push API route:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
