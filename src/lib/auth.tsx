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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout, refreshUser }}>
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
