"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  type User as FirebaseUser
} from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { getUserDoc, createUserDoc, type UserDoc } from "./db";
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeGroupId, setActiveGroupIdState] = useState<string>("");
  const router = useRouter();

  useEffect(() => {
    if (user) {
      const stored = localStorage.getItem(`activeGroupId_${user.uid}`);
      const userGroups = (user.groupIds || []).filter(id => id !== "default");
      const fallback = (user.groupId && user.groupId !== "default") 
        ? user.groupId 
        : (userGroups[0] || "");
      setActiveGroupIdState(stored || fallback);
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
      return params.get("invite") || "";
    }
    return "";
  };

  const handleUserChange = async (firebaseUser: FirebaseUser | null) => {
    if (firebaseUser) {
      // Get or create user document in Firestore
      let userDoc = await getUserDoc(firebaseUser.uid);
      if (!userDoc) {
        const inviteGroupId = getInviteGroupId();
        userDoc = await createUserDoc(
          firebaseUser.uid,
          firebaseUser.displayName || "",
          firebaseUser.email || "",
          firebaseUser.photoURL || "",
          inviteGroupId
        );
      }
      
      setUser(userDoc);
      // Set cookies for middleware
      Cookies.set("khatm_uid", firebaseUser.uid, { expires: 30, path: "/" });
      Cookies.set("khatm_role", userDoc.role, { expires: 30, path: "/" });
    } else {
      setUser(null);
      Cookies.remove("khatm_uid", { path: "/" });
      Cookies.remove("khatm_role", { path: "/" });
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
          let userDoc = await getUserDoc(firebaseUser.uid);
          if (!userDoc) {
            const inviteGroupId = getInviteGroupId();
            userDoc = await createUserDoc(
              firebaseUser.uid,
              firebaseUser.displayName || "",
              firebaseUser.email || "",
              firebaseUser.photoURL || "",
              inviteGroupId
            );
          }

          // Set initial user state
          setUser(userDoc);
          Cookies.set("khatm_uid", firebaseUser.uid, { expires: 30, path: "/" });
          Cookies.set("khatm_role", userDoc.role, { expires: 30, path: "/" });

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
              Cookies.set("khatm_role", updatedDoc.role, { expires: 30, path: "/" });
            }
          }, (err) => {
            console.error("Error in user doc real-time listener:", err);
          });
        } else {
          setUser(null);
          Cookies.remove("khatm_uid", { path: "/" });
          Cookies.remove("khatm_role", { path: "/" });
        }
      } catch (error) {
        console.error("Error in auth state change listener:", error);
        setUser(null);
        Cookies.remove("khatm_uid", { path: "/" });
        Cookies.remove("khatm_role", { path: "/" });
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

  useEffect(() => {
    if (!user || user.role !== "admin") return;

    const healGroupAssociations = async () => {
      try {
        const { collection, getDocs, query, where, doc: fsDoc, updateDoc, arrayUnion } = await import("firebase/firestore");
        const q = query(collection(db, "groups"), where("createdBy", "==", user.uid));
        const snap = await getDocs(q);
        const missingGroupIds: string[] = [];

        snap.forEach((docSnap) => {
          const groupId = docSnap.id;
          const currentGroupIds = user.groupIds || [];
          if (!currentGroupIds.includes(groupId)) {
            missingGroupIds.push(groupId);
          }
        });

        if (missingGroupIds.length > 0) {
          console.log("Self-healing missing groups for admin:", missingGroupIds);
          const userRef = fsDoc(db, "users", user.uid);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const updates: Record<string, any> = {
            groupIds: arrayUnion(...missingGroupIds)
          };
          missingGroupIds.forEach(id => {
            updates[`groupData.${id}.approved`] = true;
          });
          await updateDoc(userRef, updates);
        }
      } catch (err) {
        console.error("Error in self-healing groups association:", err);
      }
    };

    healGroupAssociations();
  }, [user?.uid]);

  const loginWithGoogle = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      await handleUserChange(result.user);
      setLoading(false);
      router.push("/dashboard");
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
          Cookies.set("khatm_role", updated.role, { expires: 30, path: "/" });
        }
      }
    }
  };

  function firebaseUserActive(): boolean {
    return !!auth.currentUser;
  }

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout, refreshUser, activeGroupId, setActiveGroupId }}>
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
