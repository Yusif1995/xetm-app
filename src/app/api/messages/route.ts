import { NextRequest, NextResponse } from "next/server";
import type { DocumentReference, Firestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { verifyRequestOwner, verifyRequestUser, isRateLimited } from "@/lib/serverAuth";
import { ensureVapidConfigured, sendToSubscriptions } from "@/lib/pushServer";
import { getAdminApp, getAdminDb } from "@/lib/firebaseAdmin";
import { getGroupInfo, getMemberNames, getPushSubscriptions, isApprovedMember, removePushSubscriptions, type GroupInfo } from "@/lib/privateData";
import { KIND_COLLECTION, MAX_BROADCAST_TARGETS, MAX_THREAD_MESSAGE_LENGTH, type ConversationKind, type ThreadSide } from "@/lib/threads";

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const BATCH_LIMIT = 200; // two writes per member, Firestore allows 500 per batch
const KINDS: ConversationKind[] = ["thread", "broadcast", "ownerChat"];

// All group conversations (see src/lib/threads.ts). Who may do what:
//  - Leader (group creator): writes to any member (threads), sends bulk messages, answers replies
//    to bulk messages, talks to the app owner (ownerChats).
//  - Group admin (admins/{uid} and an approved member of this group): sends bulk messages, reads
//    every bulk conversation, talks to the leader (their own thread) and the owner.
//  - App owner (OWNER_EMAIL): sends bulk messages, reads every bulk conversation, writes to anyone
//    in the group privately (ownerChats). Never answers replies to bulk messages.
//  - Member: replies in their own conversations; writes to the leader first; answers the owner.
// Actions: inbox, messages, send, read. Every call verifies the caller here.
export async function POST(req: NextRequest) {
  try {
    const uid = await verifyRequestUser(req);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action, groupId } = body || {};
    if (typeof groupId !== "string" || !ID_PATTERN.test(groupId)) return bad();

    if (isRateLimited(`messages:${uid}`, 240, 10 * 60 * 1000)) {
      return NextResponse.json({ error: "Çox sorğu göndərildi. Bir az sonra yenidən cəhd et." }, { status: 429 });
    }
    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: "Server is not configured" }, { status: 500 });
    const group = await getGroupInfo(db, groupId);
    if (!group) return NextResponse.json({ error: "Qrup tapılmadı." }, { status: 404 });

    const owner = (await verifyRequestOwner(req)) === uid;
    const creator = group.createdBy === uid;
    const member = !creator && isApprovedMember(group, uid);
    const admin = member && (await db.collection("admins").doc(uid).get()).exists;
    if (!owner && !creator && !member) return forbidden();
    const me: Caller = { uid, owner, creator, admin, member, manager: owner || creator || admin };
    const ctx: Ctx = { db, groupId, group, me };

    if (action === "inbox") return NextResponse.json(await inbox(ctx));
    if (action === "messages") return messages(ctx, body.kind, body.key);
    if (action === "read") return markRead(ctx, body.kind, body.key);
    if (action === "send") {
      if (isRateLimited(`message:${uid}`, 40, 10 * 60 * 1000)) {
        return NextResponse.json({ error: "Çox mesaj göndərildi. Bir az sonra yenidən cəhd et." }, { status: 429 });
      }
      const text = typeof body.text === "string" ? body.text.trim() : "";
      if (!text || text.length > MAX_THREAD_MESSAGE_LENGTH) {
        return NextResponse.json({ error: `Mesaj 1–${MAX_THREAD_MESSAGE_LENGTH} simvol olmalıdır.` }, { status: 400 });
      }
      return send(ctx, body.kind, body.to, body.targetUids, text);
    }
    return bad();
  } catch (error) {
    console.error("Error in messages API route:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

interface Caller { uid: string; owner: boolean; creator: boolean; admin: boolean; member: boolean; manager: boolean }
interface Ctx { db: Firestore; groupId: string; group: GroupInfo; me: Caller }

const bad = () => NextResponse.json({ error: "Invalid payload" }, { status: 400 });
const forbidden = (error = "Buna icazən yoxdur.") => NextResponse.json({ error }, { status: 403 });

// The app owner's uid, from OWNER_EMAIL (cached for the life of the process)
let ownerUidCache: { email: string; uid: string | null } | null = null;
async function ownerUid(): Promise<string | null> {
  const email = (process.env.OWNER_EMAIL || "").trim().toLowerCase();
  if (!email) return null;
  if (ownerUidCache?.email === email) return ownerUidCache.uid;
  const app = getAdminApp();
  if (!app) return null;
  const uid = await getAuth(app).getUserByEmail(email).then((u) => u.uid).catch(() => null);
  ownerUidCache = { email, uid };
  return uid;
}

const approvedMembers = (group: GroupInfo) =>
  Object.keys(group.members).filter((u) => u !== group.createdBy && isApprovedMember(group, u) && ID_PATTERN.test(u));

async function groupAdmins(db: Firestore, group: GroupInfo): Promise<string[]> {
  const uids = approvedMembers(group);
  if (uids.length === 0) return [];
  const snaps = await db.getAll(...uids.map((u) => db.collection("admins").doc(u)));
  return snaps.filter((s) => s.exists).map((s) => s.id);
}

async function nicknames(db: Firestore, uids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (uids.length === 0) return names;
  const snaps = await db.getAll(...uids.map((u) => db.collection("users").doc(u)));
  snaps.forEach((s) => { const n = s.data()?.nickname; if (typeof n === "string" && n) names.set(s.id, n); });
  return names;
}

// "Yusif · Admin", "Rəşad · Qrup rəhbəri", or just the name for a member
async function labelOf(ctx: Ctx, uid: string): Promise<string> {
  const names = await getMemberNames(ctx.db, ctx.groupId, [uid]);
  const name = names.get(uid) || "İştirakçı";
  if (uid === ctx.group.createdBy) return `${name} · Qrup rəhbəri`;
  if (uid === (await ownerUid())) return `${name} · Admin`;
  if ((await ctx.db.collection("admins").doc(uid).get()).exists) return `${name} · Admin`;
  return name;
}

function convRef(ctx: Ctx, kind: ConversationKind, key: string): DocumentReference {
  return ctx.db.collection("groups").doc(ctx.groupId).collection(KIND_COLLECTION[kind]).doc(key);
}

function summaryOf(data: FirebaseFirestore.DocumentData | undefined) {
  const t = data || {};
  return {
    lastText: typeof t.lastText === "string" ? t.lastText : "",
    lastAt: typeof t.lastAt === "string" ? t.lastAt : "",
    lastFrom: t.lastFrom === "member" ? "member" : "manager",
    memberUnread: t.memberUnread === true,
    managerUnread: t.managerUnread === true,
    memberReadAt: typeof t.memberReadAt === "string" ? t.memberReadAt : undefined,
    managerReadAt: typeof t.managerReadAt === "string" ? t.managerReadAt : undefined,
  };
}

// Everything the Messages screen needs that the caller cannot read from Firestore directly
async function inbox(ctx: Ctx) {
  const { db, group, me } = ctx;
  const memberUids = approvedMembers(group);
  const adminUids = await groupAdmins(db, group);
  const owner = await ownerUid();
  const everyone = Array.from(new Set([...memberUids, group.createdBy, ...(owner ? [owner] : [])].filter(Boolean)));
  // Managers see full names (as in the admin panel); a member sees the public nicknames only
  const names = me.manager ? await getMemberNames(db, ctx.groupId, everyone) : await nicknames(db, everyone);
  const person = (u: string) => ({ uid: u, name: names.get(u) || "İştirakçı", admin: adminUids.includes(u) || u === owner });

  const result: Record<string, unknown> = {
    role: { owner: me.owner, creator: me.creator, admin: me.admin, member: me.member },
    groupName: group.name,
    leader: group.createdBy ? person(group.createdBy) : null,
    ownerContact: owner && owner !== me.uid ? person(owner) : null,
  };

  if (me.manager) {
    const open = await db.collection("groups").doc(ctx.groupId).collection("assignments").where("done", "==", false).get();
    const openJuz = new Map<string, number>();
    open.docs.forEach((a) => { const u = a.data().uid; if (typeof u === "string") openJuz.set(u, (openJuz.get(u) || 0) + 1); });
    result.members = memberUids.map((u) => ({ ...person(u), openJuz: openJuz.get(u) || 0 }));

    const [log, bulk] = await Promise.all([
      db.collection("groups").doc(ctx.groupId).collection("broadcastLog").orderBy("sentAt", "desc").limit(30).get(),
      db.collection("groups").doc(ctx.groupId).collection("broadcasts").orderBy("lastAt", "desc").get(),
    ]);
    result.feed = log.docs.map((d) => {
      const x = d.data();
      return { id: d.id, senderLabel: x.senderLabel || "", text: x.text || "", sentAt: x.sentAt || "", count: x.count || 0 };
    });
    const bulkNames = await getMemberNames(db, ctx.groupId, bulk.docs.map((d) => d.id).filter((u) => !names.has(u)));
    result.bulk = bulk.docs.map((d) => ({ uid: d.id, name: names.get(d.id) || bulkNames.get(d.id) || "Keçmiş üzv", ...summaryOf(d.data()) }));
  }

  if (me.owner) {
    const chats = await db.collection("groups").doc(ctx.groupId).collection("ownerChats").get();
    result.ownerChats = chats.docs.map((d) => ({ uid: d.id, ...summaryOf(d.data()) }));
  }
  return result;
}

// May the caller open this conversation? Managers read every bulk conversation; the owner reads
// their own chats; anyone reads their own.
function canRead(me: Caller, kind: ConversationKind, key: string): boolean {
  if (kind === "broadcast") return me.manager || key === me.uid;
  if (kind === "ownerChat") return me.owner || key === me.uid;
  return me.creator || key === me.uid;
}

async function messages(ctx: Ctx, kind: unknown, key: unknown) {
  if (!KINDS.includes(kind as ConversationKind) || typeof key !== "string" || !ID_PATTERN.test(key)) return bad();
  if (!canRead(ctx.me, kind as ConversationKind, key)) return forbidden();
  const ref = convRef(ctx, kind as ConversationKind, key);
  const [summary, snap] = await Promise.all([ref.get(), ref.collection("messages").orderBy("sentAt", "asc").limit(500).get()]);
  return NextResponse.json({
    summary: summary.exists ? summaryOf(summary.data()) : null,
    messages: snap.docs.map((d) => {
      const m = d.data();
      return {
        id: d.id,
        from: m.from === "member" ? "member" : "manager",
        senderUid: typeof m.senderUid === "string" ? m.senderUid : "",
        senderLabel: typeof m.senderLabel === "string" ? m.senderLabel : undefined,
        text: typeof m.text === "string" ? m.text : "",
        sentAt: typeof m.sentAt === "string" ? m.sentAt : "",
      };
    }),
  });
}

async function send(ctx: Ctx, kind: unknown, to: unknown, targets: unknown, text: string) {
  const { db, group, me } = ctx;
  const sentAt = new Date().toISOString();
  const label = await labelOf(ctx, me.uid);

  // A bulk message from the leader, a group admin or the owner to many members
  if (kind === "broadcast" && targets !== undefined) {
    if (!me.manager) return forbidden("Toplu mesaj göndərmək icazən yoxdur.");
    if (!Array.isArray(targets) || targets.length === 0 || targets.length > MAX_BROADCAST_TARGETS || !targets.every((t) => typeof t === "string")) {
      return NextResponse.json({ error: "Ən azı bir iştirakçı seç." }, { status: 400 });
    }
    const allowed = new Set(approvedMembers(group));
    const recipients = Array.from(new Set(targets as string[])).filter((t) => t !== me.uid && allowed.has(t));
    if (recipients.length === 0) return NextResponse.json({ error: "Seçilənlər arasında qrupun təsdiqlənmiş üzvü yoxdur." }, { status: 400 });
    const logRef = db.collection("groups").doc(ctx.groupId).collection("broadcastLog").doc();
    for (let i = 0; i < recipients.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      if (i === 0) batch.set(logRef, { senderUid: me.uid, senderLabel: label, text, sentAt, count: recipients.length });
      recipients.slice(i, i + BATCH_LIMIT).forEach((u) => write(batch, convRef(ctx, "broadcast", u), "manager", me.uid, label, text, sentAt, logRef.id));
      await batch.commit();
    }
    const pushed = await Promise.all(recipients.map((u) => push(db, u, `${label} — toplu mesaj`, text)));
    return NextResponse.json({ success: true, sent: recipients.length, pushed: pushed.reduce((s, n) => s + n, 0) });
  }

  if (!KINDS.includes(kind as ConversationKind)) return bad();
  const k = kind as ConversationKind;
  const target = typeof to === "string" && ID_PATTERN.test(to) ? to : null;

  // Which conversation, which side, and who is pushed
  let key: string;
  let side: ThreadSide;
  let notify: string | null;
  if (k === "broadcast") {
    // Replies: the member in their own; only the leader answers them
    if (me.creator && target && approvedMembers(group).includes(target)) { key = target; side = "manager"; notify = target; }
    else if (me.member && !target) { key = me.uid; side = "member"; notify = group.createdBy; }
    else return forbidden("Toplu mesajlara cavabı yalnız qrup rəhbəri yazır.");
    if (!(await convRef(ctx, k, key).get()).exists) return forbidden("Bu yazışma yoxdur.");
  } else if (k === "thread") {
    if (me.creator && target && approvedMembers(group).includes(target)) { key = target; side = "manager"; notify = target; }
    else if (me.member && !target) { key = me.uid; side = "member"; notify = group.createdBy; }
    else return forbidden();
  } else {
    const owner = await ownerUid();
    if (me.owner && target && target !== me.uid && (target === group.createdBy || approvedMembers(group).includes(target))) {
      key = target; side = "manager"; notify = target;
    } else if (!me.owner && !target && owner) {
      // The leader and group admins may write to the owner first; a member only answers
      if (!me.creator && !me.admin && !(await convRef(ctx, k, me.uid).get()).exists) return forbidden("Bu yazışma yoxdur.");
      key = me.uid; side = "member"; notify = owner;
    } else return forbidden();
  }

  const batch = db.batch();
  write(batch, convRef(ctx, k, key), side, me.uid, label, text, sentAt);
  await batch.commit();
  if (notify) await push(db, notify, label, text);
  return NextResponse.json({ success: true });
}

// Marks a conversation read for the caller's side. Group admins and the owner reading bulk
// conversations do not mark them: answering them is the leader's job.
async function markRead(ctx: Ctx, kind: unknown, key: unknown) {
  const { me } = ctx;
  if (!KINDS.includes(kind as ConversationKind) || typeof key !== "string" || !ID_PATTERN.test(key)) return bad();
  const k = kind as ConversationKind;
  let side: ThreadSide | null = null;
  if (key === me.uid && (me.member || (k === "ownerChat" && !me.owner))) side = "member";
  else if (k === "ownerChat" && me.owner) side = "manager";
  else if (k !== "ownerChat" && me.creator) side = "manager";
  if (!side) return forbidden();
  const ref = convRef(ctx, k, key);
  const now = new Date().toISOString();
  await ctx.db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    tx.update(ref, side === "member" ? { memberUnread: false, memberReadAt: now } : { managerUnread: false, managerReadAt: now });
  });
  return NextResponse.json({ success: true });
}

