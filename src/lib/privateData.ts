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

const PRIVATE_FIELDS = ["email", "pushSubscriptions", "name", "firstName", "lastName"] as const;

// Move everything private off the public user doc:
// - email, names and push subscriptions -> users/{uid}/private/profile
// - full name -> groups/{gid}/profiles/{uid} for each group (readable by the group owner)
// - owner messages in groupData[gid].adminMessage -> groups/{gid}/messages/{uid}
// - the unused legacy adminNotification field is dropped
// Returns true if the public doc had anything to move.
export async function migrateUserPrivateData(db: Firestore, uid: string): Promise<boolean> {
  const userRef = db.collection("users").doc(uid);
  const privateRef = userRef.collection("private").doc(PRIVATE_DOC);
  return db.runTransaction(async (tx) => {
    const [snap, privateSnap] = await Promise.all([tx.get(userRef), tx.get(privateRef)]);
    if (!snap.exists) return false;
    const data = snap.data() || {};
    const privateData = privateSnap.exists ? privateSnap.data() || {} : {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const privateUpdate: Record<string, any> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const publicUpdate: Record<string, any> = {};

    for (const field of PRIVATE_FIELDS) {
      if (!(field in data)) continue;
      publicUpdate[field] = FieldValue.delete();
      const value = data[field];
      if (field === "pushSubscriptions") {
        if (Array.isArray(value) && value.length > 0) privateUpdate.pushSubscriptions = FieldValue.arrayUnion(...value);
      } else if (typeof value === "string" && value && !privateData[field]) {
        privateUpdate[field] = value;
      }
    }
    if ("adminNotification" in data) publicUpdate.adminNotification = FieldValue.delete();

    const groupData = (data.groupData || {}) as Record<string, { adminMessage?: unknown }>;
    for (const [groupId, entry] of Object.entries(groupData)) {
      if (entry && typeof entry === "object" && "adminMessage" in entry) {
        if (entry.adminMessage) {
          tx.set(db.collection("groups").doc(groupId).collection("messages").doc(uid), entry.adminMessage as object);
        }
        publicUpdate[`groupData.${groupId}.adminMessage`] = FieldValue.delete();
      }
    }

    const fullName = (privateData.name || data.name || "") as string;
    const groupIds: string[] = Array.isArray(data.groupIds) ? data.groupIds : [];
    if (fullName) {
      for (const groupId of groupIds) {
        tx.set(db.collection("groups").doc(groupId).collection("profiles").doc(uid), { name: fullName });
      }
    }

    if (Object.keys(privateUpdate).length > 0) {
      tx.set(privateRef, privateUpdate, { merge: true });
    }
    if (Object.keys(publicUpdate).length === 0) return false;
    tx.update(userRef, publicUpdate);
    return true;
  });
}

// The AI assistant is for group owners and super admins
export async function canUseAssistant(db: Firestore, uid: string): Promise<boolean> {
  const [adminSnap, ownedSnap] = await Promise.all([
    db.collection("admins").doc(uid).get(),
    db.collection("groups").where("createdBy", "==", uid).limit(1).get(),
  ]);
  return adminSnap.exists || !ownedSnap.empty;
}

// Display name for push texts: nickname first (public), then the private full name
export async function senderDisplayName(db: Firestore, uid: string): Promise<string> {
  const userSnap = await db.collection("users").doc(uid).get();
  const nickname = userSnap.data()?.nickname;
  if (typeof nickname === "string" && nickname) return nickname;
  const privateSnap = await db.collection("users").doc(uid).collection("private").doc(PRIVATE_DOC).get();
  const name = privateSnap.data()?.name;
  return typeof name === "string" && name ? name : "Bir iştirakçı";
}
