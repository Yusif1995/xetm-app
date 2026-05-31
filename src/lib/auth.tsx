"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  type User as FirebaseUser
} from "firebase/auth";
import { auth } from "./firebase";
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

  const handleUserChange = async (firebaseUser: FirebaseUser | null) => {
    if (firebaseUser) {
      // Get or create user document in Firestore
      let userDoc = await getUserDoc(firebaseUser.uid);
      if (!userDoc) {
        userDoc = await createUserDoc(
          firebaseUser.uid,
          firebaseUser.displayName || "",
          firebaseUser.email || "",
          firebaseUser.photoURL || ""
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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        await handleUserChange(firebaseUser);
      } catch (error) {
        console.error("Error in auth state change listener:", error);
        setUser(null);
        Cookies.remove("khatm_uid", { path: "/" });
        Cookies.remove("khatm_role", { path: "/" });
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
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
