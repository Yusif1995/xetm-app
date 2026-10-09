import { NextRequest, NextResponse } from "next/server";
import { verifyRequestUser, isRateLimited } from "@/lib/serverAuth";
import { ensureVapidConfigured, sendToSubscriptions } from "@/lib/pushServer";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { getGroupInfo, getPushSubscriptions, isApprovedMember, removePushSubscriptions } from "@/lib/privateData";

const MAX_MESSAGE_LENGTH = 500;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

// Push a group owner's message to one member. The server checks ownership and membership and
// looks up the member's subscriptions itself, so it cannot be used to push arbitrary text.
export async function POST(req: NextRequest) {
  try {
    const uid = await verifyRequestUser(req);
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (isRateLimited(`notify:${uid}`, 20, 10 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { groupId, targetUid, text } = await req.json();
    if (
      typeof groupId !== "string" || !ID_PATTERN.test(groupId) ||
      typeof targetUid !== "string" || !ID_PATTERN.test(targetUid) ||
      typeof text !== "string" || !text.trim() || text.length > MAX_MESSAGE_LENGTH
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server is not configured" }, { status: 500 });
    }

    const group = await getGroupInfo(db, groupId);
    if (!group || group.createdBy !== uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!isApprovedMember(group, targetUid)) {
      return NextResponse.json({ error: "Not a member" }, { status: 400 });
    }

    if (!ensureVapidConfigured()) {
      return NextResponse.json({ success: true, count: 0, push: "not-configured" });
    }

    const subscriptions = await getPushSubscriptions(db, targetUid);
    if (subscriptions.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    const payload = JSON.stringify({
      title: `${group.name} — qrup sahibindən mesaj`,
      body: text.trim(),
      icon: "/icon.png",
      badge: "/favicon.ico",
      vibrate: [200, 100, 200],
      data: { url: "/dashboard" }
    });

    const result = await sendToSubscriptions(subscriptions, payload);
    await removePushSubscriptions(db, targetUid, result.expired);
    return NextResponse.json({ success: true, count: result.attempted });
  } catch (error) {
    console.error("Error in notify-member API route:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
