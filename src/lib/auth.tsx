"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  type User as FirebaseUser
} from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import {
  getUserDoc,
  fetchUserDoc,
  createUserDoc,
  restoreGroupMemberships,
  migrateOwnPrivateData,
  joinGroup,
  privateDocRef,
  publishProfileToGroups,
  type PrivateProfile,
  getGroupMembers,
  backfillGroupMembers,
  type UserDoc,
  type GroupDoc
} from "./db";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";

interface AuthContextType {
  user: UserDoc | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  activeGroupId: string;
  setActiveGroupId: (id: string) => void;
  // Live doc of the active group (null while loading or when there is none)
  activeGroup: GroupDoc | null;
  // False until the active group's doc has been fetched at least once
  activeGroupLoaded: boolean;
  // Listed in admins/{uid}; can only be granted from the Firebase Console
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserDoc | null>(null);
  // Name / email live in users/{uid}/private/profile; merged into the user object for the UI
  const [privateProfile, setPrivateProfile] = useState<PrivateProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeGroupId, setActiveGroupIdState] = useState<string>("");
  const [activeGroup, setActiveGroup] = useState<GroupDoc | null>(null);
  const [activeGroupLoaded, setActiveGroupLoaded] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setActiveGroup(null);
    if (!user || !activeGroupId || activeGroupId === "default") {
      setActiveGroupLoaded(true);
      return;
    }
    setActiveGroupLoaded(false);
    const unsub = onSnapshot(doc(db, "groups", activeGroupId), (snap) => {
      setActiveGroup(snap.exists() ? ({ id: snap.id, ...snap.data() } as GroupDoc) : null);
      setActiveGroupLoaded(true);
    }, (err) => {
      console.error("Error in active group listener:", err);
      setActiveGroup(null);
      setActiveGroupLoaded(true);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, activeGroupId]);

  useEffect(() => {
    setPrivateProfile(null);
    if (!user?.uid) return;
    const unsub = onSnapshot(privateDocRef(user.uid), (snap) => {
      setPrivateProfile(snap.exists() ? (snap.data() as PrivateProfile) : {});
    }, (err) => console.error("Error loading private profile:", err));
    return () => unsub();
  }, [user?.uid]);

  const mergedUser = useMemo<UserDoc | null>(() => {
    if (!user) return null;
    if (!privateProfile) return user;
    return {
      ...user,
      name: privateProfile.name || user.name,
      firstName: privateProfile.firstName || user.firstName,
      lastName: privateProfile.lastName || user.lastName,
      email: privateProfile.email || user.email,
    };
  }, [user, privateProfile]);

  useEffect(() => {
    if (!user?.uid) {
      setIsSuperAdmin(false);
      return;
    }
    getDoc(doc(db, "admins", user.uid))
      .then((snap) => setIsSuperAdmin(snap.exists()))
      .catch(() => setIsSuperAdmin(false));
  }, [user?.uid]);

  useEffect(() => {
    if (user) {
      const stored = localStorage.getItem(`activeGroupId_${user.uid}`);
      const userGroups = (user.groupIds || []).filter(id => id !== "default");
      const fallback = (user.groupId && user.groupId !== "default") 
        ? user.groupId 
        : (userGroups[0] || "");
      // Ignore a remembered group the user no longer belongs to
      setActiveGroupIdState(stored && userGroups.includes(stored) ? stored : fallback);
    }
  }, [user]);

  const setActiveGroupId = (id: string) => {
    if (user) {
      localStorage.setItem(`activeGroupId_${user.uid}`, id);
    }
    setActiveGroupIdState(id);
  };

  const getInviteGroupId = (): string => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlInvite = params.get("invite") || "";
      if (urlInvite) {
        sessionStorage.setItem("pendingInviteGroupId", urlInvite);
        return urlInvite;
      }
      return sessionStorage.getItem("pendingInviteGroupId") || "";
    }
    return "";
  };

  const syncUserInvite = async (firebaseUser: FirebaseUser, userDoc: UserDoc, inviteGroupId: string): Promise<UserDoc> => {
    if (!inviteGroupId) return userDoc;
    const hasGroupInIds = userDoc.groupIds?.includes(inviteGroupId);
    const needsActiveGroupIdUpdate = !userDoc.groupId || userDoc.groupId === "default" || !userDoc.isOnboarded;
    
    if (!hasGroupInIds) {
      await joinGroup(userDoc, inviteGroupId);
      return (await getUserDoc(firebaseUser.uid)) || userDoc;
    }
    if (needsActiveGroupIdUpdate && userDoc.groupId !== inviteGroupId) {
      const { doc: fsDoc, updateDoc } = await import("firebase/firestore");
      await updateDoc(fsDoc(db, "users", firebaseUser.uid), { groupId: inviteGroupId });
      return (await getUserDoc(firebaseUser.uid)) || userDoc;
    }
    return userDoc;
  };

  // Read the user doc, retrying transient errors (a freshly opened home-screen app is often
  // still offline). A read error must never be treated as "new user".
  const fetchUserDocWithRetry = async (uid: string): Promise<UserDoc | null> => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        return await fetchUserDoc(uid);
      } catch (err) {
        lastError = err;
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
    throw lastError;
  };

  // Get or create the user doc, apply a pending invite and restore group memberships
  const loadOrCreateUser = async (firebaseUser: FirebaseUser): Promise<UserDoc> => {
    let userDoc = await fetchUserDocWithRetry(firebaseUser.uid);
    const inviteGroupId = getInviteGroupId();
    if (!userDoc) {
      userDoc = await createUserDoc(
        firebaseUser.uid,
        firebaseUser.displayName || "",
        firebaseUser.email || "",
        firebaseUser.photoURL || "",
        inviteGroupId
      );
    } else {
      userDoc = await syncUserInvite(firebaseUser, userDoc, inviteGroupId);
    }

    try {
      userDoc = await restoreGroupMemberships(userDoc);
    } catch (err) {
      console.error("Error restoring group memberships:", err);
    }
    try {
      await migrateOwnPrivateData(userDoc);
      const priv = await getDoc(privateDocRef(userDoc.uid));
      const name = (priv.exists() ? priv.data().name : "") || userDoc.name || "";
      await publishProfileToGroups(userDoc.uid, name, userDoc.groupIds || []);
    } catch (err) {
      console.error("Error moving private data:", err);
    }
    return userDoc;
  };

  const handleUserChange = async (firebaseUser: FirebaseUser | null) => {
    if (firebaseUser) {
      const userDoc = await loadOrCreateUser(firebaseUser);
      
      setUser(userDoc);
      // Set cookies for middleware
      Cookies.set("khatm_uid", firebaseUser.uid, { expires: 30, path: "/" });
    } else {
      setUser(null);
      Cookies.remove("khatm_uid", { path: "/" });
    }
  };

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (unsubscribeDoc) {
          unsubscribeDoc();
          unsubscribeDoc = null;
        }

        if (firebaseUser) {
          // Get or create user document in Firestore first (one-off check on login)
          const userDoc = await loadOrCreateUser(firebaseUser);

          // Set initial user state
          setUser(userDoc);
          Cookies.set("khatm_uid", firebaseUser.uid, { expires: 30, path: "/" });

          const userDocRef = doc(db, "users", firebaseUser.uid);
          unsubscribeDoc = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              const totalCompletedPages = data.totalCompletedPages !== undefined
                ? data.totalCompletedPages
                : ((data.completedPages?.length || 0) + (data.previousCompletedPages?.length || 0));
              const updatedDoc = { uid: firebaseUser.uid, ...data, totalCompletedPages } as UserDoc;

              setUser(updatedDoc);
              Cookies.set("khatm_uid", firebaseUser.uid, { expires: 30, path: "/" });
            }
          }, (err) => {
            console.error("Error in user doc real-time listener:", err);
          });
        } else {
          setUser(null);
          Cookies.remove("khatm_uid", { path: "/" });
        }
      } catch (error) {
        console.error("Error in auth state change listener:", error);
        setUser(null);
        Cookies.remove("khatm_uid", { path: "/" });
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) {
        unsubscribeDoc();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      const handleRegister = () => {
        navigator.serviceWorker.register("/sw.js")
          .then((reg) => {
            console.log("Service Worker registered successfully:", reg.scope);
          })
          .catch((err) => {
            console.error("Service Worker registration failed:", err);
          });
      };

      if (document.readyState === "complete") {
        handleRegister();
      } else {
        window.addEventListener("load", handleRegister);
        return () => window.removeEventListener("load", handleRegister);
      }
    }
  }, []);

  // Self-heal groups this user owns: make sure they are linked on the user doc
  // and that their members map is filled in (groups created before it existed).
  useEffect(() => {
    if (!user) return;

    const healOwnedGroups = async () => {
      try {
        const { collection, getDocs, query, where, doc: fsDoc, updateDoc, arrayUnion } = await import("firebase/firestore");
        const q = query(collection(db, "groups"), where("createdBy", "==", user.uid));
        const snap = await getDocs(q);
        const ownedGroups = snap.docs.map((d) => ({ id: d.id, ...d.data() } as GroupDoc));
        if (ownedGroups.length === 0) return;

        const currentGroupIds = user.groupIds || [];
        const missingGroupIds = ownedGroups.map((g) => g.id).filter((id) => !currentGroupIds.includes(id));
        if (missingGroupIds.length > 0) {
          console.log("Self-healing missing groups for owner:", missingGroupIds);
          // Rules allow one group's data per write
          for (const id of missingGroupIds) {
            await updateDoc(fsDoc(db, "users", user.uid), {
              groupIds: arrayUnion(id),
              [`groupData.${id}.approved`]: true,
              selfEditedGroup: id
            });
          }
        }

        for (const group of ownedGroups) {
          if (group.membersBackfilled) continue;
          await backfillGroupMembers(group, await getGroupMembers(group.id));
        }
      } catch (err) {
        console.error("Error in self-healing owned groups:", err);
      }
    };

    healOwnedGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const loginWithGoogle = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      await handleUserChange(result.user);
      setLoading(false);
      if (typeof window !== "undefined") {
        router.push("/dashboard" + window.location.search);
      } else {
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Google sign in error:", error);
      setLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      await handleUserChange(null);
      setLoading(false);
      router.push("/");
    } catch (error) {
      console.error("Logout error:", error);
      setLoading(false);
      throw error;
    }
  };

  const refreshUser = async () => {
    if (firebaseUserActive()) {
      const uid = auth.currentUser?.uid;
      if (uid) {
        const updated = await getUserDoc(uid);
        if (updated) {
          setUser(updated);
        }
      }
    }
  };

  function firebaseUserActive(): boolean {
    return !!auth.currentUser;
  }

  return (
    <AuthContext.Provider value={{ user: mergedUser, loading, loginWithGoogle, logout, refreshUser, activeGroupId, setActiveGroupId, activeGroup, activeGroupLoaded, isSuperAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
