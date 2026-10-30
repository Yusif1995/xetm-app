import { NextRequest, NextResponse } from "next/server";
import type { Firestore, WriteBatch } from "firebase-admin/firestore";
import { verifyRequestUser, isRateLimited } from "@/lib/serverAuth";
import { ensureVapidConfigured, sendToSubscriptions } from "@/lib/pushServer";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { getGroupInfo, getPushSubscriptions, isApprovedMember, removePushSubscriptions } from "@/lib/privateData";
import { MAX_BROADCAST_TARGETS, MAX_THREAD_MESSAGE_LENGTH, type ThreadSide } from "@/lib/threads";

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const BATCH_LIMIT = 200; // two writes per member, Firestore allows 500 per batch

// Conversations between a group's managers and its members (see src/lib/threads.ts).
//  - A manager (the group's creator or an app admin) sends one text to one or more approved
//    members: { groupId, targetUids, text }. Each member gets it in their own thread and a push.
//  - A member replies to the managers: { groupId, reply }. Only their own thread is written and
//    the group creator is pushed. Members can never write to anyone else's thread.
// Written here with the Admin SDK; firestore.rules do not let clients write threads.
export async function POST(req: NextRequest) {
  try {
    const uid = await verifyRequestUser(req);
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (isRateLimited(`message:${uid}`, 40, 10 * 60 * 1000)) {
      return NextResponse.json({ error: "Çox mesaj göndərildi. Bir az sonra yenidən cəhd et." }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const groupId = body?.groupId;
    const raw = typeof body?.reply === "string" ? body.reply : body?.text;
    if (typeof groupId !== "string" || !ID_PATTERN.test(groupId) || typeof raw !== "string") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const text = raw.trim();
    if (!text || text.length > MAX_THREAD_MESSAGE_LENGTH) {
      return NextResponse.json({ error: `Mesaj 1–${MAX_THREAD_MESSAGE_LENGTH} simvol olmalıdır.` }, { status: 400 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server is not configured" }, { status: 500 });
    }
    const group = await getGroupInfo(db, groupId);
    if (!group) {
      return NextResponse.json({ error: "Qrup tapılmadı." }, { status: 404 });
    }

    // Member -> managers
    if (typeof body.reply === "string") {
      if (uid === group.createdBy || !isApprovedMember(group, uid)) {
        return NextResponse.json({ error: "Bu qrupda cavab yaza bilməzsən." }, { status: 403 });
      }
      const sentAt = new Date().toISOString();
      const batch = db.batch();
      addMessage(db, batch, groupId, uid, "member", uid, text, sentAt);
      await batch.commit();
      await push(db, group.createdBy, `${group.name} — iştirakçıdan cavab`, text, "/admin");
      return NextResponse.json({ success: true });
    }

    // Managers -> members
    const isAppAdmin = (await db.collection("admins").doc(uid).get()).exists;
    if (group.createdBy !== uid && !isAppAdmin) {
      return NextResponse.json({ error: "Bu qrupa mesaj göndərmək icazən yoxdur." }, { status: 403 });
    }
    const targets: unknown = body.targetUids;
    if (
      !Array.isArray(targets) || targets.length === 0 || targets.length > MAX_BROADCAST_TARGETS ||
      !targets.every((t) => typeof t === "string" && ID_PATTERN.test(t))
    ) {
      return NextResponse.json({ error: "Ən azı bir iştirakçı seç." }, { status: 400 });
    }
    const recipients = Array.from(new Set(targets as string[]))
      .filter((t) => t !== uid && t !== group.createdBy && isApprovedMember(group, t));
    if (recipients.length === 0) {
      return NextResponse.json({ error: "Seçilənlər arasında qrupun təsdiqlənmiş üzvü yoxdur." }, { status: 400 });
    }

    const sentAt = new Date().toISOString();
    for (let i = 0; i < recipients.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      recipients.slice(i, i + BATCH_LIMIT).forEach((memberUid) => addMessage(db, batch, groupId, memberUid, "manager", uid, text, sentAt));
      await batch.commit();
    }

    // The messages are saved; push is best effort
    const pushed = await Promise.all(recipients.map((memberUid) => push(db, memberUid, `${group.name} — qrup rəhbərindən mesaj`, text, "/mesajlar")));
    return NextResponse.json({ success: true, sent: recipients.length, pushed: pushed.reduce((s, n) => s + n, 0) });
  } catch (error) {
    console.error("Error in group-message API route:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

function addMessage(
  db: Firestore,
  batch: WriteBatch,
  groupId: string,
  memberUid: string,
  from: ThreadSide,
  senderUid: string,
  text: string,
  sentAt: string
) {
  const thread = db.collection("groups").doc(groupId).collection("threads").doc(memberUid);
  batch.set(thread.collection("messages").doc(), { from, senderUid, text, sentAt });
  batch.set(thread, {
    lastText: text,
    lastAt: sentAt,
    lastFrom: from,
    ...(from === "manager" ? { memberUnread: true } : { managerUnread: true }),
  }, { merge: true });
}

async function push(db: Firestore, targetUid: string, title: string, body: string, url: string): Promise<number> {
  if (!targetUid || !ensureVapidConfigured()) return 0;
  try {
    const subscriptions = await getPushSubscriptions(db, targetUid);
    if (subscriptions.length === 0) return 0;
    const payload = JSON.stringify({ title, body, icon: "/icon.png", badge: "/favicon.ico", vibrate: [200, 100, 200], data: { url } });
    const result = await sendToSubscriptions(subscriptions, payload);
    await removePushSubscriptions(db, targetUid, result.expired);
    return result.attempted;
  } catch (err) {
    console.error("Push for group message failed:", err);
    return 0;
  }
}
