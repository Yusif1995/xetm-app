import { auth, db } from "./firebase";
import type { Assignment } from "./khatm.ts";
import type { ConversationKind, ThreadMessage, ThreadSummary } from "./threads";
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  collection, 
  getDocs, 
  query, 
  orderBy,
  serverTimestamp,
  deleteField,
  runTransaction,
  where,
  type DocumentData
} from "firebase/firestore";

export interface UserDoc {
  uid: string;
  name?: string; // Private: filled in for the signed-in user from users/{uid}/private/profile
  email?: string; // Legacy: now stored in users/{uid}/private/profile
  photoURL: string;
  role: "admin" | "user"; // Legacy, ignored: super admins are listed in admins/{uid}
  firstName?: string;
  lastName?: string;
  nickname?: string;
  isOnboarded?: boolean;
  groupId?: string;
  groupIds?: string[];
  assignedPages: number[];   // pages 1-604
  completedPages: number[];  // subset of assignedPages
  completedAt?: Record<string, string>; // pageNumber -> ISO timestamp string
  previousCompletedAt?: Record<string, string>;
  assignmentStartDate?: string; // YYYY-MM-DD
  assignmentEndDate?: string;   // YYYY-MM-DD
  assignedJuz?: number;         // 1-30
  assignedJuzs?: number[];      // Multiple Juzs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createdAt: any;
  approved?: boolean;
  adminNotification?: string; // Legacy, unused: messages now live in groupData[groupId].adminMessage
  previousAssignedPages?: number[];
  previousCompletedPages?: number[];
  previousStartDate?: string;
  previousEndDate?: string;
  pushSubscriptions?: string[]; // Legacy: now stored in users/{uid}/private/profile
  totalCompletedPages?: number;
  groupData?: Record<string, {
    approved?: boolean;
    assignedPages: number[];
    completedPages: number[];
    completedAt?: Record<string, string>;
    previousCompletedAt?: Record<string, string>;
    assignmentStartDate?: string;
    assignmentEndDate?: string;
    assignedJuz?: number;
    assignedJuzs?: number[];
    previousAssignedPages?: number[];
    previousCompletedPages?: number[];
    previousStartDate?: string;
    previousEndDate?: string;
    totalCompletedPages?: number;
    adminMessage?: GroupMessage;
  }>;
}

// A message from the group owner to one member
export interface GroupMessage {
  text: string;
  sentAt: string; // ISO timestamp
  read: boolean;
}

export function getUserGroupIds(user: UserDoc | null): string[] {
  if (!user) return [];
  const list = new Set<string>();
  if (user.groupId) {
    list.add(user.groupId);
  }
  if (user.groupIds && Array.isArray(user.groupIds)) {
    user.groupIds.forEach(id => {
      if (id) list.add(id);
    });
  }
  return Array.from(list);
}

export function isGroupOwner(user: UserDoc | null, group: GroupDoc | null | undefined): boolean {
  return !!user && !!group && group.createdBy === user.uid;
}

// Approval lives on the group doc (members map), which only the group owner can change.
export function isUserApprovedInGroup(user: UserDoc, groupId: string, group?: GroupDoc | null): boolean {
  const gId = groupId || "default";
  if (gId === "default") {
    return user.approved === true;
  }
  if (!group || group.id !== gId) return false;
  if (group.createdBy === user.uid) return true;
  const status = group.members?.[user.uid];
  return status === "owner" || status === "member";
}

export interface GroupDoc {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  lastDistributedJuz?: number;
  cycleStartJuz?: number;
  isCurrentKhatmCompleted?: boolean;
  completedKhatms?: number;
  members?: Record<string, GroupMemberStatus>;
  // True once members holds every member (new groups, or after the owner's backfill)
  membersBackfilled?: boolean;
  // Juz distribution rounds so far, and when each khatm was completed (set by the server)
  distributionCount?: number;
  lastDistribution?: { number: number; startDate: string; endDate: string; at: string };
  khatmCompletedAt?: Record<string, string>;
}

