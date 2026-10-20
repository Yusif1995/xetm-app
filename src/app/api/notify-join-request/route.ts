import { NextRequest, NextResponse } from "next/server";
import { verifyRequestUser, isRateLimited } from "@/lib/serverAuth";
import { ensureVapidConfigured, sendToSubscriptions } from "@/lib/pushServer";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { getGroupInfo, getPushSubscriptions, removePushSubscriptions, senderDisplayName } from "@/lib/privateData";

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

// Tells the group owner that someone asked to join. Only the requester can trigger it, and only
// while their request is really pending, so it cannot be used to push arbitrary text to owners.
export async function POST(req: NextRequest) {
  try {
    const uid = await verifyRequestUser(req);
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupId } = await req.json();
    if (typeof groupId !== "string" || !ID_PATTERN.test(groupId)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // One notice per requester and group every 6 hours, and a cap per requester
    if (isRateLimited(`join:${uid}`, 10, 60 * 60 * 1000) || isRateLimited(`join:${uid}:${groupId}`, 1, 6 * 60 * 60 * 1000)) {
      return NextResponse.json({ success: true, count: 0, skipped: "rate-limited" });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server is not configured" }, { status: 500 });
    }

    const group = await getGroupInfo(db, groupId);
    if (!group || !group.createdBy) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (group.members[uid] !== "pending") {
      return NextResponse.json({ error: "No pending request" }, { status: 400 });
    }

    if (!ensureVapidConfigured()) {
      return NextResponse.json({ success: true, count: 0, push: "not-configured" });
    }

    const subscriptions = await getPushSubscriptions(db, group.createdBy);
    if (subscriptions.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    const name = await senderDisplayName(db, uid);
    const payload = JSON.stringify({
      title: "Yeni qoşulma istəyi",
      body: `${name} “${group.name}” qrupuna qoşulmaq istəyir. Təsdiq etmək üçün toxun.`,
      icon: "/icon.png",
      badge: "/favicon.ico",
      vibrate: [200, 100, 200],
      data: { url: "/admin" },
    });

    const result = await sendToSubscriptions(subscriptions, payload);
    await removePushSubscriptions(db, group.createdBy, result.expired);
    return NextResponse.json({ success: true, count: result.attempted });
  } catch (error) {
    console.error("Error in notify-join-request API route:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
