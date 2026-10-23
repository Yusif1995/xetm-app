// Last-day reminder: at 18:00 Baku time, everyone whose juz ends today and is still unfinished
// gets a push. Each assignment is reminded at most once (deadlineRemindedOn = that day).
import type { Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "./firebaseAdmin";
import { ensureVapidConfigured, sendToSubscriptions } from "./pushServer";
import { getPushSubscriptions, isApprovedMember, removePushSubscriptions, type GroupInfo } from "./privateData";
import { khatmLabel } from "./quran";

export const REMINDER_HOUR_BAKU = 18;

export function bakuNow(date: Date = new Date()): { day: string; hour: number } {
  const day = date.toLocaleDateString("en-CA", { timeZone: "Asia/Baku" });
  const hour = Number(date.toLocaleString("en-US", { timeZone: "Asia/Baku", hour: "numeric", hour12: false })) % 24;
  return { day, hour };
}

export async function sendDeadlineReminders(db: Firestore, day: string): Promise<{ assignments: number; sent: number }> {
  let reminded = 0;
  let sent = 0;
  const groups = await db.collection("groups").get();
  for (const g of groups.docs) {
    const data = g.data() || {};
    const group: GroupInfo = {
      name: typeof data.name === "string" ? data.name : "Qrup",
      createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
      members: data.members || {},
    };
    const due = await g.ref.collection("assignments").where("endDate", "==", day).get();
    for (const a of due.docs) {
      const x = a.data();
      if (x.done || x.deadlineRemindedOn === day || typeof x.uid !== "string" || !isApprovedMember(group, x.uid)) continue;
      // Claim the reminder first so two runs never both send it
      const claimed = await db.runTransaction(async (tx) => {
        const fresh = await tx.get(a.ref);
        if (!fresh.exists || fresh.data()?.done || fresh.data()?.deadlineRemindedOn === day) return false;
        tx.update(a.ref, { deadlineRemindedOn: day });
        return true;
      });
      if (!claimed) continue;
      reminded++;
      const subs = await getPushSubscriptions(db, x.uid);
      if (subs.length === 0) continue;
      const left = (x.pages?.length || 0) - (x.completedPages?.length || 0);
      const payload = JSON.stringify({
        title: "CÜZÜNÜ BİTİRMƏK ÜÇÜN BU GÜN SON GÜNDÜR",
        body: `Cüz ${x.juz} · ${khatmLabel(x.khatm)} · ${group.name}: ${left} səhifə qalıb.`,
        icon: "/icon.png",
        badge: "/favicon.ico",
        vibrate: [300, 100, 300],
        requireInteraction: true,
        data: { url: "/dashboard" },
      });
      const result = await sendToSubscriptions(subs, payload);
      await removePushSubscriptions(db, x.uid, result.expired);
      sent += result.attempted;
    }
  }
  return { assignments: reminded, sent };
}

// Runs the reminder if it is 18:00 or later in Baku today. Safe to call often.
export async function runDeadlineRemindersIfDue(now: Date = new Date()) {
  const { day, hour } = bakuNow(now);
  if (hour < REMINDER_HOUR_BAKU) return { skipped: "too early" as const };
  if (!ensureVapidConfigured()) return { skipped: "push not configured" as const };
  const db = getAdminDb();
  if (!db) return { skipped: "no admin db" as const };
  return sendDeadlineReminders(db, day);
}
