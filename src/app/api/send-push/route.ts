import { NextRequest, NextResponse } from "next/server";
import { verifyRequestUser, isRateLimited } from "@/lib/serverAuth";
import { ensureVapidConfigured, sendToSubscriptions } from "@/lib/pushServer";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { getGroupInfo, getGroupPushTargets, isApprovedMember, removePushSubscriptions, senderDisplayName } from "@/lib/privateData";
import { pageRangesLabel } from "@/lib/quran";

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

// Pages already announced per reader and group, so a page unmarked by mistake and marked again
// is not announced twice. Per server process; a restart only risks one repeated notice.
const ANNOUNCED_TTL_MS = 36 * 60 * 60 * 1000;
const announced = new Map<string, { pages: Set<number>; expiresAt: number }>();

function announcedFor(key: string): Set<number> {
  const now = Date.now();
  const entry = announced.get(key);
  if (entry && entry.expiresAt > now) return entry.pages;
  if (announced.size > 5000) announced.clear();
  const fresh = { pages: new Set<number>(), expiresAt: now + ANNOUNCED_TTL_MS };
  announced.set(key, fresh);
  return fresh.pages;
}

// Tell the other members of a group that the caller read some pages. The client batches a
// reading session into one call; the server keeps only pages that are still marked as read by
// the caller right now (a mistaken tap that was undone is dropped) and never announces a page twice.
export async function POST(req: NextRequest) {
  try {
    const uid = await verifyRequestUser(req);
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (isRateLimited(`push:${uid}`, 30, 10 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { groupId, pageNumbers } = await req.json();
    if (
      typeof groupId !== "string" || !ID_PATTERN.test(groupId) ||
      !Array.isArray(pageNumbers) || pageNumbers.length === 0 || pageNumbers.length > 604 ||
      !pageNumbers.every((p) => Number.isInteger(p) && p >= 1 && p <= 604)
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    if (!ensureVapidConfigured()) {
      console.error("VAPID keys are not configured (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).");
      return NextResponse.json({ error: "Push notifications are not configured" }, { status: 500 });
    }
    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server is not configured" }, { status: 500 });
    }

    const group = await getGroupInfo(db, groupId);
    if (!group || !isApprovedMember(group, uid)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // What the caller has really read right now, from their own juz in this group
    const mine = await db.collection("groups").doc(groupId).collection("assignments").where("uid", "==", uid).get();
    const readNow = new Set<number>();
    mine.docs.forEach((d) => ((d.data().completedPages || []) as number[]).forEach((p) => readNow.add(p)));

    const seen = announcedFor(`${uid}:${groupId}`);
    const pages = Array.from(new Set(pageNumbers as number[]))
      .filter((p) => readNow.has(p) && !seen.has(p))
      .sort((a, b) => a - b);
    if (pages.length === 0) {
      return NextResponse.json({ success: true, count: 0, skipped: "nothing new" });
    }
    pages.forEach((p) => seen.add(p));

    const senderName = await senderDisplayName(db, uid);
    const targets = await getGroupPushTargets(db, groupId, group, uid);
    const payload = JSON.stringify({
      title: `${senderName} oxudu`,
      body: `${pages.length} səhifə: ${pageRangesLabel(pages)}. Allah qəbul etsin.`,
      icon: "/icon.png",
      badge: "/favicon.ico",
      vibrate: [200, 100, 200],
      data: { url: "/progress" }
    });

    let count = 0;
    await Promise.all(Array.from(targets.entries()).map(async ([targetUid, subs]) => {
      const result = await sendToSubscriptions(subs, payload);
      count += result.attempted;
      await removePushSubscriptions(db, targetUid, result.expired);
    }));

    return NextResponse.json({ success: true, count, pages: pages.length });
  } catch (error) {
    console.error("Error in send-push API route:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
