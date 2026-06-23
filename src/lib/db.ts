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
  firstName?: string;
  lastName?: string;
  nickname?: string;
  isOnboarded?: boolean;
  groupId?: string;
  groupIds?: string[];
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
  groupData?: Record<string, {
    approved?: boolean;
    assignedPages: number[];
    completedPages: number[];
    completedAt?: Record<string, string>;
    assignmentStartDate?: string;
    assignmentEndDate?: string;
    assignedJuz?: number;
    assignedJuzs?: number[];
    previousAssignedPages?: number[];
    previousCompletedPages?: number[];
    previousStartDate?: string;
    previousEndDate?: string;
    totalCompletedPages?: number;
  }>;
}

export interface UserAssignment {
  assignedPages: number[];
  completedPages: number[];
  completedAt: Record<string, string>;
  assignmentStartDate: string;
  assignmentEndDate: string;
  assignedJuz?: number;
  assignedJuzs?: number[];
  previousAssignedPages: number[];
  previousCompletedPages: number[];
  previousStartDate: string;
  previousEndDate: string;
  totalCompletedPages: number;
}

export function getUserGroupIds(user: UserDoc | null): string[] {
  if (!user) return ["default"];
  const list = new Set<string>();
  list.add("default");
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

export function isUserApprovedInGroup(user: UserDoc, groupId: string): boolean {
  if (user.role === "admin") return true; // Admins are always approved
  const gId = groupId || "default";
  if (gId === "default") {
    return user.approved === true;
  }
  return user.groupData?.[gId]?.approved === true;
}

export function getUserAssignment(user: UserDoc, groupId: string): UserAssignment {
  const gId = groupId || "default";
  if (gId === "default") {
    return {
      assignedPages: user.assignedPages || [],
      completedPages: user.completedPages || [],
      completedAt: user.completedAt || {},
      assignmentStartDate: user.assignmentStartDate || "",
      assignmentEndDate: user.assignmentEndDate || "",
      assignedJuz: user.assignedJuz,
      assignedJuzs: user.assignedJuzs || [],
      previousAssignedPages: user.previousAssignedPages || [],
      previousCompletedPages: user.previousCompletedPages || [],
      previousStartDate: user.previousStartDate || "",
      previousEndDate: user.previousEndDate || "",
      totalCompletedPages: user.totalCompletedPages !== undefined
        ? user.totalCompletedPages
        : ((user.completedPages?.length || 0) + (user.previousCompletedPages?.length || 0))
    };
  }
  const gd = user.groupData?.[gId];
  return {
    assignedPages: gd?.assignedPages || [],
    completedPages: gd?.completedPages || [],
    completedAt: gd?.completedAt || {},
    assignmentStartDate: gd?.assignmentStartDate || "",
    assignmentEndDate: gd?.assignmentEndDate || "",
    assignedJuz: gd?.assignedJuz,
    assignedJuzs: gd?.assignedJuzs || [],
    previousAssignedPages: gd?.previousAssignedPages || [],
    previousCompletedPages: gd?.previousCompletedPages || [],
    previousStartDate: gd?.previousStartDate || "",
    previousEndDate: gd?.previousEndDate || "",
    totalCompletedPages: gd?.totalCompletedPages !== undefined
      ? gd?.totalCompletedPages
      : ((gd?.completedPages?.length || 0) + (gd?.previousCompletedPages?.length || 0))
  };
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
  photoURL: string,
  inviteGroupId?: string
): Promise<UserDoc> {
  const docRef = doc(db, "users", uid);
  const existingDoc = await getUserDoc(uid);
  
  if (existingDoc) {
    return existingDoc;
  }

  const usersList = await getAllUsers();
  const isFirstUser = usersList.length === 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newUser: Record<string, any> = {
    name: name || "Qonaq",
    email: email || "",
    photoURL: photoURL || "",
    role: (isFirstUser ? "admin" : "user") as "admin" | "user",
    groupId: inviteGroupId || "default",
    groupIds: inviteGroupId ? ["default", inviteGroupId] : ["default"],
    assignedPages: [],
    completedPages: [],
    createdAt: serverTimestamp(),
    approved: isFirstUser, // First user (admin) is approved, others require approval
    totalCompletedPages: 0,
    isOnboarded: false, // Onboarding completes on OnboardingScreen
  };

  if (inviteGroupId) {
    newUser.groupData = {
      [inviteGroupId]: {
        approved: isFirstUser,
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
      }
    };
  }

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

// Toggle multiple pages completion at once
export async function toggleCompletedPages(
  uid: string, 
  pageNumbers: number[], 
  isCompleted: boolean,
  groupId?: string | null
): Promise<void> {
  const effectiveGroupId = groupId || "default";
  const docRef = doc(db, "users", uid);
  const timestamp = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {};

  const userSnap = await getDoc(docRef);
  let currentTotal = 0;
  let activeAssignment: UserAssignment = {
    assignedPages: [], completedPages: [], completedAt: {},
    assignmentStartDate: "", assignmentEndDate: "",
    previousAssignedPages: [], previousCompletedPages: [],
    previousStartDate: "", previousEndDate: "", totalCompletedPages: 0
  };

  if (userSnap.exists()) {
    const data = userSnap.data() as UserDoc;
    activeAssignment = getUserAssignment(data, effectiveGroupId);
    currentTotal = activeAssignment.totalCompletedPages;
  }

  if (isCompleted) {
    const alreadyCompleted = activeAssignment.completedPages || [];
    const newPages = pageNumbers.filter(p => !alreadyCompleted.includes(p));

    if (effectiveGroupId === "default") {
      updates.completedPages = arrayUnion(...pageNumbers);
      pageNumbers.forEach((p) => {
        updates[`completedAt.${p}`] = timestamp;
      });
      updates.totalCompletedPages = currentTotal + newPages.length;
    } else {
      updates[`groupData.${effectiveGroupId}.completedPages`] = arrayUnion(...pageNumbers);
      pageNumbers.forEach((p) => {
        updates[`groupData.${effectiveGroupId}.completedAt.${p}`] = timestamp;
      });
      updates[`groupData.${effectiveGroupId}.totalCompletedPages`] = currentTotal + newPages.length;
    }
  } else {
    const alreadyCompleted = activeAssignment.completedPages || [];
    const removedPages = pageNumbers.filter(p => alreadyCompleted.includes(p));

    if (effectiveGroupId === "default") {
      updates.completedPages = arrayRemove(...pageNumbers);
      pageNumbers.forEach((p) => {
        updates[`completedAt.${p}`] = deleteField();
      });
      updates.totalCompletedPages = Math.max(0, currentTotal - removedPages.length);
    } else {
      updates[`groupData.${effectiveGroupId}.completedPages`] = arrayRemove(...pageNumbers);
      pageNumbers.forEach((p) => {
        updates[`groupData.${effectiveGroupId}.completedAt.${p}`] = deleteField();
      });
      updates[`groupData.${effectiveGroupId}.totalCompletedPages`] = Math.max(0, currentTotal - removedPages.length);
    }
  }

  await updateDoc(docRef, updates);
  await checkAndUpdateKhatmCompletion(effectiveGroupId);

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

// Check if the current Khatm (all 604 pages) is completed and update settings
export async function checkAndUpdateKhatmCompletion(groupId?: string | null): Promise<void> {
  try {
    const effectiveGroupId = groupId || "default";
    const users = await getAllUsers();
    const groupUsers = users.filter((u) => (u.groupId || "default") === effectiveGroupId && u.approved !== false);
    
    // Calculate unique completed pages
    const completedPagesSet = new Set<number>();
    groupUsers.forEach((u) => {
      const assigned = u.assignedPages || [];
      const completed = u.completedPages || [];
      completed.forEach((page) => {
        if (page >= 1 && page <= 604 && assigned.includes(page)) {
          completedPagesSet.add(page);
        }
      });
    });

    const totalUniqueCompleted = completedPagesSet.size;
    const settings = await getGroupSettings(effectiveGroupId);
    const isCompleted = totalUniqueCompleted === 604;

    if (effectiveGroupId === "default") {
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
    } else {
      const docRef = doc(db, "groups", effectiveGroupId);
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
  juzNumber?: number,
  groupId?: string | null
): Promise<void> {
  const gId = groupId || "default";
  const docRef = doc(db, "users", uid);
  
  if (gId === "default") {
    await updateDoc(docRef, {
      assignedPages: pages,
      completedPages: [],
      completedAt: {},
      assignmentStartDate: startDate,
      assignmentEndDate: endDate,
      assignedJuz: juzNumber || null,
      assignedJuzs: juzNumber ? [juzNumber] : []
    });
  } else {
    await updateDoc(docRef, {
      [`groupData.${gId}.assignedPages`]: pages,
      [`groupData.${gId}.completedPages`]: [],
      [`groupData.${gId}.completedAt`]: {},
      [`groupData.${gId}.assignmentStartDate`]: startDate,
      [`groupData.${gId}.assignmentEndDate`]: endDate,
      [`groupData.${gId}.assignedJuz`]: juzNumber || null,
      [`groupData.${gId}.assignedJuzs`]: juzNumber ? [juzNumber] : [],
      [`groupData.${gId}.totalCompletedPages`]: 0
    });
  }
}

// Automatically distribute Quran Juz to active users sequentially with rotation and shifts
export async function distributeJuzToUsers(
  startDate: string,
  endDate: string,
  groupId?: string | null
): Promise<void> {
  const effectiveGroupId = groupId || "default";
  const users = await getAllUsers();
  // Sort users stably by name, with UID as fallback to be deterministic, filtered by group and approved
  const activeUsers = users
    .filter((u) => getUserGroupIds(u).includes(effectiveGroupId) && isUserApprovedInGroup(u, effectiveGroupId))
    .sort((a, b) => a.name.localeCompare(b.name) || a.uid.localeCompare(b.uid));

  if (activeUsers.length === 0) return;

  const settings = await getGroupSettings(effectiveGroupId);
  
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
    let updates: Record<string, any> = {};

    if (effectiveGroupId === "default") {
      updates = {
        assignedPages: pages,
        completedPages: [],
        completedAt: {},
        assignmentStartDate: startDate,
        assignmentEndDate: endDate,
        assignedJuz: assignedJuz,
        assignedJuzs: [assignedJuz],
        totalCompletedPages: 0
      };

      if (user.assignedPages && user.assignedPages.length > 0) {
        updates.previousAssignedPages = user.assignedPages;
        updates.previousCompletedPages = user.completedPages || [];
        updates.previousStartDate = user.assignmentStartDate || "";
        updates.previousEndDate = user.assignmentEndDate || "";
      }
    } else {
      const gd = user.groupData?.[effectiveGroupId];
      updates = {
        [`groupData.${effectiveGroupId}.assignedPages`]: pages,
        [`groupData.${effectiveGroupId}.completedPages`]: [],
        [`groupData.${effectiveGroupId}.completedAt`]: {},
        [`groupData.${effectiveGroupId}.assignmentStartDate`]: startDate,
        [`groupData.${effectiveGroupId}.assignmentEndDate`]: endDate,
        [`groupData.${effectiveGroupId}.assignedJuz`]: assignedJuz,
        [`groupData.${effectiveGroupId}.assignedJuzs`]: [assignedJuz],
        [`groupData.${effectiveGroupId}.totalCompletedPages`]: 0
      };

      if (gd && gd.assignedPages && gd.assignedPages.length > 0) {
        updates[`groupData.${effectiveGroupId}.previousAssignedPages`] = gd.assignedPages;
        updates[`groupData.${effectiveGroupId}.previousCompletedPages`] = gd.completedPages || [];
        updates[`groupData.${effectiveGroupId}.previousStartDate`] = gd.assignmentStartDate || "";
        updates[`groupData.${effectiveGroupId}.previousEndDate`] = gd.assignmentEndDate || "";
      }
    }

    batch.update(userRef, updates);
    currentJuz = assignedJuz;
  }

  if (effectiveGroupId === "default") {
    const settingsRef = doc(db, "settings", "config");
    batch.set(settingsRef, {
      lastDistributedJuz: currentJuz,
      cycleStartJuz: cycleStartJuz,
      isCurrentKhatmCompleted: false
    }, { merge: true });
  } else {
    const groupRef = doc(db, "groups", effectiveGroupId);
    batch.set(groupRef, {
      lastDistributedJuz: currentJuz,
      cycleStartJuz: cycleStartJuz,
      isCurrentKhatmCompleted: false
    }, { merge: true });
  }

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
export async function updateUserApproval(uid: string, approved: boolean, groupId?: string | null): Promise<void> {
  const docRef = doc(db, "users", uid);
  const gId = groupId || "default";
  if (gId === "default") {
    await updateDoc(docRef, { approved });
  } else {
    await updateDoc(docRef, {
      approved: true, // Approve globally so they can get past the global guard
      [`groupData.${gId}.approved`]: approved
    });
  }
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
  isCompleted: boolean,
  groupId?: string | null
): Promise<void> {
  const effectiveGroupId = groupId || "default";
  const docRef = doc(db, "users", uid);
  const timestamp = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {};

  const userSnap = await getDoc(docRef);
  let currentTotal = 0;
  let activeAssignment: UserAssignment = {
    assignedPages: [], completedPages: [], completedAt: {},
    assignmentStartDate: "", assignmentEndDate: "",
    previousAssignedPages: [], previousCompletedPages: [],
    previousStartDate: "", previousEndDate: "", totalCompletedPages: 0
  };

  if (userSnap.exists()) {
    const data = userSnap.data() as UserDoc;
    activeAssignment = getUserAssignment(data, effectiveGroupId);
    currentTotal = activeAssignment.totalCompletedPages;
  }

  if (isCompleted) {
    const alreadyCompleted = activeAssignment.previousCompletedPages || [];
    const newPages = pageNumbers.filter(p => !alreadyCompleted.includes(p));

    if (effectiveGroupId === "default") {
      updates.previousCompletedPages = arrayUnion(...pageNumbers);
      pageNumbers.forEach((p) => {
        updates[`completedAt.${p}`] = timestamp;
      });
      updates.totalCompletedPages = currentTotal + newPages.length;
    } else {
      updates[`groupData.${effectiveGroupId}.previousCompletedPages`] = arrayUnion(...pageNumbers);
      pageNumbers.forEach((p) => {
        updates[`groupData.${effectiveGroupId}.completedAt.${p}`] = timestamp;
      });
      updates[`groupData.${effectiveGroupId}.totalCompletedPages`] = currentTotal + newPages.length;
    }
  } else {
    const alreadyCompleted = activeAssignment.previousCompletedPages || [];
    const removedPages = pageNumbers.filter(p => alreadyCompleted.includes(p));

    if (effectiveGroupId === "default") {
      updates.previousCompletedPages = arrayRemove(...pageNumbers);
      pageNumbers.forEach((p) => {
        updates[`completedAt.${p}`] = deleteField();
      });
      updates.totalCompletedPages = Math.max(0, currentTotal - removedPages.length);
    } else {
      updates[`groupData.${effectiveGroupId}.previousCompletedPages`] = arrayRemove(...pageNumbers);
      pageNumbers.forEach((p) => {
        updates[`groupData.${effectiveGroupId}.completedAt.${p}`] = deleteField();
      });
      updates[`groupData.${effectiveGroupId}.totalCompletedPages`] = Math.max(0, currentTotal - removedPages.length);
    }
  }

  await updateDoc(docRef, updates);

  if (isCompleted) {
    sendPushNotificationForCompletedPages(uid, pageNumbers).catch((err) =>
      console.error("Failed to send push:", err)
    );
  }
}

// Clear all page assignments and resets everything for a specific group
export async function clearAllAssignments(groupId?: string | null): Promise<void> {
  const effectiveGroupId = groupId || "default";
  const users = await getAllUsers();
  const groupUsers = users.filter((u) => getUserGroupIds(u).includes(effectiveGroupId));
  const { writeBatch } = await import("firebase/firestore");
  const batch = writeBatch(db);
  
  for (const user of groupUsers) {
    const userRef = doc(db, "users", user.uid);
    if (effectiveGroupId === "default") {
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
    } else {
      batch.update(userRef, {
        [`groupData.${effectiveGroupId}.assignedPages`]: [],
        [`groupData.${effectiveGroupId}.completedPages`]: [],
        [`groupData.${effectiveGroupId}.completedAt`]: {},
        [`groupData.${effectiveGroupId}.assignmentStartDate`]: "",
        [`groupData.${effectiveGroupId}.assignmentEndDate`]: "",
        [`groupData.${effectiveGroupId}.assignedJuz`]: null,
        [`groupData.${effectiveGroupId}.assignedJuzs`]: [],
        [`groupData.${effectiveGroupId}.previousAssignedPages`]: [],
        [`groupData.${effectiveGroupId}.previousCompletedPages`]: [],
        [`groupData.${effectiveGroupId}.previousStartDate`]: "",
        [`groupData.${effectiveGroupId}.previousEndDate`]: "",
        [`groupData.${effectiveGroupId}.totalCompletedPages`]: 0
      });
    }
  }
  
  if (effectiveGroupId === "default") {
    const settingsRef = doc(db, "settings", "config");
    batch.set(settingsRef, {
      lastDistributedJuz: 0,
      cycleStartJuz: 1,
      isCurrentKhatmCompleted: false
    }, { merge: true });
  } else {
    const groupRef = doc(db, "groups", effectiveGroupId);
    batch.set(groupRef, {
      lastDistributedJuz: 0,
      cycleStartJuz: 1,
      isCurrentKhatmCompleted: false
    }, { merge: true });
  }
  
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

// Create a new group
export async function createGroup(name: string, createdBy: string): Promise<string> {
  const { addDoc, collection, doc: fsDoc, updateDoc, arrayUnion } = await import("firebase/firestore");
  const docRef = await addDoc(collection(db, "groups"), {
    name,
    createdBy,
    createdAt: new Date().toISOString(),
    lastDistributedJuz: 0,
    cycleStartJuz: 1,
    isCurrentKhatmCompleted: false,
    completedKhatms: 0
  });

  const creatorRef = fsDoc(db, "users", createdBy);
  await updateDoc(creatorRef, {
    groupIds: arrayUnion(docRef.id),
    [`groupData.${docRef.id}.approved`]: true // Creator is automatically approved in their own group!
  });

  return docRef.id;
}

// Fetch all groups created by an admin
export async function getGroupsCreatedBy(adminUid: string): Promise<GroupDoc[]> {
  try {
    const q = query(collection(db, "groups"));
    const querySnapshot = await getDocs(q);
    const groups: GroupDoc[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.createdBy === adminUid) {
        groups.push({ id: doc.id, ...data } as GroupDoc);
      }
    });
    return groups;
  } catch (error) {
    console.error("Error in getGroupsCreatedBy:", error);
    return [];
  }
}

// Update a user's group and clear their assignments
export async function updateUserGroup(uid: string, groupId: string, approved: boolean): Promise<void> {
  const { doc, updateDoc, arrayUnion } = await import("firebase/firestore");
  const docRef = doc(db, "users", uid);
  await updateDoc(docRef, {
    groupId,
    groupIds: arrayUnion(groupId),
    [`groupData.${groupId}.approved`]: approved,
    [`groupData.${groupId}.assignedPages`]: [],
    [`groupData.${groupId}.completedPages`]: [],
    [`groupData.${groupId}.completedAt`]: {},
    [`groupData.${groupId}.assignedJuz`]: null,
    [`groupData.${groupId}.assignedJuzs`]: [],
    [`groupData.${groupId}.previousAssignedPages`]: [],
    [`groupData.${groupId}.previousCompletedPages`]: [],
    [`groupData.${groupId}.previousStartDate`]: "",
    [`groupData.${groupId}.previousEndDate`]: "",
    [`groupData.${groupId}.totalCompletedPages`]: 0
  });
}

// Delete a group and clean up user documents
export async function deleteGroup(groupId: string): Promise<void> {
  const { doc, deleteDoc, writeBatch, deleteField } = await import("firebase/firestore");
  
  // 1. Delete group document
  const groupRef = doc(db, "groups", groupId);
  await deleteDoc(groupRef);
  
  // 2. Clean up users' groupIds and groupData
  const users = await getAllUsers();
  const batch = writeBatch(db);
  let updatedCount = 0;
  
  for (const u of users) {
    const userGroupIds = u.groupIds || [];
    const hasGroup = userGroupIds.includes(groupId) || u.groupId === groupId || (u.groupData && u.groupData[groupId]);
    
    if (hasGroup) {
      const userRef = doc(db, "users", u.uid);
      const newGroupIds = userGroupIds.filter(id => id !== groupId);
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updates: Record<string, any> = {
        groupIds: newGroupIds,
        [`groupData.${groupId}`]: deleteField()
      };
      
      if (u.groupId === groupId) {
        updates.groupId = "default";
      }
      
      batch.update(userRef, updates);
      updatedCount++;
    }
  }
  
  if (updatedCount > 0) {
    await batch.commit();
  }
}

