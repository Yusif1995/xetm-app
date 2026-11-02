// Last-night nudge for the group creator: on the end date of a group's latest distribution, at
// 23:55 and again at 23:59 Baku time, the creator gets a push to start the next distribution.
// Nothing is sent once a newer distribution exists. Each slot is claimed in
// groups/{gid}/reminders/{day} (Admin SDK only; rules give clients no access) so it goes out once.
import type { Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "./firebaseAdmin";
import { ensureVapidConfigured, sendToSubscriptions } from "./pushServer";
import { getPushSubscriptions, removePushSubscriptions } from "./privateData";
import { ordinalAz } from "./quran";

export type NudgeSlot = "2355" | "2359";

// The slot due at this moment in Baku: 23:55-23:58 is the first, 23:59 the last
export function nudgeSlotAt(date: Date = new Date()): { day: string; slot: NudgeSlot | null } {
  const day = date.toLocaleDateString("en-CA", { timeZone: "Asia/Baku" });
  const [h, m] = date
    .toLocaleTimeString("en-GB", { timeZone: "Asia/Baku", hour: "2-digit", minute: "2-digit", hour12: false })
    .split(":")
    .map(Number);
  if (h % 24 !== 23 || m < 55) return { day, slot: null };
  return { day, slot: m === 59 ? "2359" : "2355" };
}

const az = (s: string) => s.toLocaleUpperCase("az");

function nudgePayload(slot: NudgeSlot, groupName: string, distribution: number): string {
  const name = az(groupName);
  const round = az(`${ordinalAz(distribution)} bölgü`);
  const text = slot === "2355"
    ? { title: "۞ NÖVBƏTİ BÖLGÜNÜ ET ۞", body: `${name} · ${round} BU GECƏ BİTİR. GÜN BİTMƏMİŞ YENİ BÖLGÜNÜ BAŞLAT.` }
    : { title: "۞ SON DƏQİQƏ: NÖVBƏTİ BÖLGÜNÜ ET ۞", body: `${name} · ${round} 1 DƏQİQƏYƏ BİTİR. YENİ BÖLGÜNÜ İNDİ BAŞLAT.` };
  return JSON.stringify({
    ...text,
    icon: "/icon.png",
    badge: "/favicon.ico",
    vibrate: [400, 150, 400],
    requireInteraction: true,
    data: { url: "/admin" },
  });
}

export async function sendNextDistributionNudges(db: Firestore, day: string, slot: NudgeSlot): Promise<{ groups: number; sent: number }> {
  let nudged = 0;
  let sent = 0;
  const groups = await db.collection("groups").get();
  for (const g of groups.docs) {
    const data = g.data() || {};
    const createdBy = typeof data.createdBy === "string" ? data.createdBy : "";
    if (!createdBy) continue;
    const ending = await g.ref.collection("assignments").where("endDate", "==", day).get();
    if (ending.empty) continue;
    const latest = Math.max(...ending.docs.map((a) => Number(a.data().distribution) || 0));
    // The creator already started the next distribution
    const newer = await g.ref.collection("assignments").where("distribution", ">", latest).limit(1).get();
    if (!newer.empty) continue;

    const claim = g.ref.collection("reminders").doc(day);
    const claimed = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(claim);
      if (fresh.exists && fresh.data()?.[`nextDistribution${slot}`]) return false;
      tx.set(claim, { [`nextDistribution${slot}`]: true }, { merge: true });
      return true;
    });
    if (!claimed) continue;
    nudged++;

    const subs = await getPushSubscriptions(db, createdBy);
    if (subs.length === 0) continue;
    const name = typeof data.name === "string" && data.name ? data.name : "Qrup";
    const result = await sendToSubscriptions(subs, nudgePayload(slot, name, latest));
    await removePushSubscriptions(db, createdBy, result.expired);
    sent += result.attempted;
  }
  return { groups: nudged, sent };
}

// Runs the nudge if one of its slots is due now. Safe to call often: outside 23:55-23:59 it does
// not touch the database.
export async function runNextDistributionNudgesIfDue(now: Date = new Date()) {
  const { day, slot } = nudgeSlotAt(now);
  if (!slot) return { skipped: "not due" as const };
  if (!ensureVapidConfigured()) return { skipped: "push not configured" as const };
  const db = getAdminDb();
  if (!db) return { skipped: "no admin db" as const };
  return sendNextDistributionNudges(db, day, slot);
}
