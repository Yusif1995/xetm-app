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
// created, list all users, grant or revoke admin rights, delete a group. Runs with the Admin SDK, so firestore.rules stay closed.
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

    // Everyone who has signed up, with whether they are an admin, so the owner can pick one
    if (action === "users") {
      return NextResponse.json({ users: await listUsers(db) });
    }

    if (action === "grant") {
      const uid = body.uid;
      if (typeof uid !== "string" || !ID_PATTERN.test(uid)) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      if (!(await db.collection("users").doc(uid).get()).exists) {
        return NextResponse.json({ error: "Bu istifadəçi tapılmadı." }, { status: 404 });
      }
      await db.collection("admins").doc(uid).set({ grantedBy: ownerUid, grantedAt: new Date().toISOString() }, { merge: true });
      return NextResponse.json({ success: true });
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

interface UserEntry {
  uid: string;
  nickname: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

async function listUsers(db: Firestore): Promise<UserEntry[]> {
  const [usersSnap, adminSnap, privateSnap] = await Promise.all([
    db.collection("users").get(),
    db.collection("admins").get(),
    db.collectionGroup("private").get(),
  ]);
  const admins = new Set(adminSnap.docs.map((d) => d.id));
  // users/{uid}/private/profile holds the name and email
  const priv = new Map<string, Record<string, unknown>>();
  privateSnap.docs.forEach((d) => {
    const owner = d.ref.parent.parent;
    if (d.id === PRIVATE_DOC && owner?.parent.id === "users") priv.set(owner.id, d.data());
  });
  return usersSnap.docs
    .map((u) => {
      const p = priv.get(u.id) || {};
      const nickname = u.data().nickname;
      return {
        uid: u.id,
        nickname: typeof nickname === "string" ? nickname : "",
        name: typeof p.name === "string" ? p.name : "",
        email: typeof p.email === "string" ? p.email : "",
        isAdmin: admins.has(u.id),
      };
    })
    .sort((x, y) => (x.name || x.nickname || x.email).localeCompare(y.name || y.nickname || y.email));
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