export type GroupMemberStatus = "owner" | "member" | "pending";

export interface AppSettings {
  currentAyah?: string;
  currentHadith?: string;
  dailyDate?: string; // YYYY-MM-DD (Baku): the saved ayah/hadith replace the automatic ones on that day only
  lastDistributedJuz?: number;
  cycleStartJuz?: number;
  completedKhatms?: number;
  isCurrentKhatmCompleted?: boolean;
  currentDailyItem?: {
    text: string;
    translation: string;
    source: string;
    type: "ayah" | "hadith";
  };
  lastDailyUpdate?: string;
}

// Group data for a group the user has just joined (no assignment yet)
function emptyGroupEntry() {
  return {
    approved: false,
    assignedPages: [],
    completedPages: [],
    completedAt: {},
    assignedJuz: null,
    assignedJuzs: [],
    previousAssignedPages: [],
    previousCompletedPages: [],
    previousStartDate: "",
    previousEndDate: "",
    totalCompletedPages: 0
  };
}

function toUserDoc(uid: string, data: DocumentData): UserDoc {
  const totalCompletedPages = data.totalCompletedPages !== undefined
    ? data.totalCompletedPages
    : ((data.completedPages?.length || 0) + (data.previousCompletedPages?.length || 0));
  return { uid, ...data, totalCompletedPages } as UserDoc;
}

// Fetch a single user by UID. Returns null only when the doc does not exist;
// read errors (e.g. "client is offline") are thrown, never reported as a missing user.
export async function fetchUserDoc(uid: string): Promise<UserDoc | null> {
  const docSnap = await getDoc(doc(db, "users", uid));
  return docSnap.exists() ? toUserDoc(uid, docSnap.data()) : null;
}

// Fetch a single user by UID (null on missing doc or error)
export async function getUserDoc(uid: string): Promise<UserDoc | null> {
  try {
    return await fetchUserDoc(uid);
  } catch (error) {
    console.error("Error in getUserDoc:", error);
    return null;
  }
}

// Create a new user doc on first login (role is "user" by default).
// Name and email go to the private doc; an invite is joined in a separate update.
export async function createUserDoc(
  uid: string,
  name: string,
  email: string,
  photoURL: string,
  inviteGroupId?: string
): Promise<UserDoc> {
  const docRef = doc(db, "users", uid);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newUser: Record<string, any> = {
    photoURL: photoURL || "",
    role: "user",
    groupId: "",
    groupIds: [],
    createdAt: serverTimestamp(),
    approved: false,
    isOnboarded: false, // Onboarding completes on OnboardingScreen
  };

  // The existence check runs inside a transaction against the server, so an existing
  // account is never overwritten (a cached/offline read can no longer look like "no user").
  const existing = await runTransaction(db, async (tx) => {
    const snap = await tx.get(docRef);
    if (snap.exists()) return toUserDoc(uid, snap.data());
    tx.set(docRef, newUser);
    return null;
  });
  if (existing) return existing;

  // Not critical for signing in; never let it block account creation
  await setDoc(privateDocRef(uid), { email: email || "", name: name || "" }, { merge: true }).catch((err) =>
    console.error("Error saving private profile:", err)
  );

  const created = { uid, ...newUser } as unknown as UserDoc;
  if (inviteGroupId) {
    await joinGroup(created, inviteGroupId);
    return (await getUserDoc(uid)) || created;
  }
  return created;
}

// Ask the server to recompute the group's khatm counters (members cannot write them)
export function refreshGroupProgress(groupId: string): void {
  if (!groupId || groupId === "default") return;
  auth.currentUser?.getIdToken()
    .then((idToken) => fetch("/api/group-progress", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ groupId })
    }))
    .catch((err) => console.error("Error refreshing group progress:", err));
}

// Users linked to a group (by groupIds). Much cheaper than reading every user.
export async function getGroupMembers(groupId: string): Promise<UserDoc[]> {
  if (!groupId || groupId === "default") return [];
  try {
    const snap = await getDocs(query(collection(db, "users"), where("groupIds", "array-contains", groupId)));
    return snap.docs.map((d) => toUserDoc(d.id, d.data()));
  } catch (error) {
    console.error("Error in getGroupMembers:", error);
    return [];
  }
}

