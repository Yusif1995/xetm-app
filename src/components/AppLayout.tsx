"use client";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { IslamicBorders } from "./IslamicBorders";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { addPushSubscription } from "@/lib/db";

interface AppLayoutProps {
  children: React.ReactNode;
  activeTab: "dashboard" | "readings" | "progress" | "stats" | "admin" | "ai";
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function AppLayout({ children, activeTab }: AppLayoutProps) {
  const { user, loading, logout } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const prevCompletionsRef = useRef<Record<string, number[]>>({});
  const isFirstLoadRef = useRef(true);

  // Request browser Notification permission and register push subscription on mount/login
  useEffect(() => {
    if (!user) return;
    
    const initPush = async () => {
      if (typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window) {
        let permission = Notification.permission;
        if (permission === "default") {
          permission = await Notification.requestPermission();
        }
        
        if (permission === "granted") {
          try {
            const registration = await navigator.serviceWorker.ready;
            let subscription = await registration.pushManager.getSubscription();
            
            if (!subscription) {
              const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BFwS55H6VsjxTHDxWkRhjtW7Dy7VWHZ596I9Ak6rSjYOFRYI-2KQo9e67cGUawT79VkS4V9eAQyo73r5dgp03hg";
              subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey)
              });
            }
            
            if (subscription) {
              await addPushSubscription(user.uid, JSON.stringify(subscription));
              console.log("Registered Push Subscription for user", user.uid);
            }
          } catch (err) {
            console.error("Error setting up push subscription:", err);
          }
        }
      }
    };
    
