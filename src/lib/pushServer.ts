import webpush from "web-push";

// Server-only Web Push helpers

let vapidConfigured = false;

// Configure lazily so a missing env var fails the request instead of the build
export function ensureVapidConfigured(): boolean {
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

// Sends the payload to every subscription (JSON strings); failures are logged, not thrown.
// Returns the number of subscriptions attempted.
export async function sendToSubscriptions(subscriptions: string[], payload: string): Promise<number> {
  const notifications: Promise<unknown>[] = [];

  subscriptions.forEach((subStr) => {
    try {
      const subscription = JSON.parse(subStr);
      notifications.push(
        webpush.sendNotification(subscription, payload).catch((err) => {
          console.error("Error sending push notification to endpoint:", err.statusCode);
        })
      );
    } catch (e) {
      console.error("Failed to parse push subscription JSON:", e);
    }
  });

  await Promise.all(notifications);
  return notifications.length;
}
