"use client";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { IslamicBorders } from "./IslamicBorders";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";

interface AppLayoutProps {
  children: React.ReactNode;
  activeTab: "dashboard" | "readings" | "progress" | "stats" | "admin" | "ai";
}

export default function AppLayout({ children, activeTab }: AppLayoutProps) {
  const { user, loading, logout } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const prevCompletionsRef = useRef<Record<string, number[]>>({});
  const isFirstLoadRef = useRef(true);

  // Request browser Notification permission on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);

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
      <div className="flex-1 flex flex-col justify-center items-center islamic-bg text-[#fdf6e3] min-h-screen">
        <div className="animate-spin h-10 w-10 text-[#c9a84c] mb-4">
          <svg className="w-full h-full" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
        <p className="text-sm font-semibold tracking-wide text-[#fdf6e3]/85">Yüklənir...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col islamic-bg relative overflow-x-hidden pb-16 md:pb-0">
      {/* Background Star Patterns */}
      <IslamicBorders />

      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-[#030e07] border-b border-[#c9a84c]/20 px-4 md:px-8 py-3.5 shadow-md">
        <div className="max-w-7xl mx-auto flex justify-between items-center w-full">
          {/* Logo (Rosette SVG + AppName) */}
          <div className="flex items-center gap-2.5">
            <svg className="w-8 h-8 text-[#c9a84c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2L15 5L18 3L17 7L21 8L19 12L21 16L17 17L18 21L15 19L12 22L9 19L6 21L7 17L3 16L5 12L3 8L7 7L6 3L9 5Z" fill="currentColor" fillOpacity="0.15" />
              <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="12" cy="12" r="2.5" fill="currentColor" />
            </svg>
            <span className="text-base md:text-lg font-serif font-bold text-[#fdf6e3] tracking-wide">
              Quran Xətm
            </span>
          </div>

          {/* Right side: User Profile (Notifications bell removed) */}
          <div className="flex items-center gap-4">
            {/* User Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-2 hover:bg-[#1a5c38]/10 px-2 py-1.5 rounded-lg transition-all focus:outline-none"
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.name}
                    className="w-8 h-8 rounded-full border border-[#c9a84c]/50 shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#1a5c38]/40 border border-[#c9a84c]/50 flex items-center justify-center font-bold text-[#c9a84c] text-xs">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-bold text-[#fdf6e3]/90 hidden xs:inline">{user.name.split(" ")[0]}</span>
                <span className="text-[10px] text-[#c9a84c]">▼</span>
              </button>

              {isProfileOpen && (
                <div 
                  className="absolute right-0 mt-2 w-48 bg-[#05180d] border border-[#c9a84c]/30 rounded-xl shadow-2xl z-50 p-2 animate-fadeIn islamic-card !absolute"
                  style={{ position: "absolute" }}
                >
                  <div className="islamic-card-inner" />
                  <div className="relative z-10 flex flex-col">
                    <div className="px-3 py-2 border-b border-[#c9a84c]/20 text-[10px] text-[#fdf6e3]/60">
                      Rol: {user.role === "admin" ? "İnzibatçı" : "İştirakçı"}
                    </div>
                    <button
                      onClick={logout}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-950/20 hover:text-red-300 rounded-lg transition-colors mt-1"
                    >
                      Çıxış (Logout)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex relative">
        {/* Left Sidebar (Desktop) */}
        <aside className="w-24 shrink-0 hidden md:flex flex-col border-r border-[#c9a84c]/10 py-8 px-2 gap-4 relative z-10 bg-[#030e07]/45">
          {/* Panel (Dashboard) */}
          <Link
            href="/dashboard"
            className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-1.5 shadow-sm w-full ${
              activeTab === "dashboard"
                ? "bg-[#c9a84c] border-[#c9a84c] text-[#05160c]"
                : "bg-transparent border-transparent text-[#fdf6e3]/50 hover:text-[#fdf6e3] hover:bg-[#1a5c38]/10"
            }`}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
            </svg>
            <span className="text-[10px] font-bold tracking-wide">Panel</span>
          </Link>

          {/* Səhifələrim (Readings) */}
          <Link
            href="/readings"
            className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-1.5 shadow-sm w-full ${
              activeTab === "readings"
                ? "bg-[#c9a84c] border-[#c9a84c] text-[#05160c]"
                : "bg-transparent border-transparent text-[#fdf6e3]/50 hover:text-[#fdf6e3] hover:bg-[#1a5c38]/10"
            }`}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            <span className="text-[10px] font-bold tracking-wide">Səhifələrim</span>
          </Link>

          {/* Qrup (Group) */}
          <Link
            href="/progress"
            className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-1.5 shadow-sm w-full ${
              activeTab === "progress"
                ? "bg-[#c9a84c] border-[#c9a84c] text-[#05160c]"
                : "bg-transparent border-transparent text-[#fdf6e3]/50 hover:text-[#fdf6e3] hover:bg-[#1a5c38]/10"
            }`}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span className="text-[10px] font-bold tracking-wide">Qrup</span>
          </Link>

          {/* Statistika (Stats) */}
          <Link
            href="/stats"
            className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-1.5 shadow-sm w-full ${
              activeTab === "stats"
                ? "bg-[#c9a84c] border-[#c9a84c] text-[#05160c]"
                : "bg-transparent border-transparent text-[#fdf6e3]/50 hover:text-[#fdf6e3] hover:bg-[#1a5c38]/10"
            }`}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            <span className="text-[10px] font-bold tracking-wide">Statistika</span>
          </Link>

          {/* Admin Panel (Visible ONLY to admins, Settings removed) */}
          {user.role === "admin" && (
            <Link
              href="/admin"
              className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-1.5 shadow-sm w-full ${
                activeTab === "admin"
                  ? "bg-[#c9a84c] border-[#c9a84c] text-[#05160c]"
                  : "bg-transparent border-transparent text-[#fdf6e3]/50 hover:text-[#fdf6e3] hover:bg-[#1a5c38]/10"
              }`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M21 9H3" />
                <path d="M21 15H3" />
                <path d="M12 3v18" />
              </svg>
              <span className="text-[10px] font-bold tracking-wide">Admin</span>
            </Link>
          )}

          {/* AI Assistant (Visible ONLY to admins) */}
          {user.role === "admin" && (
            <Link
              href="/admin/ai"
              className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-1.5 shadow-sm w-full ${
                activeTab === "ai"
                  ? "bg-[#c9a84c] border-[#c9a84c] text-[#05160c]"
                  : "bg-transparent border-transparent text-[#fdf6e3]/50 hover:text-[#fdf6e3] hover:bg-[#1a5c38]/10"
              }`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L15 5L18 3L17 7L21 8L19 12L21 16L17 17L18 21L15 19L12 22L9 19L6 21L7 17L3 16L5 12L3 8L7 7L6 3L9 5Z" />
                <circle cx="12" cy="12" r="5" />
              </svg>
              <span className="text-[10px] font-bold tracking-wide">AI Köməkçi</span>
            </Link>
          )}
        </aside>

        {/* Content Area */}
        <main className="flex-1 p-4 md:p-8 min-w-0 relative z-10">
          {children}
        </main>
      </div>

      {/* Bottom Nav Bar (Mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#030e07] border-t border-[#c9a84c]/20 flex justify-around items-center py-2 shadow-2xl pb-safe">
        <Link
          href="/dashboard"
          className={`flex flex-col items-center py-1 px-3 rounded-lg ${
            activeTab === "dashboard" ? "text-[#c9a84c]" : "text-[#fdf6e3]/50"
          }`}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
          </svg>
          <span className="text-[9px] font-bold mt-0.5">Panel</span>
        </Link>
        <Link
          href="/readings"
          className={`flex flex-col items-center py-1 px-3 rounded-lg ${
            activeTab === "readings" ? "text-[#c9a84c]" : "text-[#fdf6e3]/50"
          }`}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
          <span className="text-[9px] font-bold mt-0.5">Səhifələr</span>
        </Link>
        <Link
          href="/progress"
          className={`flex flex-col items-center py-1 px-3 rounded-lg ${
            activeTab === "progress" ? "text-[#c9a84c]" : "text-[#fdf6e3]/50"
          }`}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
          </svg>
          <span className="text-[9px] font-bold mt-0.5">Qrup</span>
        </Link>
        <Link
          href="/stats"
          className={`flex flex-col items-center py-1 px-3 rounded-lg ${
            activeTab === "stats" ? "text-[#c9a84c]" : "text-[#fdf6e3]/50"
          }`}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <span className="text-[9px] font-bold mt-0.5">Statistika</span>
        </Link>
        {user.role === "admin" && (
          <Link
            href="/admin"
            className={`flex flex-col items-center py-1 px-3 rounded-lg ${
              activeTab === "admin" ? "text-[#c9a84c]" : "text-[#fdf6e3]/50"
            }`}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
            </svg>
            <span className="text-[9px] font-bold mt-0.5">Admin</span>
          </Link>
        )}
        {user.role === "admin" && (
          <Link
            href="/admin/ai"
            className={`flex flex-col items-center py-1 px-3 rounded-lg ${
              activeTab === "ai" ? "text-[#c9a84c]" : "text-[#fdf6e3]/50"
            }`}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L15 5L18 3L17 7L21 8L19 12L21 16L17 17L18 21L15 19L12 22L9 19L6 21L7 17L3 16L5 12L3 8L7 7L6 3L9 5Z" />
              <circle cx="12" cy="12" r="5" />
            </svg>
            <span className="text-[9px] font-bold mt-0.5">AI</span>
          </Link>
        )}
      </nav>
    </div>
  );
}
