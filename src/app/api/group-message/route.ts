import { NextRequest, NextResponse } from "next/server";
import { verifyRequestUser, isRateLimited } from "@/lib/serverAuth";
import { ensureVapidConfigured, sendToSubscriptions } from "@/lib/pushServer";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { getGroupInfo, getPushSubscriptions, isApprovedMember, removePushSubscriptions } from "@/lib/privateData";

const MAX_MESSAGE_LENGTH = 500;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

// A group manager (the group's creator or an app admin) sends a message to one member, or clears
// it with empty text. Written here with the Admin SDK, so admins who did not create the group can
// send too; the member is pushed the text. Only approved members of the group can be messaged.
export async function POST(req: NextRequest) {
  try {
    const uid = await verifyRequestUser(req);
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (isRateLimited(`message:${uid}`, 30, 10 * 60 * 1000)) {
      return NextResponse.json({ error: "Çox mesaj göndərildi. Bir az sonra yenidən cəhd et." }, { status: 429 });
    }

    const { groupId, targetUid, text } = await req.json();
    if (
      typeof groupId !== "string" || !ID_PATTERN.test(groupId) ||
      typeof targetUid !== "string" || !ID_PATTERN.test(targetUid) ||
      typeof text !== "string" || text.length > MAX_MESSAGE_LENGTH
    ) {
      return NextResponse.json({ error: "Mesaj 500 simvoldan uzun ola bilməz." }, { status: 400 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server is not configured" }, { status: 500 });
    }

    const group = await getGroupInfo(db, groupId);
    if (!group) {
      return NextResponse.json({ error: "Qrup tapılmadı." }, { status: 404 });
    }
    const isAppAdmin = (await db.collection("admins").doc(uid).get()).exists;
    if (group.createdBy !== uid && !isAppAdmin) {
      return NextResponse.json({ error: "Bu qrupa mesaj göndərmək icazən yoxdur." }, { status: 403 });
    }
    if (!isApprovedMember(group, targetUid)) {
      return NextResponse.json({ error: "Bu şəxs qrupun təsdiqlənmiş üzvü deyil." }, { status: 400 });
    }

    const ref = db.collection("groups").doc(groupId).collection("messages").doc(targetUid);
    const trimmed = text.trim();
    if (!trimmed) {
      await ref.delete();
      return NextResponse.json({ success: true, cleared: true });
    }
    await ref.set({ text: trimmed, sentAt: new Date().toISOString(), read: false });

    // The message is saved; push is best effort
    let count = 0;
    if (ensureVapidConfigured()) {
      const subscriptions = await getPushSubscriptions(db, targetUid);
      if (subscriptions.length > 0) {
        const payload = JSON.stringify({
          title: `${group.name} — qrup rəhbərindən mesaj`,
          body: trimmed,
          icon: "/icon.png",
          badge: "/favicon.ico",
          vibrate: [200, 100, 200],
          data: { url: "/dashboard" },
        });
        const result = await sendToSubscriptions(subscriptions, payload);
        await removePushSubscriptions(db, targetUid, result.expired);
        count = result.attempted;
      }
    }
    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error("Error in group-message API route:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
