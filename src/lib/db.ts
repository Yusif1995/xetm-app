import { db } from "./firebase";
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
  deleteDoc
} from "firebase/firestore";

export interface UserDoc {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  role: "admin" | "user";
  assignedPages: number[];   // pages 1-604
  completedPages: number[];  // subset of assignedPages
  completedAt?: Record<string, string>; // pageNumber -> ISO timestamp string
  assignmentStartDate?: string; // YYYY-MM-DD
  assignmentEndDate?: string;   // YYYY-MM-DD
  assignedJuz?: number;         // 1-30
  assignedJuzs?: number[];      // Multiple Juzs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createdAt: any;
  approved?: boolean;
  adminNotification?: string;
  previousAssignedPages?: number[];
  previousCompletedPages?: number[];
  previousStartDate?: string;
  previousEndDate?: string;
  pushSubscriptions?: string[];
  totalCompletedPages?: number;
}

export interface AppSettings {
  currentAyah?: string;
  currentHadith?: string;
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

// Fetch a single user by UID
export async function getUserDoc(uid: string): Promise<UserDoc | null> {
  try {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const totalCompletedPages = data.totalCompletedPages !== undefined
        ? data.totalCompletedPages
        : ((data.completedPages?.length || 0) + (data.previousCompletedPages?.length || 0));
      return { uid, ...data, totalCompletedPages } as UserDoc;
    }
    return null;
  } catch (error) {
    console.error("Error in getUserDoc:", error);
    return null;
  }
}

// Create a new user doc on first login (role is "user" by default)
export async function createUserDoc(
  uid: string, 
  name: string, 
  email: string, 
  photoURL: string
): Promise<UserDoc> {
  const docRef = doc(db, "users", uid);
  const existingDoc = await getUserDoc(uid);
  
  if (existingDoc) {
    return existingDoc;
  }

  const usersList = await getAllUsers();
  const isFirstUser = usersList.length === 0;

  const newUser = {
    name: name || "Qonaq",
    email: email || "",
    photoURL: photoURL || "",
    role: (isFirstUser ? "admin" : "user") as "admin" | "user",
    assignedPages: [],
    completedPages: [],
    createdAt: serverTimestamp(),
    approved: true,
    totalCompletedPages: 0,
  };

  await setDoc(docRef, newUser);
  return { uid, ...newUser } as unknown as UserDoc;
}

// Assign pages to a user using arrayUnion & arrayRemove
export async function assignPagesToUser(
  uid: string, 
  pagesToAdd: number[], 
  pagesToRemove: number[]
): Promise<void> {
  const docRef = doc(db, "users", uid);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {};

  if (pagesToAdd.length > 0) {
    updates.assignedPages = arrayUnion(...pagesToAdd);
  }
  if (pagesToRemove.length > 0) {
    updates.assignedPages = arrayRemove(...pagesToRemove);
    // Also remove them from completed pages if they are being unassigned
    updates.completedPages = arrayRemove(...pagesToRemove);

    // Adjust totalCompletedPages
    const userSnap = await getDoc(docRef);
    if (userSnap.exists()) {
      const data = userSnap.data();
      const currentTotal = data.totalCompletedPages !== undefined
        ? data.totalCompletedPages
        : ((data.completedPages?.length || 0) + (data.previousCompletedPages?.length || 0));
        
      const completed = data.completedPages || [];
      const removedCompletions = pagesToRemove.filter(p => completed.includes(p));
      if (removedCompletions.length > 0) {
        updates.totalCompletedPages = Math.max(0, currentTotal - removedCompletions.length);
      }
    }
  }

  if (Object.keys(updates).length > 0) {
    await updateDoc(docRef, updates);
  }
}

// Set user assigned pages directly (helper if replacing whole array)
export async function setAssignedPages(uid: string, pages: number[]): Promise<void> {
  const docRef = doc(db, "users", uid);
  await updateDoc(docRef, { assignedPages: pages });
}

