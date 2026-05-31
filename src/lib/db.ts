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
  serverTimestamp
} from "firebase/firestore";

export interface UserDoc {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  role: "admin" | "user";
  assignedPages: number[];   // pages 1-604
  completedPages: number[];  // subset of assignedPages
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createdAt: any;
}

export interface AppSettings {
  currentAyah?: string;
  currentHadith?: string;
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

  const newUser: Omit<UserDoc, "uid"> = {
    name: name || "Qonaq",
    email: email || "",
    photoURL: photoURL || "",
    role: "user",
    assignedPages: [],
    completedPages: [],
    createdAt: serverTimestamp(),
  };

  await setDoc(docRef, newUser);
  return { uid, ...newUser } as UserDoc;
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
  if (isCompleted) {
    await updateDoc(docRef, {
      completedPages: arrayUnion(pageNumber)
    });
  } else {
    await updateDoc(docRef, {
      completedPages: arrayRemove(pageNumber)
    });
  }
}

// Toggle multiple pages completion at once
export async function toggleCompletedPages(
  uid: string, 
  pageNumbers: number[], 
  isCompleted: boolean
): Promise<void> {
  const docRef = doc(db, "users", uid);
  if (isCompleted) {
    await updateDoc(docRef, {
      completedPages: arrayUnion(...pageNumbers)
    });
  } else {
    await updateDoc(docRef, {
      completedPages: arrayRemove(...pageNumbers)
    });
  }
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