// Get all users ordered by createdAt
export async function getAllUsers(): Promise<UserDoc[]> {
  try {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    const users: UserDoc[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const totalCompletedPages = data.totalCompletedPages !== undefined
        ? data.totalCompletedPages
        : ((data.completedPages?.length || 0) + (data.previousCompletedPages?.length || 0));
      users.push({ uid: doc.id, ...data, totalCompletedPages } as UserDoc);
    });
    return users;
  } catch (error) {
    console.error("Error in getAllUsers:", error);
    return [];
  }
}

// Approve (or move back to pending) a member of a group. Only the group owner can do this.
export async function updateUserApproval(uid: string, approved: boolean, groupId: string): Promise<void> {
  await updateDoc(doc(db, "groups", groupId), {
    [`members.${uid}`]: approved ? "member" : "pending"
  });
}

export function messageDocRef(groupId: string, uid: string) {
  return doc(db, "groups", groupId, "messages", uid);
}

// POST to one of our API routes as the signed-in user; throws with the server's readable reason
async function postAsUser<T>(path: string, body: Record<string, unknown>, fallbackError: string): Promise<T> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error("Hesabına yenidən daxil ol.");
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : fallbackError);
  return data as T;
}

// Group conversations, all through /api/messages (see src/lib/threads.ts for who may do what)
const MESSAGES_API = "/api/messages";

// One bulk message to many members of the group (leader, group admins, app owner)
export async function sendBroadcast(groupId: string, targetUids: string[], text: string): Promise<{ sent: number }> {
  return postAsUser(MESSAGES_API, { action: "send", groupId, kind: "broadcast", targetUids, text }, "Mesaj göndərilmədi.");
}

// One message in a conversation. `to` is the other person when the caller is the manager side
// (the leader writing to a member, the owner writing to someone); omitted when writing in your own.
export async function sendMessage(groupId: string, kind: ConversationKind, text: string, to?: string): Promise<void> {
  await postAsUser(MESSAGES_API, { action: "send", groupId, kind, text, ...(to ? { to } : {}) }, "Mesaj göndərilmədi.");
}

// Mark a conversation read for the caller's side (stamps the time the other side sees as ✓✓)
export async function markConversationRead(groupId: string, kind: ConversationKind, key: string): Promise<void> {
  await postAsUser(MESSAGES_API, { action: "read", groupId, kind, key }, "Oxundu kimi qeyd olunmadı.");
}

// Kept for the admin panel: the leader's thread with one member
export async function markThreadRead(groupId: string, memberUid: string): Promise<void> {
  await markConversationRead(groupId, "thread", memberUid);
}

export interface InboxPerson { uid: string; name: string; admin: boolean; openJuz?: number }
export interface InboxSummary extends ThreadSummary { uid: string; name?: string }
export interface InboxFeedItem { id: string; senderLabel: string; text: string; sentAt: string; count: number }
export interface Inbox {
  role: { owner: boolean; creator: boolean; admin: boolean; member: boolean };
  groupName: string;
  leader: InboxPerson | null;
  ownerContact: InboxPerson | null;
  members?: InboxPerson[];
  feed?: InboxFeedItem[];
  bulk?: InboxSummary[];
  ownerChats?: InboxSummary[];
}

export function loadInbox(groupId: string): Promise<Inbox> {
  return postAsUser(MESSAGES_API, { action: "inbox", groupId }, "Mesajlar yüklənmədi.");
}

export function loadConversation(groupId: string, kind: ConversationKind, key: string): Promise<{ summary: ThreadSummary | null; messages: ThreadMessage[] }> {
  return postAsUser(MESSAGES_API, { action: "messages", groupId, kind, key }, "Yazışma yüklənmədi.");
}

// Copy the group's finished khatms and distributions into its archive (server side, idempotent)
export async function syncGroupArchive(groupId: string): Promise<{ created: number }> {
  return postAsUser("/api/archive", { groupId }, "Arxiv yenilənmədi.");
}

