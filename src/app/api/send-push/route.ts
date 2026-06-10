import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BFwS55H6VsjxTHDxWkRhjtW7Dy7VWHZ596I9Ak6rSjYOFRYI-2KQo9e67cGUawT79VkS4V9eAQyo73r5dgp03hg";
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "diItSNkdB7QOBkjy4dH2YgmOu6uKRhNIWACqjreiCDw";

webpush.setVapidDetails(
  "mailto:info@xetm.app",
  vapidPublicKey,
  vapidPrivateKey
);

export async function POST(req: NextRequest) {
  try {
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
