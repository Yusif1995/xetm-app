import { NextRequest, NextResponse } from "next/server";
import { verifyRequestUser, isRateLimited } from "@/lib/serverAuth";
import { ensureVapidConfigured, sendToSubscriptions } from "@/lib/pushServer";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { getGroupInfo, getGroupPushTargets, isApprovedMember, removePushSubscriptions, senderDisplayName } from "@/lib/privateData";

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

// Tell the other members of a group that the caller finished some pages.
// Recipients and their subscriptions are looked up on the server; the client only names the group.
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

    const senderName = await senderDisplayName(db, uid);

    const targets = await getGroupPushTargets(db, groupId, group, uid);
    const payload = JSON.stringify({
      title: "Quran Xətm - Yeni Tamamlama!",
      body: `${senderName} yeni səhifəni tamamladı: Səhifə ${(pageNumbers as number[]).sort((a, b) => a - b).join(", ")}`,
      icon: "/icon.png",
      badge: "/favicon.ico",
      vibrate: [200, 100, 200],
      data: { url: "/dashboard" }
    });

    let count = 0;
    await Promise.all(Array.from(targets.entries()).map(async ([targetUid, subs]) => {
      const result = await sendToSubscriptions(subs, payload);
      count += result.attempted;
      await removePushSubscriptions(db, targetUid, result.expired);
    }));

    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error("Error in send-push API route:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