// The member marks the owner's message in this group as read (legacy single message)
export async function markMemberMessageRead(uid: string, groupId: string): Promise<void> {
  await updateDoc(messageDocRef(groupId, uid), { read: true });
}

// Private per-user data (email, names, push subscriptions); only the user can read it
export function privateDocRef(uid: string) {
  return doc(db, "users", uid, "private", "profile");
}

export interface PrivateProfile {
  email?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
}

// Publish the user's full name to each group they belong to, where only the group owner can read it
export async function publishProfileToGroups(uid: string, name: string, groupIds: string[]): Promise<void> {
  if (!name) return;
  await Promise.all(
    groupIds
      .filter((g) => g && g !== "default")
      .map((g) => setDoc(doc(db, "groups", g, "profiles", uid), { name }).catch((err) =>
        console.error("Error publishing profile to group", g, err)
      ))
  );
}

export async function addPushSubscription(uid: string, subscription: string): Promise<void> {
  await setDoc(privateDocRef(uid), { pushSubscriptions: arrayUnion(subscription) }, { merge: true });
}

export async function removePushSubscription(uid: string, subscription: string): Promise<void> {
  await setDoc(privateDocRef(uid), { pushSubscriptions: arrayRemove(subscription) }, { merge: true });
}

// Move email, names and push subscriptions left on the public user doc into the private doc
export async function migrateOwnPrivateData(user: UserDoc): Promise<void> {
  const legacyKeys = ["email", "pushSubscriptions", "name", "firstName", "lastName"] as const;
  if (!legacyKeys.some((k) => user[k] !== undefined)) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const privateData: Record<string, any> = {};
  if (user.email) privateData.email = user.email;
  if (user.name) privateData.name = user.name;
  if (user.firstName) privateData.firstName = user.firstName;
  if (user.lastName) privateData.lastName = user.lastName;
  if (user.pushSubscriptions && user.pushSubscriptions.length > 0) {
    privateData.pushSubscriptions = arrayUnion(...user.pushSubscriptions);
  }
  if (Object.keys(privateData).length > 0) {
    await setDoc(privateDocRef(user.uid), privateData, { merge: true });
  }
  if (user.name) {
    await publishProfileToGroups(user.uid, user.name, user.groupIds || []);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const removals: Record<string, any> = {};
  legacyKeys.forEach((k) => { removals[k] = deleteField(); });
  await updateDoc(doc(db, "users", user.uid), removals);
}

// ---------- "X oxudu" notices to the group, one per reading session ----------
// Marked pages wait here, unmarked ones leave again, and the batch goes out as one notice after
// a quiet spell (or when the app is closed or hidden). The server re-checks that every page is
// still marked before telling anyone, so a mistaken tap that was undone is never announced.
const READ_NOTICE_DELAY_MS = 45 * 1000;
const pendingReads = new Map<string, Set<number>>(); // groupId -> pages
let readNoticeTimer: ReturnType<typeof setTimeout> | null = null;
let readNoticeListening = false;

function flushReadNotices(keepalive = false): void {
  if (readNoticeTimer) clearTimeout(readNoticeTimer);
  readNoticeTimer = null;
  const batches = Array.from(pendingReads.entries()).filter(([, pages]) => pages.size > 0);
  pendingReads.clear();
  if (batches.length === 0) return;
  auth.currentUser?.getIdToken()
    .then((idToken) => Promise.all(batches.map(([groupId, pages]) => fetch("/api/send-push", {
      method: "POST",
      keepalive,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ groupId, pageNumbers: Array.from(pages) }),
    }))))
    .catch((err) => console.error("Error sending the reading notice:", err));
}

