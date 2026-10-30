import { NextRequest, NextResponse } from "next/server";
import type { Firestore } from "firebase-admin/firestore";
import { verifyRequestUser, isRateLimited } from "@/lib/serverAuth";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { getGroupInfo, getMemberNames } from "@/lib/privateData";
import { buildArchive } from "@/lib/archive";
import type { Assignment } from "@/lib/khatm";

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

// Copies every finished khatm and distribution of a group into groups/{gid}/archive as a
// self-contained record. A record is written once and never changed, so it survives later resets
// of the assignments. Called by the group's managers (creator or app admin) when they open the
// archive and right before they reset the assignments.
export async function POST(req: NextRequest) {
  try {
    const uid = await verifyRequestUser(req);
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (isRateLimited(`archive:${uid}`, 60, 10 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    const body = await req.json().catch(() => ({}));
    const groupId = body?.groupId;
    if (typeof groupId !== "string" || !ID_PATTERN.test(groupId)) {
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

    const created = await syncGroupArchive(db, groupId, group.name);
    return NextResponse.json({ success: true, created });
  } catch (error) {
    console.error("Error in archive API route:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

async function syncGroupArchive(db: Firestore, groupId: string, groupName: string): Promise<number> {
  const groupRef = db.collection("groups").doc(groupId);
  const [assignmentSnap, archiveRefs] = await Promise.all([
    groupRef.collection("assignments").get(),
    groupRef.collection("archive").listDocuments(),
  ]);
  // doneAt is written by the member's own client, and archive records are permanent, so a time
  // before the juz was handed out or in the future is not trusted
  const now = new Date().toISOString();
  const assignments = assignmentSnap.docs.map((d) => {
    const a = { id: d.id, ...d.data() } as Assignment;
    const valid = typeof a.doneAt === "string" && !Number.isNaN(Date.parse(a.doneAt)) && a.doneAt >= (a.createdAt || "") && a.doneAt <= now;
    return valid ? a : { ...a, doneAt: null };
  });
  const existing = new Set(archiveRefs.map((r) => r.id));

  const uids = new Set<string>();
  assignments.forEach((a) => {
    uids.add(a.uid);
    (a.previousHolders || []).forEach((h) => uids.add(h.uid));
  });
  const names = await getMemberNames(db, groupId, Array.from(uids));
  const records = buildArchive(assignments, (u) => names.get(u) || "Keçmiş üzv").filter((r) => !existing.has(r.id));
  if (records.length === 0) return 0;

  const archivedAt = new Date().toISOString();
  for (let i = 0; i < records.length; i += 400) {
    const batch = db.batch();
    records.slice(i, i + 400).forEach((r) => batch.set(groupRef.collection("archive").doc(r.id), { ...r, groupName, archivedAt }));
    await batch.commit();
  }
  return records.length;
}

