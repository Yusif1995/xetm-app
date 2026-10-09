// Server-side access to users' private data (email, push subscriptions) stored in
// users/{uid}/private/profile, which security rules only expose to the user themselves.
import { FieldValue, type Firestore } from "firebase-admin/firestore";

export const PRIVATE_DOC = "profile";

type MemberStatus = "owner" | "member" | "pending";

export interface GroupInfo {
  name: string;
  createdBy: string;
  members: Record<string, MemberStatus>;
}

export async function getGroupInfo(db: Firestore, groupId: string): Promise<GroupInfo | null> {
  const snap = await db.collection("groups").doc(groupId).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  return {
    name: typeof data.name === "string" ? data.name : "Qrup",
    createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
    members: (data.members || {}) as Record<string, MemberStatus>,
  };
}

export function isApprovedMember(group: GroupInfo, uid: string): boolean {
  if (group.createdBy === uid) return true;
  const status = group.members[uid];
  return status === "owner" || status === "member";
}

export async function getPushSubscriptions(db: Firestore, uid: string): Promise<string[]> {
  const snap = await db.collection("users").doc(uid).collection("private").doc(PRIVATE_DOC).get();
  const subs = snap.exists ? snap.data()?.pushSubscriptions : null;
  return Array.isArray(subs) ? subs.filter((s): s is string => typeof s === "string") : [];
}

// Subscriptions of every approved member of the group except `excludeUid`, keyed by uid
export async function getGroupPushTargets(
  db: Firestore,
  groupId: string,
  group: GroupInfo,
  excludeUid: string
): Promise<Map<string, string[]>> {
  const membersSnap = await db.collection("users").where("groupIds", "array-contains", groupId).get();
  const uids = membersSnap.docs.map((d) => d.id).filter((uid) => uid !== excludeUid && isApprovedMember(group, uid));
  const entries = await Promise.all(uids.map(async (uid) => [uid, await getPushSubscriptions(db, uid)] as const));
  return new Map(entries.filter(([, subs]) => subs.length > 0));
}

export async function removePushSubscriptions(db: Firestore, uid: string, subscriptions: string[]): Promise<void> {
  if (subscriptions.length === 0) return;
  await db.collection("users").doc(uid).collection("private").doc(PRIVATE_DOC).set(
    { pushSubscriptions: FieldValue.arrayRemove(...subscriptions) },
    { merge: true }
  );
}

// Move email / pushSubscriptions from the public user doc into the private doc.
// Returns true if the user doc had anything to move.
export async function migrateUserPrivateData(db: Firestore, uid: string): Promise<boolean> {
  const userRef = db.collection("users").doc(uid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) return false;
    const data = snap.data() || {};
    const hasEmail = "email" in data;
    const subs: string[] = Array.isArray(data.pushSubscriptions) ? data.pushSubscriptions : [];
    if (!hasEmail && !("pushSubscriptions" in data)) return false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const privateUpdate: Record<string, any> = {};
    if (hasEmail && data.email) privateUpdate.email = data.email;
    if (subs.length > 0) privateUpdate.pushSubscriptions = FieldValue.arrayUnion(...subs);
    if (Object.keys(privateUpdate).length > 0) {
      tx.set(userRef.collection("private").doc(PRIVATE_DOC), privateUpdate, { merge: true });
    }
    tx.update(userRef, { email: FieldValue.delete(), pushSubscriptions: FieldValue.delete() });
    return true;
  });
}
