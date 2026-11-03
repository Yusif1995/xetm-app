import { NextRequest, NextResponse } from "next/server";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { verifyRequestUser, isRateLimited } from "@/lib/serverAuth";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { getGroupInfo, getPushSubscriptions, isApprovedMember, removePushSubscriptions } from "@/lib/privateData";
import { ensureVapidConfigured, sendToSubscriptions } from "@/lib/pushServer";
import { recomputeKhatm } from "@/lib/groupProgress";
import {
  eligibleMembers, helperPages, newAssignmentData, openKhatmForAssignment, pagesReadBy, planDistribution, type Assignment,
} from "@/lib/khatm";

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
// One distribution is one batch (a write per member plus the group), under Firestore's 500
const MAX_MEMBERS = 450;

// A real calendar day written as YYYY-MM-DD
const isDay = (v: unknown): v is string =>
  typeof v === "string" && DATE_PATTERN.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const ACTIONS = ["transfer", "remove", "distribute", "assign", "reset", "help", "unhelp", "helpRead"] as const;
type Action = (typeof ACTIONS)[number];

// Everything a group manager does with the juz of a group: hand out one juz to every member
// ("distribute"), give one juz by hand ("assign"), hand a juz to someone else ("transfer"), take
// one back ("remove") and start counting from scratch ("reset"); give some unread pages of a juz
// to a friend ("help") and take them back ("unhelp"), while the juz stays with its holder.
// "helpRead" is that friend marking those pages: the one action a non-manager may call.
// The rules let only the group
// creator write assignments; app admins (and the owner, who is one) run groups they did not
// create with the same rights, so these go through the Admin SDK after the same check as the
// other manager routes: the group creator or an app admin.
export async function POST(req: NextRequest) {
  try {
    const uid = await verifyRequestUser(req);
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (isRateLimited(`assignments:${uid}`, 60, 10 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    const body = await req.json().catch(() => ({}));
    const { action, groupId, assignmentId, to, memberUids, startDate, endDate, khatm, juz, pages, read } = body || {};
    const isId = (v: unknown): v is string => typeof v === "string" && ID_PATTERN.test(v);
    const onOneJuz = ["transfer", "remove", "help", "unhelp", "helpRead"].includes(action);
    if (
      !ACTIONS.includes(action as Action)
      || !isId(groupId)
      || (onOneJuz && !isId(assignmentId))
      || (["transfer", "assign", "help", "unhelp"].includes(action) && !isId(to))
      || ((action === "help" || action === "helpRead")
        && (!Array.isArray(pages) || pages.length < 1 || pages.length > 20 || !pages.every((p: unknown) => Number.isInteger(p))))
      || (action === "helpRead" && typeof read !== "boolean")
      || ((action === "distribute" || action === "assign") && (!isDay(startDate) || !isDay(endDate) || startDate > endDate))
      || (action === "distribute" && (!Array.isArray(memberUids) || memberUids.length > MAX_MEMBERS || !memberUids.every(isId)))
      || (action === "assign" && (!Number.isInteger(khatm) || khatm < 1 || !Number.isInteger(juz) || juz < 1 || juz > 30))
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server is not configured" }, { status: 500 });
    }
    const group = await getGroupInfo(db, groupId);
    if (!group) {
      return NextResponse.json({ error: "Qrup tapılmadı." }, { status: 404 });
    }
    const groupRef = db.collection("groups").doc(groupId);

    // The friend marks or unmarks the pages they were given; nobody else goes through here
    if (action === "helpRead") {
      if (!isApprovedMember(group, uid)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const ref = groupRef.collection("assignments").doc(assignmentId);
      const now = new Date().toISOString();
      const outcome = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return { error: "Bu cüz artıq yoxdur.", status: 404 };
        const a = { id: snap.id, ...snap.data() } as Assignment;
        const given = new Set((a.helpers || []).filter((h) => h.uid === uid).flatMap((h) => h.pages));
        if (given.size === 0) return { error: "Forbidden", status: 403 };
        if (!(pages as number[]).every((p) => given.has(p))) return { error: "Bu səhifələr sənə verilməyib.", status: 400 };
        // A finished juz is history (khatm totals, archive): nobody reopens it from here
        if (a.done) return { error: "Bu cüz artıq tamamlanıb.", status: 409 };
        const current = new Set(a.completedPages || []);
        // Marking skips pages already read by anyone; unmarking only takes back the helper's own marks
        const changed = Array.from(new Set(pages as number[])).filter((p) =>
          read ? !current.has(p) : current.has(p) && a.readBy?.[String(p)] === uid);
        if (changed.length === 0) return { changed: 0 };
        changed.forEach((p) => (read ? current.add(p) : current.delete(p)));
        const completedPages = Array.from(current).sort((x, y) => x - y);
        const done = completedPages.length === a.pages.length;
        const updates: Record<string, unknown> = { completedPages, done, doneAt: done ? (a.doneAt || now) : null };
        changed.forEach((p) => {
          updates[`completedAt.${p}`] = read ? now : FieldValue.delete();
          updates[`readBy.${p}`] = read ? uid : FieldValue.delete();
        });
        tx.update(ref, updates);
        // The holder hears once, when this mark finishes the last of the pages the friend was given
        const finishedHelp = read && Array.from(given).every((p) => current.has(p));
        return { changed: changed.length, finishedHelp, holder: a.uid, juz: a.juz, pagesGiven: given.size, done };
      });
      if ("error" in outcome) {
        return NextResponse.json({ error: outcome.error }, { status: outcome.status });
      }
      if (outcome.changed > 0) await recomputeKhatm(db, groupId);
      if (outcome.finishedHelp && outcome.holder) {
        await notifyHolderOfHelp(db, uid, outcome.holder, outcome.juz, outcome.pagesGiven, !!outcome.done)
          .catch((err) => console.error("Could not notify holder:", err));
      }
      return NextResponse.json({ success: true });
    }

    const isAppAdmin = (await db.collection("admins").doc(uid).get()).exists;
    if (group.createdBy !== uid && !isAppAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Give some unread pages of a juz to a friend; the juz and its credit stay with the holder
    if (action === "help") {
      if (!isApprovedMember(group, to)) {
        return NextResponse.json({ error: "Bu şəxs qrupun təsdiqlənmiş üzvü deyil." }, { status: 400 });
      }
      const ref = groupRef.collection("assignments").doc(assignmentId);
      const outcome = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return { error: "Bu cüz artıq yoxdur." };
        const a = { id: snap.id, ...snap.data() } as Assignment;
        if (a.done) return { error: "Bu cüz artıq tamamlanıb." };
        if (a.uid === to) return { error: "Cüz artıq bu şəxsdədir. Kömək üçün başqasını seç." };
        const given = helperPages(a);
        const wanted = Array.from(new Set(pages as number[])).sort((x, y) => x - y);
        if (!wanted.every((p) => a.pages.includes(p) && !a.completedPages.includes(p) && !given.has(p))) {
          return { error: "Yalnız oxunmamış və başqasına verilməmiş səhifələr verilə bilər. Səhifəni yenilə." };
        }
        const before = (a.helpers || []).find((h) => h.uid === to)?.pages || [];
        const helpers = [
          ...(a.helpers || []).filter((h) => h.uid !== to),
          { uid: to, pages: [...before, ...wanted].sort((x, y) => x - y), at: new Date().toISOString() },
        ];
        tx.update(ref, { helpers });
        return { juz: a.juz, pages: wanted };
      });
      if ("error" in outcome) {
        return NextResponse.json({ error: outcome.error }, { status: 409 });
      }
      await notifyHelper(db, to, outcome.juz, outcome.pages).catch((err) => console.error("Could not notify helper:", err));
      return NextResponse.json({ success: true });
    }

    // Take back the pages a friend has not read yet; the ones they read stay credited to them
    if (action === "unhelp") {
      const ref = groupRef.collection("assignments").doc(assignmentId);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return;
        const a = { id: snap.id, ...snap.data() } as Assignment;
        const helpers = (a.helpers || []).flatMap((h) => {
          if (h.uid !== to) return [h];
          const read = h.pages.filter((p) => a.completedPages.includes(p) && a.readBy?.[String(p)] === to);
          return read.length ? [{ ...h, pages: read }] : [];
        });
        tx.update(ref, { helpers });
      });
      return NextResponse.json({ success: true });
    }

    if (action === "distribute") {
      const uids = Array.from(new Set(memberUids as string[])).filter((u) => isApprovedMember(group, u));
      const result = await distribute(db, groupId, uids, startDate, endDate);
      if (result.assigned > 0) await recomputeKhatm(db, groupId);
      return NextResponse.json(result);
    }

    if (action === "assign") {
      if (!isApprovedMember(group, to)) {
        return NextResponse.json({ error: "Bu şəxs qrupun təsdiqlənmiş üzvü deyil." }, { status: 400 });
      }
      // Read and write in one transaction so two taps (or two managers) cannot hand out the same juz
      const outcome = await db.runTransaction(async (tx) => {
        const [groupSnap, assignmentSnap] = await Promise.all([tx.get(groupRef), tx.get(groupRef.collection("assignments"))]);
        const assignments = assignmentSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Assignment));
        const open = openKhatmForAssignment(assignments);
        if (khatm !== open.khatm || !open.free.includes(juz)) {
          return { error: `Cüz ${juz} artıq verilib. Səhifəni yenilə.` };
        }
        const count = Number(groupSnap.data()?.distributionCount) || 0;
        const distribution = Math.max(1, count);
        const ref = groupRef.collection("assignments").doc();
        tx.create(ref, newAssignmentData({ uid: to, khatm, juz }, distribution, startDate, endDate, new Date().toISOString()));
        if (!count) tx.update(groupRef, { distributionCount: distribution });
        return { assignmentId: ref.id };
      });
      if ("error" in outcome) {
        return NextResponse.json({ error: outcome.error }, { status: 409 });
      }
      await recomputeKhatm(db, groupId);
      return NextResponse.json({ success: true, assignmentId: outcome.assignmentId });
    }

    if (action === "reset") {
      const refs = await groupRef.collection("assignments").listDocuments();
      for (let i = 0; i < refs.length; i += 400) {
        const batch = db.batch();
        refs.slice(i, i + 400).forEach((r) => batch.delete(r));
        await batch.commit();
      }
      await groupRef.update({
        distributionCount: 0,
        lastDistribution: FieldValue.delete(),
        completedKhatms: 0,
        khatmCompletedAt: {},
        isCurrentKhatmCompleted: false,
      });
      await recomputeKhatm(db, groupId);
      return NextResponse.json({ success: true });
    }

    const ref = groupRef.collection("assignments").doc(assignmentId);

    // Only unfinished juz are taken back: a finished one is reading history the archive still needs
    if (action === "remove") {
      const snap = await ref.get();
      if (!snap.exists) return NextResponse.json({ error: "Bu cüz artıq yoxdur." }, { status: 404 });
      if (snap.data()?.done) return NextResponse.json({ error: "Tamamlanmış cüz silinmir." }, { status: 409 });
      await ref.delete();
      await recomputeKhatm(db, groupId);
      return NextResponse.json({ success: true });
    }

    if (!isApprovedMember(group, to)) {
      return NextResponse.json({ error: "Bu şəxs qrupun təsdiqlənmiş üzvü deyil." }, { status: 400 });
    }
    const error = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return "Bu cüz artıq yoxdur.";
      const a = { id: snap.id, ...snap.data() } as Assignment;
      if (a.done) return "Bu cüz artıq tamamlanıb.";
      if (a.uid === to) return "Cüz artıq bu şəxsdədir.";
      tx.update(ref, {
        uid: to,
        previousHolders: [...(a.previousHolders || []), { uid: a.uid, pagesRead: pagesReadBy(a, a.uid) }],
        // The new holder reads the pages they were helping with as their own
        helpers: (a.helpers || []).filter((h) => h.uid !== to),
      });
      return null;
    });
    if (error) {
      return NextResponse.json({ error }, { status: 409 });
    }
    await recomputeKhatm(db, groupId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in assignments API route:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// One juz to every approved member who is not behind; the distribution counter moves on by one.
// Planned and written in one transaction, so a double tap cannot hand out the same juz twice.
// When nobody gets a juz, nothing is written and the counter stays.
async function distribute(db: Firestore, groupId: string, memberUids: string[], startDate: string, endDate: string) {
  const groupRef = db.collection("groups").doc(groupId);
  return db.runTransaction(async (tx) => {
    const [groupSnap, assignmentSnap] = await Promise.all([tx.get(groupRef), tx.get(groupRef.collection("assignments"))]);
    const assignments = assignmentSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Assignment));
    const current = Number(groupSnap.data()?.distributionCount) || 0;
    const { eligible, skipped } = eligibleMembers(memberUids, assignments);
    const plan = planDistribution(eligible, assignments);
    if (plan.length === 0) {
      return { distribution: current, assigned: 0, skipped, assignmentIds: [] as string[] };
    }
    const distribution = current + 1;
    const now = new Date().toISOString();
    const assignmentIds: string[] = [];
    plan.forEach((p) => {
      const ref = groupRef.collection("assignments").doc();
      assignmentIds.push(ref.id);
      tx.create(ref, newAssignmentData(p, distribution, startDate, endDate, now));
    });
    tx.update(groupRef, {
      distributionCount: distribution,
      lastDistribution: { number: distribution, startDate, endDate, at: now },
    });
    return { distribution, assigned: plan.length, skipped, assignmentIds };
  });
}

