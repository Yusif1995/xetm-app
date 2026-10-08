import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

let vapidConfigured = false;

// Configure lazily so a missing env var fails the request instead of the build
function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublicKey || !vapidPrivateKey) {
    return false;
  }
  webpush.setVapidDetails("mailto:info@xetm.app", vapidPublicKey, vapidPrivateKey);
  vapidConfigured = true;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    if (!ensureVapidConfigured()) {
      console.error("VAPID keys are not configured (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).");
      return NextResponse.json({ error: "Push notifications are not configured" }, { status: 500 });
    }

    const { senderName, pageNumbers, subscriptions } = await req.json();

    if (!senderName || !pageNumbers || !Array.isArray(pageNumbers) || pageNumbers.length === 0 || !Array.isArray(subscriptions)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const payload = JSON.stringify({
      title: "Quran Xətm - Yeni Tamamlama!",
      body: `${senderName} yeni səhifəni tamamladı: Səhifə ${pageNumbers.sort((a, b) => a - b).join(", ")}`,
      icon: "/icon.png",
      badge: "/favicon.ico",
      vibrate: [200, 100, 200],
      data: { url: "/dashboard" }
    });

    const notifications: Promise<unknown>[] = [];

    subscriptions.forEach((subStr) => {
      try {
        const subscription = JSON.parse(subStr);
        const promise = webpush.sendNotification(subscription, payload)
          .catch((err) => {
            console.error("Error sending push notification to endpoint:", err.statusCode);
          });
        notifications.push(promise);
      } catch (e) {
        console.error("Failed to parse push subscription JSON:", e);
      }
    });

    await Promise.all(notifications);

    return NextResponse.json({ success: true, count: notifications.length });
  } catch (error) {
    console.error("Error in send-push API route:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