function queueReadNotice(groupId: string, pages: number[], read: boolean): void {
  if (!groupId || groupId === "default" || typeof window === "undefined") return;
  const set = pendingReads.get(groupId) || new Set<number>();
  pages.forEach((p) => (read ? set.add(p) : set.delete(p)));
  if (set.size > 0) pendingReads.set(groupId, set);
  else pendingReads.delete(groupId);

  if (!readNoticeListening) {
    readNoticeListening = true;
    // Leaving the app sends what is waiting instead of losing it
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushReadNotices(true);
    });
    window.addEventListener("pagehide", () => flushReadNotices(true));
  }

  if (readNoticeTimer) clearTimeout(readNoticeTimer);
  readNoticeTimer = pendingReads.size > 0 ? setTimeout(() => flushReadNotices(), READ_NOTICE_DELAY_MS) : null;
}

// Get group settings (backwards compatible with default settings/config)
export async function getGroupSettings(groupId?: string | null): Promise<AppSettings> {
  try {
    const effectiveGroupId = groupId || "default";
    if (effectiveGroupId === "default") {
      const docRef = doc(db, "settings", "config");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as AppSettings;
      }
      return {
        currentAyah: "İnna lilləhi və inna ileyhi raciun",
        currentHadith: "Sizin ən xeyirliniz Quranı öyrənən və onu başqalarına öyrədəndir."
      };
    } else {
      const docRef = doc(db, "groups", effectiveGroupId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          currentAyah: data.currentAyah || "İnna lilləhi və inna ileyhi raciun",
          currentHadith: data.currentHadith || "Sizin ən xeyirliniz Quranı öyrənən və onu başqalarına öyrədəndir.",
          lastDistributedJuz: data.lastDistributedJuz || 0,
          cycleStartJuz: data.cycleStartJuz || 1,
          completedKhatms: data.completedKhatms || 0,
          isCurrentKhatmCompleted: data.isCurrentKhatmCompleted || false,
          currentDailyItem: data.currentDailyItem,
          lastDailyUpdate: data.lastDailyUpdate
        } as AppSettings;
      }
      return {
        currentAyah: "İnna lilləhi və inna ileyhi raciun",
        currentHadith: "Sizin ən xeyirliniz Quranı öyrənən və onu başqalarına öyrədəndir.",
        lastDistributedJuz: 0,
        cycleStartJuz: 1,
        completedKhatms: 0,
        isCurrentKhatmCompleted: false
      };
    }
  } catch (error) {
    console.error("Error in getGroupSettings:", error);
    return {};
  }
}

// Set group settings
export async function setGroupSettings(settings: AppSettings, groupId?: string | null): Promise<void> {
  const effectiveGroupId = groupId || "default";
  if (effectiveGroupId === "default") {
    const docRef = doc(db, "settings", "config");
    await setDoc(docRef, settings, { merge: true });
  } else {
    const docRef = doc(db, "groups", effectiveGroupId);
    await setDoc(docRef, settings, { merge: true });
  }
}

// Fetch a single group document by ID
export async function getGroupDoc(groupId: string): Promise<GroupDoc | null> {
  if (!groupId) return null;
  try {
    const docRef = doc(db, "groups", groupId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as GroupDoc;
    }
    return null;
  } catch (error) {
    console.error("Error in getGroupDoc:", error);
    return null;
  }
}

// Create a new group owned by the signed-in user. Only app admins may; the server checks and
// creates it. Throws with a readable reason otherwise.
export async function createGroup(name: string): Promise<string> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error("Hesabına yenidən daxil ol.");
  const res = await fetch("/api/create-group", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ name })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.groupId !== "string") {
    throw new Error(typeof data.error === "string" ? data.error : "Qrup yaradılmadı.");
  }
  return data.groupId;
}

// Ask to join a group: adds the user to the group's members map as pending.
// Existing entries (owner, approved member, pending) are left untouched.
export async function requestGroupMembership(uid: string, groupId: string): Promise<void> {
  const group = await getGroupDoc(groupId);
  if (!group) return;
  if (group.createdBy === uid || group.members?.[uid]) return;
  await updateDoc(doc(db, "groups", groupId), {
    [`members.${uid}`]: "pending"
  });
  notifyOwnerOfJoinRequest(groupId);
}

