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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createdAt: any;
  approved?: boolean;
  adminNotification?: string;
  previousAssignedPages?: number[];
  previousCompletedPages?: number[];
  previousStartDate?: string;
  previousEndDate?: string;
}

export interface AppSettings {
  currentAyah?: string;
  currentHadith?: string;
  lastDistributedJuz?: number;
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
      return { uid, ...docSnap.data() } as UserDoc;
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
    approved: isFirstUser,
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
  if (isCompleted) {
    await updateDoc(docRef, {
      completedPages: arrayUnion(pageNumber),
      [`completedAt.${pageNumber}`]: timestamp
    });
  } else {
    await updateDoc(docRef, {
      completedPages: arrayRemove(pageNumber),
      [`completedAt.${pageNumber}`]: deleteField()
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

  if (isCompleted) {
    updates.completedPages = arrayUnion(...pageNumbers);
    pageNumbers.forEach((p) => {
      updates[`completedAt.${p}`] = timestamp;
    });
  } else {
    updates.completedPages = arrayRemove(...pageNumbers);
    pageNumbers.forEach((p) => {
      updates[`completedAt.${p}`] = deleteField();
    });
  }

  await updateDoc(docRef, updates);
  await checkAndUpdateKhatmCompletion();
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

// Automatically distribute Quran Juz to active users randomly shuffled
export async function distributeJuzToUsers(
  startDate: string,
  endDate: string
): Promise<void> {
  const users = await getAllUsers();
  const activeUsers = users.filter(u => u.approved === true).sort((a, b) => a.name.localeCompare(b.name));
  
  // Fisher-Yates Shuffle user order
  for (let i = activeUsers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [activeUsers[i], activeUsers[j]] = [activeUsers[j], activeUsers[i]];
  }

  if (activeUsers.length === 0) return;

  const settings = await getGlobalSettings();
  let lastJuz = settings.lastDistributedJuz || 0;

  const { writeBatch } = await import("firebase/firestore");
  const batch = writeBatch(db);

  for (const user of activeUsers) {
    const nextJuz = (lastJuz % 30) + 1;
    
    // Page ranges for Juz
    const startPage = (nextJuz - 1) * 20 + 1;
    let endPage = nextJuz * 20;
    if (nextJuz === 30) {
      endPage = 604;
    }

    const pages = [];
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
      assignedJuz: nextJuz
    };

    // Save current assignment to previous before assigning new one, so history and dates are preserved
    if (user.assignedPages && user.assignedPages.length > 0) {
      updates.previousAssignedPages = user.assignedPages;
      updates.previousCompletedPages = user.completedPages || [];
      updates.previousStartDate = user.assignmentStartDate || "";
      updates.previousEndDate = user.assignmentEndDate || "";
    }

    batch.update(userRef, updates);

    lastJuz = nextJuz;
  }

  const settingsRef = doc(db, "settings", "config");
  batch.set(settingsRef, {
    lastDistributedJuz: lastJuz,
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
      users.push({ uid: doc.id, ...doc.data() } as UserDoc);
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

  if (isCompleted) {
    updates.previousCompletedPages = arrayUnion(...pageNumbers);
    pageNumbers.forEach((p) => {
      updates[`completedAt.${p}`] = timestamp;
    });
  } else {
    updates.previousCompletedPages = arrayRemove(...pageNumbers);
    pageNumbers.forEach((p) => {
      updates[`completedAt.${p}`] = deleteField();
    });
  }

  await updateDoc(docRef, updates);
}
