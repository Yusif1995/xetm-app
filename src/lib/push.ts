import { addPushSubscription, removePushSubscription } from "./db";

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return false;
  const aBytes = new Uint8Array(a);
  if (aBytes.length !== b.length) return false;
  return aBytes.every((byte, i) => byte === b[i]);
}

export function isPushSupported(): boolean {
  return typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window;
}

// Subscribes this browser to push and stores the subscription on the user doc.
// A subscription created with an older VAPID key is replaced, since it can no longer receive pushes.
export async function registerPushSubscription(uid: string): Promise<boolean> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    console.warn("NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set; push notifications are disabled.");
    return false;
  }

  const applicationServerKey = urlBase64ToUint8Array(publicKey);
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (subscription && !sameKey(subscription.options.applicationServerKey, applicationServerKey)) {
    const staleJson = JSON.stringify(subscription);
    await subscription.unsubscribe();
    await removePushSubscription(uid, staleJson).catch((err) =>
      console.error("Failed to remove stale push subscription:", err)
    );
    subscription = null;
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey
    });
  }

  await addPushSubscription(uid, JSON.stringify(subscription));
  return true;
}

// Called from a button press: asks for permission and subscribes. Returns a user-facing message.
export async function enablePushFromUserGesture(uid: string): Promise<string> {
  if (!isPushSupported()) {
    return "Cihazınız və ya brauzeriniz Web Push bildirişləri dəstəkləmir.";
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return "Bildiriş icazəsi rədd edildi: " + permission;
    }
    return (await registerPushSubscription(uid))
      ? "Bildirişlər uğurla aktiv edildi!"
      : "Bildirişlər hazırda konfiqurasiya edilməyib.";
  } catch (err) {
    console.error("Subscription error:", err);
    return "Bildirişləri aktiv edərkən xəta baş verdi: " + (err instanceof Error ? err.message : String(err));
  }
}