// Toggle a page completion (arrayUnion / arrayRemove)
export async function toggleCompletedPage(
  uid: string, 
  pageNumber: number, 
  isCompleted: boolean
): Promise<void> {
  const docRef = doc(db, "users", uid);
  const timestamp = new Date().toISOString();
  
  const userSnap = await getDoc(docRef);
  let currentTotal = 0;
  if (userSnap.exists()) {
    const data = userSnap.data();
    currentTotal = data.totalCompletedPages !== undefined
      ? data.totalCompletedPages
      : ((data.completedPages?.length || 0) + (data.previousCompletedPages?.length || 0));
  }

  if (isCompleted) {
    const data = userSnap.exists() ? userSnap.data() : {};
    const alreadyCompleted = data.completedPages || [];
    const isNew = !alreadyCompleted.includes(pageNumber);

    await updateDoc(docRef, {
      completedPages: arrayUnion(pageNumber),
      [`completedAt.${pageNumber}`]: timestamp,
      totalCompletedPages: currentTotal + (isNew ? 1 : 0)
    });
  } else {
    const data = userSnap.exists() ? userSnap.data() : {};
    const alreadyCompleted = data.completedPages || [];
    const isCompletedBefore = alreadyCompleted.includes(pageNumber);

    await updateDoc(docRef, {
      completedPages: arrayRemove(pageNumber),
      [`completedAt.${pageNumber}`]: deleteField(),
      totalCompletedPages: Math.max(0, currentTotal - (isCompletedBefore ? 1 : 0))
    });
  }
  await checkAndUpdateKhatmCompletion();
}

// Toggle multiple pages completion at once
export async function toggleCompletedPages(
  uid: string, 
  pageNumbers: number[], 
  isCompleted: boolean
): Promise<void> {
  const docRef = doc(db, "users", uid);
  const timestamp = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {};

  const userSnap = await getDoc(docRef);
  let currentTotal = 0;
  if (userSnap.exists()) {
    const data = userSnap.data();
    currentTotal = data.totalCompletedPages !== undefined
      ? data.totalCompletedPages
      : ((data.completedPages?.length || 0) + (data.previousCompletedPages?.length || 0));
  }

  if (isCompleted) {
    const data = userSnap.exists() ? userSnap.data() : {};
    const alreadyCompleted = data.completedPages || [];
    const newPages = pageNumbers.filter(p => !alreadyCompleted.includes(p));

    updates.completedPages = arrayUnion(...pageNumbers);
    pageNumbers.forEach((p) => {
      updates[`completedAt.${p}`] = timestamp;
    });
    updates.totalCompletedPages = currentTotal + newPages.length;
  } else {
    const data = userSnap.exists() ? userSnap.data() : {};
    const alreadyCompleted = data.completedPages || [];
    const removedPages = pageNumbers.filter(p => alreadyCompleted.includes(p));

    updates.completedPages = arrayRemove(...pageNumbers);
    pageNumbers.forEach((p) => {
      updates[`completedAt.${p}`] = deleteField();
    });
    updates.totalCompletedPages = Math.max(0, currentTotal - removedPages.length);
  }

  await updateDoc(docRef, updates);
  await checkAndUpdateKhatmCompletion();

  if (isCompleted) {
    sendPushNotificationForCompletedPages(uid, pageNumbers).catch((err) =>
      console.error("Failed to send push:", err)
    );
  }
}

// Update a user's role in Firestore
export async function updateUserRole(
  uid: string,
  role: "admin" | "user"
): Promise<void> {
  const docRef = doc(db, "users", uid);
  await updateDoc(docRef, { role });
}

// Check if the current Khatm (all 604 pages) is completed and update global settings
export async function checkAndUpdateKhatmCompletion(): Promise<void> {
  try {
    const users = await getAllUsers();
    
    // Calculate unique completed pages
    const completedPagesSet = new Set<number>();
    users.forEach((u) => {
      const assigned = u.assignedPages || [];
      const completed = u.completedPages || [];
      completed.forEach((page) => {
        if (page >= 1 && page <= 604 && assigned.includes(page)) {
          completedPagesSet.add(page);
        }
      });
    });

    const totalUniqueCompleted = completedPagesSet.size;
    const settings = await getGlobalSettings();
    const isCompleted = totalUniqueCompleted === 604;

    const docRef = doc(db, "settings", "config");

    if (isCompleted && !settings.isCurrentKhatmCompleted) {
      const currentCount = settings.completedKhatms || 0;
      await updateDoc(docRef, {
        completedKhatms: currentCount + 1,
        isCurrentKhatmCompleted: true
      });
    } else if (!isCompleted && settings.isCurrentKhatmCompleted) {
      await updateDoc(docRef, {
        isCurrentKhatmCompleted: false
      });
    }
  } catch (err) {
    console.error("Error in checkAndUpdateKhatmCompletion:", err);
  }
}

// Set assignment for a user manually
export async function setAssignmentForUser(
  uid: string,
  pages: number[],
  startDate: string,
  endDate: string,
  juzNumber?: number
): Promise<void> {
  const docRef = doc(db, "users", uid);
  await updateDoc(docRef, {
    assignedPages: pages,
    completedPages: [],
    completedAt: {},
    assignmentStartDate: startDate,
    assignmentEndDate: endDate,
    assignedJuz: juzNumber || null
  });
}