// Push to the group owner that a request is waiting. Fire and forget: joining never waits on it.
function notifyOwnerOfJoinRequest(groupId: string): void {
  auth.currentUser?.getIdToken()
    .then((idToken) => fetch("/api/notify-join-request", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ groupId }),
    }))
    .catch((err) => console.error("Could not notify the group owner:", err));
}

// Groups whose members map lists this user (owner, approved member or pending)
export async function getMyGroupMemberships(uid: string): Promise<GroupDoc[]> {
  const q = query(collection(db, "groups"), where(`members.${uid}`, "in", ["owner", "member", "pending"]));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as GroupDoc));
}

// Re-link groups the user belongs to (per the group docs) but that are missing from their
// user doc, e.g. after the doc was recreated. Returns the user doc, updated if anything changed.
export async function restoreGroupMemberships(user: UserDoc): Promise<UserDoc> {
  const groups = await getMyGroupMemberships(user.uid);
  const currentIds = user.groupIds || [];
  const missing = groups.filter((g) => !currentIds.includes(g.id));
  const activeIsValid = !!user.groupId && groups.some((g) => g.id === user.groupId);
  if (missing.length === 0 && (activeIsValid || groups.length === 0)) return user;

  // Rules allow one group's data per write
  for (const g of missing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entry: Record<string, any> = { groupIds: arrayUnion(g.id), selfEditedGroup: g.id };
    if (!user.groupData?.[g.id]) entry[`groupData.${g.id}`] = emptyGroupEntry();
    await updateDoc(doc(db, "users", user.uid), entry);
  }
  if (!activeIsValid && groups.length > 0) {
    const preferred = groups.find((g) => g.members?.[user.uid] !== "pending") || groups[0];
    await updateDoc(doc(db, "users", user.uid), { groupId: preferred.id });
  }
  return (await getUserDoc(user.uid)) || user;
}