// "Kömək" push to the friend who got pages; the text is built here, not taken from the caller
async function notifyHelper(db: Firestore, helperUid: string, juz: number, pages: number[]) {
  if (!ensureVapidConfigured()) return;
  const subscriptions = await getPushSubscriptions(db, helperUid);
  if (subscriptions.length === 0) return;
  const range = pages.length > 1 ? `${pages[0]}–${pages[pages.length - 1]}` : `${pages[0]}`;
  const payload = JSON.stringify({
    title: "Kömək",
    body: `Cüz ${juz}-dən ${pages.length} səhifə (səhifə ${range}) oxumaq üçün sənə verildi. Allah razı olsun.`,
    icon: "/icon.png",
    badge: "/favicon.ico",
    data: { url: "/dashboard" },
  });
  const result = await sendToSubscriptions(subscriptions, payload);
  await removePushSubscriptions(db, helperUid, result.expired);
}

// Tells the holder their friend read the pages they were given. Only the nickname is used:
// members do not see each other's full names.
async function notifyHolderOfHelp(db: Firestore, helperUid: string, holderUid: string, juz: number, pages: number, juzDone: boolean) {
  if (!ensureVapidConfigured()) return;
  const subscriptions = await getPushSubscriptions(db, holderUid);
  if (subscriptions.length === 0) return;
  const helper = await db.collection("users").doc(helperUid).get();
  const nickname = typeof helper.data()?.nickname === "string" && helper.data()!.nickname.trim() ? helper.data()!.nickname.trim() : "Dostun";
  const payload = JSON.stringify({
    title: juzDone ? `Cüz ${juz} tamamlandı` : "Kömək bitdi",
    body: `${nickname} Cüz ${juz}-dən sənə kömək üçün verilən ${pages} səhifəni oxudu.`
      + (juzDone ? " Cüz sənin adına yazıldı. Allah qəbul etsin." : " Qalan səhifələrini bitirəndə cüz sənin adına yazılacaq."),
    icon: "/icon.png",
    badge: "/favicon.ico",
    data: { url: "/dashboard" },
  });
  const result = await sendToSubscriptions(subscriptions, payload);
  await removePushSubscriptions(db, holderUid, result.expired);
}
