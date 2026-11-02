import { NextRequest, NextResponse } from "next/server";
import { verifyRequestUser, isRateLimited } from "@/lib/serverAuth";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { getGroupInfo, isApprovedMember } from "@/lib/privateData";
import { pagesReadBy, type Assignment } from "@/lib/khatm";

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

// Managing one handed-out juz: hand it to another member ("transfer") or take it back ("remove").
// The rules let only the group creator write assignments; app admins (and the owner, who is one)
// manage groups they did not create, so these go through the Admin SDK after the same check as
// the other manager routes: the group creator or an app admin.
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
    const { action, groupId, assignmentId, to } = body || {};
    if (
      (action !== "transfer" && action !== "remove")
      || typeof groupId !== "string" || !ID_PATTERN.test(groupId)
      || typeof assignmentId !== "string" || !ID_PATTERN.test(assignmentId)
      || (action === "transfer" && (typeof to !== "string" || !ID_PATTERN.test(to)))
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
    const isAppAdmin = (await db.collection("admins").doc(uid).get()).exists;
    if (group.createdBy !== uid && !isAppAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const ref = db.collection("groups").doc(groupId).collection("assignments").doc(assignmentId);

    // Only unfinished juz are taken back: a finished one is reading history the archive still needs
    if (action === "remove") {
      const snap = await ref.get();
      if (!snap.exists) return NextResponse.json({ error: "Bu cüz artıq yoxdur." }, { status: 404 });
      if (snap.data()?.done) return NextResponse.json({ error: "Tamamlanmış cüz silinmir." }, { status: 409 });
      await ref.delete();
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
      });
      return null;
    });
    if (error) {
      return NextResponse.json({ error }, { status: 409 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in assignments API route:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