// Join a group from an invite link. Progress in a group the user already belongs to is kept.
export async function joinGroup(user: UserDoc, groupId: string): Promise<void> {
  const { arrayUnion } = await import("firebase/firestore");
  const docRef = doc(db, "users", user.uid);
  const alreadyMember = (user.groupIds || []).includes(groupId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = { groupId };
  if (!alreadyMember) {
    updates.groupIds = arrayUnion(groupId);
  }
  if (!user.groupData?.[groupId]) {
    updates[`groupData.${groupId}`] = emptyGroupEntry();
    updates.selfEditedGroup = groupId;
  }
  await updateDoc(docRef, updates);
  await requestGroupMembership(user.uid, groupId);
  if (user.name) {
    await publishProfileToGroups(user.uid, user.name, [groupId]);
  }
}

// Remove a user from a group (used by the group owner to reject or remove a member)
export async function removeUserFromGroup(user: UserDoc, groupId: string): Promise<void> {
  const { writeBatch, deleteField } = await import("firebase/firestore");
  const remainingGroupIds = (user.groupIds || []).filter((id) => id !== groupId);
  const batch = writeBatch(db);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userUpdates: Record<string, any> = {
    groupIds: remainingGroupIds,
    [`groupData.${groupId}`]: deleteField(),
    lastEditedGroup: groupId
  };
  if (user.groupId === groupId) {
    userUpdates.groupId = remainingGroupIds[0] || "";
  }
  batch.update(doc(db, "users", user.uid), userUpdates);
  batch.update(doc(db, "groups", groupId), {
    [`members.${user.uid}`]: deleteField()
  });
  await batch.commit();
}

// The user leaves a group they belong to (not allowed for the owner)
export async function leaveGroup(user: UserDoc, groupId: string): Promise<void> {
  const { writeBatch } = await import("firebase/firestore");
  const remainingGroupIds = (user.groupIds || []).filter((id) => id !== groupId);
  const batch = writeBatch(db);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userUpdates: Record<string, any> = {
    groupIds: remainingGroupIds,
    [`groupData.${groupId}`]: deleteField(),
    selfEditedGroup: groupId
  };
  if (user.groupId === groupId) {
    userUpdates.groupId = remainingGroupIds[0] || "";
  }
  batch.update(doc(db, "users", user.uid), userUpdates);
  batch.update(doc(db, "groups", groupId), {
    [`members.${user.uid}`]: deleteField()
  });
  await batch.commit();
}

// Fill in the members map for groups created before it existed.
// Must be run by the group owner; existing entries are kept.
export async function backfillGroupMembers(group: GroupDoc, users: UserDoc[]): Promise<void> {
  if (group.membersBackfilled) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = { membersBackfilled: true };
  if (!group.members?.[group.createdBy]) {
    updates[`members.${group.createdBy}`] = "owner";
  }
  users.forEach((u) => {
    if (u.uid === group.createdBy || group.members?.[u.uid]) return;
    if (!getUserGroupIds(u).includes(group.id)) return;
    updates[`members.${u.uid}`] = u.groupData?.[group.id]?.approved === true ? "member" : "pending";
  });
  await updateDoc(doc(db, "groups", group.id), updates);
}

// Delete a group and clean up user documents
export async function deleteGroup(groupId: string): Promise<void> {
  if (!groupId) return;
  const { writeBatch, deleteField } = await import("firebase/firestore");

  // Member cleanup and the group delete go in one batch: the rules check group ownership
  // against the group doc, so it has to still exist while members are updated.
  const users = await getAllUsers();
  const batch = writeBatch(db);

  for (const u of users) {
    const userGroupIds = u.groupIds || [];
    const hasGroup = userGroupIds.includes(groupId) || u.groupId === groupId || (u.groupData && u.groupData[groupId]);
    if (!hasGroup) continue;

    const newGroupIds = userGroupIds.filter(id => id !== groupId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = {
      groupIds: newGroupIds,
      [`groupData.${groupId}`]: deleteField(),
      lastEditedGroup: groupId
    };

    if (u.groupId === groupId) {
      updates.groupId = newGroupIds.length > 0 ? newGroupIds[0] : "";
      if (newGroupIds.length === 0) {
        updates.isOnboarded = false;
      }
    }

    batch.update(doc(db, "users", u.uid), updates);
  }

  batch.delete(doc(db, "groups", groupId));
  await batch.commit();
}

// ---------- Juz assignments (groups/{groupId}/assignments) ----------

export function assignmentsCol(groupId: string) {
  return collection(db, "groups", groupId, "assignments");
}

export async function getGroupAssignments(groupId: string): Promise<Assignment[]> {
  const snap = await getDocs(assignmentsCol(groupId));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Assignment));
}

// "Bismillah · Sizin üçün Cüz N təyin edildi" push to each new holder. Fire and forget:
// handing out juz never waits on notifications.
function notifyNewAssignments(groupId: string, assignmentIds: string[], skippedUids: string[] = []): void {
  if (assignmentIds.length === 0 && skippedUids.length === 0) return;
  auth.currentUser?.getIdToken()
    .then((idToken) => fetch("/api/notify-assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ groupId, assignmentIds, skippedUids }),
    }))
    .catch((err) => console.error("Could not notify members about their juz:", err));
}

export interface DistributionResult {
  distribution: number;
  assigned: number;
  skipped: string[];
}

// Manager: hand one juz to every approved member who is not behind, in random order.
// Members with too many unfinished juz are skipped; the sequence continues into the next khatm.
export async function distributeJuz(
  groupId: string,
  memberUids: string[],
  startDate: string,
  endDate: string
): Promise<DistributionResult> {
  const r = await manageAssignment<DistributionResult & { assignmentIds: string[] }>(
    groupId, { action: "distribute", memberUids, startDate, endDate }, "Paylanma alınmadı."
  );
  notifyNewAssignments(groupId, r.assignmentIds, r.skipped);
  return { distribution: r.distribution, assigned: r.assigned, skipped: r.skipped };
}