    initPush();
  }, [user]);

  // Listen to completedPages updates in real-time
  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      const currentCompletions: Record<string, number[]> = {};
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        currentCompletions[doc.id] = data.completedPages || [];
      });

      if (isFirstLoadRef.current) {
        prevCompletionsRef.current = currentCompletions;
        isFirstLoadRef.current = false;
        return;
      }

      // Check for changes
      snapshot.forEach((doc) => {
        const uid = doc.id;
        if (uid === user.uid) return; // Do not notify about self

        const oldPages = prevCompletionsRef.current[uid] || [];
        const newPages = doc.data().completedPages || [];
        const newlyCompleted = newPages.filter((p: number) => !oldPages.includes(p));

        if (newlyCompleted.length > 0) {
          const name = doc.data().name || "Bir iştirakçı";
          const title = "Quran Xətm - Yeni Tamamlama!";
          const options = {
            body: `${name} yeni səhifəni tamamladı: Səhifə ${newlyCompleted.sort((a: number, b: number) => a - b).join(", ")}`,
            icon: "/icon.png",
            badge: "/favicon.ico",
            vibrate: [200, 100, 200],
            data: { url: "/dashboard" }
          };

          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            if ("serviceWorker" in navigator) {
              navigator.serviceWorker.ready.then((registration) => {
                registration.showNotification(title, options);
              }).catch((err) => {
                console.error("Error in service worker notification:", err);
                try {
                  new Notification(title, { body: options.body, icon: options.icon });
                } catch (e) {
                  console.error("Fallback notification error:", e);
                }
              });
            } else {
              try {
                new Notification(title, { body: options.body, icon: options.icon });
              } catch (err) {
                console.error("Error triggering HTML5 notification:", err);
              }
            }
          }
        }
      });

      prevCompletionsRef.current = currentCompletions;
    });

    return () => unsubscribe();
  }, [user]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-[#FAF7F2] text-[#0F3D2C] min-h-screen">
        <div className="animate-spin h-10 w-10 text-[#0F3D2C] mb-4">
          <svg className="w-full h-full" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
        <p className="text-sm font-semibold tracking-wide text-[#0F3D2C]/80">Yüklənir...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const toggleDropdown = () => setIsProfileOpen(!isProfileOpen);

  return (
    <div className="min-h-screen flex bg-[#F7F4EB] text-[#1c2e24] relative overflow-x-hidden pb-16 md:pb-0">
      {/* Background Star Patterns */}
      <IslamicBorders />

      {/* Left Sidebar (Desktop) */}
      <aside className="w-64 shrink-0 hidden md:flex flex-col bg-[#0F3D2C] text-white py-8 px-4 gap-6 relative z-20 border-r border-[#D5A85A]/10 shadow-2xl">
        <div className="sidebar-pattern" />

        {/* Logo Section */}
        <div className="flex flex-col items-center justify-center gap-3 relative z-10 border-b border-white/10 pb-6">
          {/* Rosette SVG */}
          <div className="w-14 h-14 flex items-center justify-center relative">
            <svg className="w-12 h-12 text-[#D5A85A] drop-shadow-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2L15 5L18 3L17 7L21 8L19 12L21 16L17 17L18 21L15 19L12 22L9 19L6 21L7 17L3 16L5 12L3 8L7 7L6 3L9 5Z" fill="currentColor" fillOpacity="0.15" />
              <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="12" cy="12" r="2.5" fill="currentColor" />
            </svg>
          </div>
          <span className="text-lg font-serif font-bold tracking-wider text-[#D5A85A]">
            XETM APP
          </span>
        </div>

        {/* Sidebar Nav Items */}
        <nav className="flex-1 flex flex-col gap-2 relative z-10 pt-2 font-sans">
          {/* Dashboard */}
          <Link
            href="/dashboard"
            className={`flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all font-semibold text-sm ${
              activeTab === "dashboard"
                ? "bg-[#F7F4EB] text-[#0F3D2C] shadow-md transform scale-[1.02]"
                : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
            </svg>
            <span>Dashboard</span>
          </Link>

          {/* My Readings */}
          <Link
            href="/readings"
            className={`flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all font-semibold text-sm ${
              activeTab === "readings"
                ? "bg-[#F7F4EB] text-[#0F3D2C] shadow-md transform scale-[1.02]"
                : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            <span>My Readings</span>
          </Link>

          {/* History */}
          <Link
            href="/readings"
            className={`flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all font-semibold text-sm text-white/70 hover:text-white hover:bg-white/5`}
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>History</span>
          </Link>

          {/* Groups */}
          <Link
            href="/progress"
            className={`flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all font-semibold text-sm ${
              activeTab === "progress"
                ? "bg-[#F7F4EB] text-[#0F3D2C] shadow-md transform scale-[1.02]"
                : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>Groups</span>
          </Link>

          {/* Statistics */}
          <Link
            href="/stats"
            className={`flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all font-semibold text-sm ${
              activeTab === "stats"
                ? "bg-[#F7F4EB] text-[#0F3D2C] shadow-md transform scale-[1.02]"
                : "text-white/70 hover:text-white hover:bg-white/5"
            }`}
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            <span>Statistics</span>
          </Link>

          {/* Profile Shortcut */}
          <button
            onClick={toggleDropdown}
            className={`flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all font-semibold text-sm text-left w-full text-white/70 hover:text-white hover:bg-white/5`}
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span>Profile</span>
          </button>

          {/* Settings Shortcut */}
          <button
            onClick={toggleDropdown}
            className={`flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all font-semibold text-sm text-left w-full text-white/70 hover:text-white hover:bg-white/5`}
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>Settings</span>
          </button>

          {/* Admin panel routes if user is admin */}
          {user.role === "admin" && (
            <div className="border-t border-white/10 mt-3 pt-3 flex flex-col gap-2">
              <span className="text-[10px] uppercase tracking-wider text-[#D5A85A] font-bold px-4">Admin</span>
              <Link
                href="/admin"
                className={`flex items-center gap-3.5 px-4 py-2.5 rounded-xl transition-all font-semibold text-xs ${
                  activeTab === "admin"
                    ? "bg-[#F7F4EB] text-[#0F3D2C]"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                }`}
              >
                <span>🔧</span>
                <span>Admin Panel</span>
              </Link>
              <Link
                href="/admin/ai"
                className={`flex items-center gap-3.5 px-4 py-2.5 rounded-xl transition-all font-semibold text-xs ${
                  activeTab === "ai"
                    ? "bg-[#F7F4EB] text-[#0F3D2C]"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                }`}
              >
                <span>🤖</span>
                <span>AI Köməkçi</span>
              </Link>
            </div>
          )}
        </nav>

        {/* Sidebar Footer */}
        <div className="relative z-10 border-t border-white/10 pt-4 flex flex-col gap-2">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors font-semibold text-sm"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Çıxış</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        
        {/* Desktop Top Header Bar (Action area for bell & settings) */}
        <header className="hidden md:flex justify-end items-center px-8 py-5 border-b border-[#0F3D2C]/5 bg-transparent">
          <div className="flex items-center gap-4 relative">
            
            {/* Notification Bell */}
            <button 
              onClick={() => alert("Bildirişlər aktivdir.")}
              className="w-10 h-10 rounded-full bg-[#FAF7F2] border border-[#0F3D2C]/10 flex items-center justify-center text-[#0F3D2C] hover:bg-white hover:shadow-sm transition-all focus:outline-none relative"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-[#D5A85A] rounded-full border-2 border-[#FAF7F2]" />
            </button>

            {/* Profile Dropdown / Gear Settings Button */}
            <button
              onClick={toggleDropdown}
              className="w-10 h-10 rounded-full bg-[#FAF7F2] border border-[#0F3D2C]/10 flex items-center justify-center text-[#0F3D2C] hover:bg-white hover:shadow-sm transition-all focus:outline-none"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>

            {/* Profile Dropdown Menu */}
            {isProfileOpen && (
              <div className="absolute right-0 mt-12 top-0 w-52 bg-white border border-[#0F3D2C]/10 rounded-xl shadow-xl z-50 p-2 animate-fadeIn">
                <div className="flex flex-col text-sm text-[#0F3D2C]">
                  <div className="px-3 py-2 border-b border-[#0F3D2C]/5 text-[11px] text-[#0F3D2C]/60 font-medium">
                    Rol: {user.role === "admin" ? "İnzibatçı" : "İştirakçı"}
                  </div>
                  <button
                    onClick={async () => {
                      setIsProfileOpen(false);
                      if (typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window) {
                        try {
                          const permission = await Notification.requestPermission();
                          if (permission === "granted") {
                            const registration = await navigator.serviceWorker.ready;
                            const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BFwS55H6VsjxTHDxWkRhjtW7Dy7VWHZ596I9Ak6rSjYOFRYI-2KQo9e67cGUawT79VkS4V9eAQyo73r5dgp03hg";
                            const subscription = await registration.pushManager.subscribe({
                              userVisibleOnly: true,
                              applicationServerKey: urlBase64ToUint8Array(publicKey)
                            });
                            await addPushSubscription(user.uid, JSON.stringify(subscription));
                            alert("Bildirişlər uğurla aktiv edildi!");
                          } else {
                            alert("Bildiriş icazəsi rədd edildi: " + permission);
                          }
                        } catch (err) {
                          console.error("Subscription error:", err);
                          alert("Bildirişləri aktiv edərkən xəta baş verdi: " + (err instanceof Error ? err.message : String(err)));
                        }
                      } else {
                        alert("Cihazınız və ya brauzeriniz Web Push bildirişləri dəstəkləmir.");
                      }
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-[#FAF7F2] rounded-lg transition-colors mt-1 border-b border-[#0F3D2C]/5 flex items-center gap-1.5"
                  >
                    <span>🔔</span> Bildirişləri Aktiv Et
                  </button>
                  <button
                    onClick={logout}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-1"
                  >
                    Çıxış (Logout)
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-30 bg-[#0F3D2C] text-white border-b border-[#D5A85A]/20 px-4 py-3 flex justify-between items-center shadow-md">
          <div className="flex items-center gap-2">
            <svg className="w-7 h-7 text-[#D5A85A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2L15 5L18 3L17 7L21 8L19 12L21 16L17 17L18 21L15 19L12 22L9 19L6 21L7 17L3 16L5 12L3 8L7 7L6 3L9 5Z" fill="currentColor" fillOpacity="0.15" />
            </svg>
            <span className="text-base font-serif font-bold tracking-wide">Quran Xətm</span>
          </div>

          <div className="flex items-center gap-2 relative">
            <button
              onClick={toggleDropdown}
              className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/25 transition-all"
            >
              <span className="text-xs">⚙️</span>
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 mt-10 top-0 w-44 bg-[#0F3D2C] border border-white/10 rounded-xl shadow-2xl z-50 p-2 animate-fadeIn text-white">
                <div className="flex flex-col text-xs">
                  <div className="px-3 py-2 border-b border-white/10 text-[10px] text-white/60">
                    Rol: {user.role === "admin" ? "İnzibatçı" : "İştirakçı"}
                  </div>
                  <button
                    onClick={async () => {
                      setIsProfileOpen(false);
                      if (typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window) {
                        try {
                          const permission = await Notification.requestPermission();
                          if (permission === "granted") {
                            const registration = await navigator.serviceWorker.ready;
                            const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BFwS55H6VsjxTHDxWkRhjtW7Dy7VWHZ596I9Ak6rSjYOFRYI-2KQo9e67cGUawT79VkS4V9eAQyo73r5dgp03hg";
                            const subscription = await registration.pushManager.subscribe({
                              userVisibleOnly: true,
                              applicationServerKey: urlBase64ToUint8Array(publicKey)
                            });
                            await addPushSubscription(user.uid, JSON.stringify(subscription));
                            alert("Bildirişlər uğurla aktiv edildi!");
                          } else {
                            alert("Bildiriş icazəsi rədd edildi: " + permission);
                          }
                        } catch (err) {
                          console.error("Subscription error:", err);
                        }
                      }
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-white/10 rounded-lg transition-colors mt-1 border-b border-white/10"
                  >
                    🔔 Bildirişləri Aktiv Et
                  </button>
                  <button
                    onClick={logout}
                    className="w-full text-left px-3 py-2 text-red-400 hover:bg-red-950/20 rounded-lg transition-colors mt-1"
                  >
                    Çıxış (Logout)
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-4 md:p-8 min-w-0 relative z-10 bg-[#F7F4EB]">
          {children}
        </main>
      </div>

      {/* Bottom Nav Bar (Mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0F3D2C] border-t border-white/10 flex justify-around items-center py-2 shadow-2xl pb-safe">
        <Link
          href="/dashboard"
          className={`flex flex-col items-center py-1 px-3 rounded-lg ${
            activeTab === "dashboard" ? "text-[#D5A85A]" : "text-white/50"
          }`}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
          </svg>
          <span className="text-[9px] font-semibold mt-0.5">Panel</span>
        </Link>
        <Link
          href="/readings"
          className={`flex flex-col items-center py-1 px-3 rounded-lg ${
            activeTab === "readings" ? "text-[#D5A85A]" : "text-white/50"
          }`}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
          <span className="text-[9px] font-semibold mt-0.5">Səhifələr</span>
        </Link>
        <Link
          href="/progress"
          className={`flex flex-col items-center py-1 px-3 rounded-lg ${
            activeTab === "progress" ? "text-[#D5A85A]" : "text-white/50"
          }`}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
          </svg>
          <span className="text-[9px] font-semibold mt-0.5">Qrup</span>
        </Link>
        <Link
          href="/stats"
          className={`flex flex-col items-center py-1 px-3 rounded-lg ${
            activeTab === "stats" ? "text-[#D5A85A]" : "text-white/50"
          }`}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <span className="text-[9px] font-semibold mt-0.5">Statistika</span>
        </Link>
      </nav>
    </div>
  );
}