// Automatically distribute Quran Juz to active users sequentially with rotation and shifts
export async function distributeJuzToUsers(
  startDate: string,
  endDate: string
): Promise<void> {
  const users = await getAllUsers();
  // Sort users stably by name, with UID as fallback to be deterministic
  const activeUsers = [...users].sort((a, b) => a.name.localeCompare(b.name) || a.uid.localeCompare(b.uid));

  if (activeUsers.length === 0) return;

  const settings = await getGlobalSettings();
  
  let cycleStartJuz = settings.cycleStartJuz || 1;
  let startJuz = settings.lastDistributedJuz ? (settings.lastDistributedJuz % 30) + 1 : 1;

  // Prevent repetition of the exact same user-juz assignments in subsequent cycles.
  if (settings.lastDistributedJuz !== undefined && settings.lastDistributedJuz !== 0) {
    if (startJuz === cycleStartJuz) {
      startJuz = (startJuz % 30) + 1;
      cycleStartJuz = startJuz;
    }
  }

  const { writeBatch } = await import("firebase/firestore");
  const batch = writeBatch(db);

  let currentJuz = startJuz;
  for (let i = 0; i < activeUsers.length; i++) {
    const user = activeUsers[i];
    const assignedJuz = ((startJuz + i - 1) % 30) + 1;
    
    // Page ranges for Juz
    const startPage = (assignedJuz - 1) * 20 + 1;
    const endPage = assignedJuz === 30 ? 604 : assignedJuz * 20;

    const pages: number[] = [];
    for (let p = startPage; p <= endPage; p++) {
      pages.push(p);
    }

    const userRef = doc(db, "users", user.uid);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = {
      assignedPages: pages,
      completedPages: [],
      completedAt: {},
      assignmentStartDate: startDate,
      assignmentEndDate: endDate,
      assignedJuz: assignedJuz,
      assignedJuzs: [assignedJuz]
    };

    // Save current assignment to previous before assigning new one, so history and dates are preserved
    if (user.assignedPages && user.assignedPages.length > 0) {
      updates.previousAssignedPages = user.assignedPages;
      updates.previousCompletedPages = user.completedPages || [];
      updates.previousStartDate = user.assignmentStartDate || "";
      updates.previousEndDate = user.assignmentEndDate || "";
    }

    batch.update(userRef, updates);
    currentJuz = assignedJuz;
  }

  const settingsRef = doc(db, "settings", "config");
  batch.set(settingsRef, {
    lastDistributedJuz: currentJuz,
    cycleStartJuz: cycleStartJuz,
    isCurrentKhatmCompleted: false
  }, { merge: true });

  await batch.commit();
}

export interface CompletionStat {
  weeklyCount: number;
  thisMonthCount: number;
  lastMonthCount: number;
  yearlyCount: number;
}

// Helper function to calculate statistics for an array of users
export function calculateStatsForUsers(users: UserDoc[]): CompletionStat {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  let weeklyCount = 0;
  let thisMonthCount = 0;
  let lastMonthCount = 0;
  let yearlyCount = 0;

  users.forEach((u) => {
    const completed = u.completedPages || [];
    completed.forEach((page) => {
      let pageDate: Date | null = null;
      if (u.completedAt && u.completedAt[page]) {
        pageDate = new Date(u.completedAt[page]);
      } else if (u.createdAt) {
        if (typeof u.createdAt.toDate === "function") {
          pageDate = u.createdAt.toDate();
        } else {
          pageDate = new Date(u.createdAt);
        }
      }

      if (pageDate) {
        const time = pageDate.getTime();
        
        if (time >= oneWeekAgo.getTime()) {
          weeklyCount++;
        }
        if (time >= thisMonthStart.getTime()) {
          thisMonthCount++;
        }
        if (time >= lastMonthStart.getTime() && time <= lastMonthEnd.getTime()) {
          lastMonthCount++;
        }
        if (time >= oneYearAgo.getTime()) {
          yearlyCount++;
        }
      }
    });
  });

  return { weeklyCount, thisMonthCount, lastMonthCount, yearlyCount };
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

// Get settings/config
export async function getGlobalSettings(): Promise<AppSettings> {
  try {
    const docRef = doc(db, "settings", "config");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as AppSettings;
    }
    return {
      currentAyah: "İnna lilləhi və inna ileyhi raciun",
      currentHadith: "Sizin ən xeyirliniz Quranı öyrənən və onu başqalarına öyrədəndir."
    };
  } catch (error) {
    console.error("Error in getGlobalSettings:", error);
    return {};
  }
}

// Set settings/config
export async function setGlobalSettings(settings: AppSettings): Promise<void> {
  const docRef = doc(db, "settings", "config");
  await setDoc(docRef, settings, { merge: true });
}