// Manager: give a specific free juz of a khatm to a member (counts as the current distribution)
export async function assignJuzManually(
  groupId: string,
  uid: string,
  khatm: number,
  juz: number,
  startDate: string,
  endDate: string
): Promise<void> {
  const r = await manageAssignment<{ assignmentId: string }>(
    groupId, { action: "assign", to: uid, khatm, juz, startDate, endDate }, "Cüz təyin olunmadı."
  );
  notifyNewAssignments(groupId, [r.assignmentId]);
}

// Changes a manager (group creator or app admin) makes to the group's juz go through the server:
// the rules let only the creator write assignments, and app admins run groups they did not create.
// The server also recomputes the group's khatm progress afterwards.
async function manageAssignment<T = unknown>(groupId: string, body: Record<string, unknown>, fallback: string): Promise<T> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error("Hesabına yenidən daxil ol.");
  const res = await fetch("/api/assignments", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ groupId, ...body })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(typeof data.error === "string" && res.status !== 500 && res.status !== 403 ? data.error : fallback);
  }
  return res.json() as Promise<T>;
}

// Pages already read stay credited to the old holder
export async function transferAssignment(groupId: string, a: Assignment, newUid: string): Promise<void> {
  if (newUid === a.uid) return;
  await manageAssignment(groupId, { action: "transfer", assignmentId: a.id, to: newUid }, "Cüzü ötürmək alınmadı.");
  // The new holder hears about it like any other assignment
  notifyNewAssignments(groupId, [a.id]);
}

// Give some unread pages of a juz to a friend; the juz stays with its holder and is credited to them
export async function giveHelpPages(groupId: string, a: Assignment, helperUid: string, pages: number[]): Promise<void> {
  await manageAssignment(groupId, { action: "help", assignmentId: a.id, to: helperUid, pages }, "Səhifələri vermək alınmadı.");
}

// Take back the pages the friend has not read yet
export async function takeBackHelpPages(groupId: string, a: Assignment, helperUid: string): Promise<void> {
  await manageAssignment(groupId, { action: "unhelp", assignmentId: a.id, to: helperUid }, "Səhifələri geri almaq alınmadı.");
}

// The friend marks (or unmarks) pages they were given to read
export async function markHelpPages(groupId: string, assignmentId: string, pages: number[], read: boolean): Promise<void> {
  await manageAssignment(groupId, { action: "helpRead", assignmentId, pages, read }, read ? "Səhifə qeyd olunmadı." : "Səhifə geri qaytarılmadı.");
}

export async function removeAssignment(groupId: string, assignmentId: string): Promise<void> {
  await manageAssignment(groupId, { action: "remove", assignmentId }, "Təyinatı silmək alınmadı.");
}

// Holder marks/unmarks pages of their juz. Runs in a transaction so "done" always matches the pages.
export async function toggleAssignmentPages(
  groupId: string,
  assignmentId: string,
  pageNumbers: number[],
  isCompleted: boolean
): Promise<void> {
  const ref = doc(assignmentsCol(groupId), assignmentId);
  const timestamp = new Date().toISOString();

  const result = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return null;
    const a = snap.data() as Assignment;
    const current = new Set(a.completedPages || []);
    const changed = pageNumbers.filter((p) => a.pages.includes(p) && (isCompleted ? !current.has(p) : current.has(p)));
    if (changed.length === 0) return null;

    changed.forEach((p) => (isCompleted ? current.add(p) : current.delete(p)));
    const completedPages = Array.from(current).sort((x, y) => x - y);
    const done = completedPages.length === a.pages.length;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = {
      completedPages,
      done,
      doneAt: done ? (a.doneAt || timestamp) : null
    };
    changed.forEach((p) => {
      updates[`completedAt.${p}`] = isCompleted ? timestamp : deleteField();
    });
    tx.update(ref, updates);
    return { uid: a.uid, changed };
  });

  if (!result) return;
  refreshGroupProgress(groupId);
  queueReadNotice(groupId, result.changed, isCompleted);
}

// Manager: delete every assignment of the group and start counting from scratch
export async function resetGroupAssignments(groupId: string): Promise<void> {
  await manageAssignment(groupId, { action: "reset" }, "Təmizləmə alınmadı.");
}