function write(
  batch: FirebaseFirestore.WriteBatch,
  ref: DocumentReference,
  from: ThreadSide,
  senderUid: string,
  senderLabel: string,
  text: string,
  sentAt: string,
  broadcastId?: string
) {
  batch.set(ref.collection("messages").doc(), { from, senderUid, senderLabel, text, sentAt, ...(broadcastId ? { broadcastId } : {}) });
  batch.set(ref, {
    lastText: text,
    lastAt: sentAt,
    lastFrom: from,
    ...(from === "manager" ? { memberUnread: true } : { managerUnread: true }),
  }, { merge: true });
}

async function push(db: Firestore, targetUid: string, title: string, body: string): Promise<number> {
  if (!targetUid || !ensureVapidConfigured()) return 0;
  try {
    const subscriptions = await getPushSubscriptions(db, targetUid);
    if (subscriptions.length === 0) return 0;
    const payload = JSON.stringify({ title, body, icon: "/icon.png", badge: "/favicon.ico", vibrate: [200, 100, 200], data: { url: "/mesajlar" } });
    const result = await sendToSubscriptions(subscriptions, payload);
    await removePushSubscriptions(db, targetUid, result.expired);
    return result.attempted;
  } catch (err) {
    console.error("Push for message failed:", err);
    return 0;
  }
}
