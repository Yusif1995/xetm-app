import { NextRequest, NextResponse } from "next/server";
import { verifyRequestUserWithToken, isRateLimited, readFirestoreDoc } from "@/lib/serverAuth";
import { ensureVapidConfigured, sendToSubscriptions } from "@/lib/pushServer";

const MAX_MESSAGE_LENGTH = 500;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

// Push a group owner's message to one member. The server checks ownership and looks up the
// member's subscriptions itself (reading Firestore as the caller), so it cannot be used to
// push arbitrary text to arbitrary devices.
export async function POST(req: NextRequest) {
  try {
    const caller = await verifyRequestUserWithToken(req);
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (isRateLimited(`notify:${caller.uid}`, 20, 10 * 60 * 1000)) {
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

    const group = await readFirestoreDoc(`groups/${groupId}`, caller.idToken);
    if (!group || group.createdBy?.stringValue !== caller.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Only members of this group can be messaged
    const memberStatus = group.members?.mapValue?.fields?.[targetUid]?.stringValue;
    if (memberStatus !== "member" && memberStatus !== "owner") {
      return NextResponse.json({ error: "Not a member" }, { status: 400 });
    }

    if (!ensureVapidConfigured()) {
      return NextResponse.json({ success: true, count: 0, push: "not-configured" });
    }

    const target = await readFirestoreDoc(`users/${targetUid}`, caller.idToken);
    const subscriptions = (target?.pushSubscriptions?.arrayValue?.values || [])
      .map((v) => v.stringValue || "")
      .filter(Boolean);
    if (subscriptions.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    const groupName = group.name?.stringValue || "Qrup";
    const payload = JSON.stringify({
      title: `${groupName} — qrup sahibindən mesaj`,
      body: text.trim(),
      icon: "/icon.png",
      badge: "/favicon.ico",
      vibrate: [200, 100, 200],
      data: { url: "/dashboard" }
    });

    const count = await sendToSubscriptions(subscriptions, payload);
    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error("Error in notify-member API route:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
