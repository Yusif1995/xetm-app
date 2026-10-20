import { NextRequest, NextResponse } from "next/server";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { verifyRequestOwner, isRateLimited } from "@/lib/serverAuth";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { PRIVATE_DOC } from "@/lib/privateData";

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

interface AdminGroup {
  id: string;
  name: string;
  members: number;
  pending: number;
}

interface AdminEntry {
  uid: string;
  nickname: string;
  name: string;
  email: string;
  isSelf: boolean;
  groups: AdminGroup[];
}

// App owner tools (OWNER_EMAIL only): list the app admins (admins/{uid}) with the groups they
// created, revoke an admin, delete a group. Runs with the Admin SDK, so firestore.rules stay closed.
export async function POST(req: NextRequest) {
  try {
    const ownerUid = await verifyRequestOwner(req);
    if (!ownerUid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (isRateLimited(`owner:${ownerUid}`, 120, 10 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server is not configured" }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    // Lets the settings panel show the "Sistem idarəsi" entry to the owner only
    if (action === "check") {
      return NextResponse.json({ owner: true });
    }

    if (action === "list") {
      return NextResponse.json({ admins: await listAdmins(db, ownerUid) });
    }

    if (action === "revoke") {
      const uid = body.uid;
      if (typeof uid !== "string" || !ID_PATTERN.test(uid)) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      if (uid === ownerUid) {
        return NextResponse.json({ error: "Öz adminliyini götürə bilməzsən." }, { status: 400 });
      }
      await db.collection("admins").doc(uid).delete();
      return NextResponse.json({ success: true });
    }

    if (action === "deleteGroup") {
      const groupId = body.groupId;
      if (typeof groupId !== "string" || !ID_PATTERN.test(groupId)) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      const ref = db.collection("groups").doc(groupId);
      if (!(await ref.get()).exists) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      await removeGroupFromMembers(db, groupId);
      // The group and everything under it: assignments, messages, profiles
      await db.recursiveDelete(ref);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Error in owner API route:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

async function listAdmins(db: Firestore, ownerUid: string): Promise<AdminEntry[]> {
  const adminSnap = await db.collection("admins").get();
  const entries = await Promise.all(adminSnap.docs.map(async (a): Promise<AdminEntry> => {
    const uid = a.id;
    const [userSnap, privateSnap, groupsSnap] = await Promise.all([
      db.collection("users").doc(uid).get(),
      db.collection("users").doc(uid).collection("private").doc(PRIVATE_DOC).get(),
      db.collection("groups").where("createdBy", "==", uid).get(),
    ]);
    const priv = privateSnap.data() || {};
    const groups = groupsSnap.docs.map((g) => {
      const data = g.data();
      const statuses = Object.values((data.members || {}) as Record<string, string>);
      return {
        id: g.id,
        name: typeof data.name === "string" ? data.name : "Qrup",
        members: statuses.filter((s) => s === "owner" || s === "member").length,
        pending: statuses.filter((s) => s === "pending").length,
      };
    });
    return {
      uid,
      nickname: typeof userSnap.data()?.nickname === "string" ? userSnap.data()!.nickname : "",
      name: typeof priv.name === "string" ? priv.name : "",
      email: typeof priv.email === "string" ? priv.email : "",
      isSelf: uid === ownerUid,
      groups,
    };
  }));
  // You first, then by name
  return entries.sort((x, y) => Number(y.isSelf) - Number(x.isSelf) || (x.name || x.nickname).localeCompare(y.name || y.nickname));
}

// Same cleanup the client did when an owner deleted their group: drop the group from every
// member's user doc, and send members left with no group back to onboarding
async function removeGroupFromMembers(db: Firestore, groupId: string): Promise<void> {
  const [byIds, byActive] = await Promise.all([
    db.collection("users").where("groupIds", "array-contains", groupId).get(),
    db.collection("users").where("groupId", "==", groupId).get(),
  ]);
  const docs = new Map([...byIds.docs, ...byActive.docs].map((d) => [d.id, d]));
  let batch = db.batch();
  let count = 0;
  for (const d of Array.from(docs.values())) {
    const data = d.data();
    const remaining = ((data.groupIds || []) as string[]).filter((id) => id !== groupId);
    const updates: Record<string, unknown> = {
      groupIds: remaining,
      [`groupData.${groupId}`]: FieldValue.delete(),
    };
    if (data.groupId === groupId) {
      updates.groupId = remaining[0] || "";
      if (remaining.length === 0) updates.isOnboarded = false;
    }
    batch.update(d.ref, updates);
    if (++count % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  await batch.commit();
}