// Delete user document completely
export async function deleteUserDoc(uid: string): Promise<void> {
  const docRef = doc(db, "users", uid);
  await deleteDoc(docRef);
}

// Update user approval status
export async function updateUserApproval(uid: string, approved: boolean): Promise<void> {
  const docRef = doc(db, "users", uid);
  await updateDoc(docRef, { approved });
}

// Update user admin notification message
export async function updateUserAdminNotification(uid: string, message: string): Promise<void> {
  const docRef = doc(db, "users", uid);
  await updateDoc(docRef, { adminNotification: message });
}

// Toggle completion for a page in a previous assignment
export async function togglePreviousCompletedPages(
  uid: string,
  pageNumbers: number[],
  isCompleted: boolean
): Promise<void> {
  const docRef = doc(db, "users", uid);
  const timestamp = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {};

  const userSnap = await getDoc(docRef);
  let currentTotal = 0;
  if (userSnap.exists()) {
    const data = userSnap.data();
    currentTotal = data.totalCompletedPages !== undefined
      ? data.totalCompletedPages
      : ((data.completedPages?.length || 0) + (data.previousCompletedPages?.length || 0));
  }

  if (isCompleted) {
    const data = userSnap.exists() ? userSnap.data() : {};
    const alreadyCompleted = data.previousCompletedPages || [];
    const newPages = pageNumbers.filter(p => !alreadyCompleted.includes(p));

    updates.previousCompletedPages = arrayUnion(...pageNumbers);
    pageNumbers.forEach((p) => {
      updates[`completedAt.${p}`] = timestamp;
    });
    updates.totalCompletedPages = currentTotal + newPages.length;
  } else {
    const data = userSnap.exists() ? userSnap.data() : {};
    const alreadyCompleted = data.previousCompletedPages || [];
    const removedPages = pageNumbers.filter(p => alreadyCompleted.includes(p));

    updates.previousCompletedPages = arrayRemove(...pageNumbers);
    pageNumbers.forEach((p) => {
      updates[`completedAt.${p}`] = deleteField();
    });
    updates.totalCompletedPages = Math.max(0, currentTotal - removedPages.length);
  }

  await updateDoc(docRef, updates);

  if (isCompleted) {
    sendPushNotificationForCompletedPages(uid, pageNumbers).catch((err) =>
      console.error("Failed to send push:", err)
    );
  }
}

// Clear all page assignments and resets everything
export async function clearAllAssignments(): Promise<void> {
  const users = await getAllUsers();
  const { writeBatch } = await import("firebase/firestore");
  const batch = writeBatch(db);
  
  for (const user of users) {
    const userRef = doc(db, "users", user.uid);
    batch.update(userRef, {
      assignedPages: [],
      completedPages: [],
      completedAt: {},
      assignmentStartDate: "",
      assignmentEndDate: "",
      assignedJuz: null,
      assignedJuzs: [],
      previousAssignedPages: [],
      previousCompletedPages: [],
      previousStartDate: "",
      previousEndDate: "",
      totalCompletedPages: 0
    });
  }
  
  const settingsRef = doc(db, "settings", "config");
  batch.set(settingsRef, {
    lastDistributedJuz: 0,
    cycleStartJuz: 1,
    isCurrentKhatmCompleted: false
  }, { merge: true });
  
  await batch.commit();
}

export async function addPushSubscription(uid: string, subscription: string): Promise<void> {
  const docRef = doc(db, "users", uid);
  await updateDoc(docRef, {
    pushSubscriptions: arrayUnion(subscription)
  });
}

export async function removePushSubscription(uid: string, subscription: string): Promise<void> {
  const docRef = doc(db, "users", uid);
  await updateDoc(docRef, {
    pushSubscriptions: arrayRemove(subscription)
  });
}

// Client-side helper to query other users' subscriptions and trigger Next.js push API
export async function sendPushNotificationForCompletedPages(senderUid: string, pageNumbers: number[]): Promise<void> {
  try {
    const users = await getAllUsers();
    let senderName = "Bir iştirakçı";
    const subscriptions: string[] = [];

    users.forEach((userData) => {
      if (userData.uid === senderUid) {
        senderName = userData.name || "Bir iştirakçı";
      } else {
        const userSubs: string[] = userData.pushSubscriptions || [];
        subscriptions.push(...userSubs);
      }
    });

    if (subscriptions.length === 0) return;

    await fetch("/api/send-push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        senderName,
        pageNumbers,
        subscriptions
      })
    });
  } catch (err) {
    console.error("Error in sendPushNotificationForCompletedPages:", err);
  }
}

