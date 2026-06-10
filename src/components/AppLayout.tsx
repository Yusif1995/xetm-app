"use client";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { useState } from "react";
import { IslamicBorders } from "./IslamicBorders";

interface AppLayoutProps {
  children: React.ReactNode;
  activeTab: "dashboard" | "readings" | "progress" | "stats" | "settings" | "admin";
}

export default function AppLayout({ children, activeTab }: AppLayoutProps) {
  const { user, loading, logout } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

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
    return null; // Guarded by page components / middleware
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

          {/* Right side: Notifications + User Profile */}
          <div className="flex items-center gap-4">
            {/* Notifications Bell */}
            <div className="flex items-center gap-1.5 text-[#fdf6e3]/70 hover:text-[#fdf6e3] transition-colors cursor-pointer mr-1">
              <div className="relative">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <span className="absolute -top-0.5 -right-0.5 w-2.2 h-2.2 bg-red-500 rounded-full border border-[#030e07]"></span>
              </div>
              <span className="text-xs font-semibold hidden sm:inline">Notifications</span>
            </div>

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
                <div className="absolute right-0 mt-2 w-48 bg-[#05180d] border border-[#c9a84c]/30 rounded-xl shadow-2xl z-50 p-2 animate-fadeIn islamic-card">
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
          {/* Dashboard (Grid Icon) */}
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
            <span className="text-[10px] font-bold tracking-wide">Dashboard</span>
          </Link>

          {/* Readings (Open Book) */}
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
            <span className="text-[10px] font-bold tracking-wide">Readings</span>
          </Link>

          {/* Group (Users) */}
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
            <span className="text-[10px] font-bold tracking-wide">Group</span>
          </Link>

          {/* Stats (Bar Chart) */}
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
            <span className="text-[10px] font-bold tracking-wide">Stats</span>
          </Link>

          {/* Settings / Admin (Gear) */}
          <Link
            href="/settings"
            className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-1.5 shadow-sm w-full ${
              activeTab === "settings" || activeTab === "admin"
                ? "bg-[#c9a84c] border-[#c9a84c] text-[#05160c]"
                : "bg-transparent border-transparent text-[#fdf6e3]/50 hover:text-[#fdf6e3] hover:bg-[#1a5c38]/10"
            }`}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span className="text-[10px] font-bold tracking-wide">Settings</span>
          </Link>
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
          <span className="text-[9px] font-bold mt-0.5">Dashboard</span>
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
          <span className="text-[9px] font-bold mt-0.5">Readings</span>
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
          <span className="text-[9px] font-bold mt-0.5">Group</span>
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
          <span className="text-[9px] font-bold mt-0.5">Stats</span>
        </Link>
        <Link
          href="/settings"
          className={`flex flex-col items-center py-1 px-3 rounded-lg ${
            activeTab === "settings" || activeTab === "admin" ? "text-[#c9a84c]" : "text-[#fdf6e3]/50"
          }`}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span className="text-[9px] font-bold mt-0.5">Settings</span>
        </Link>
      </nav>
    </div>
  );
}
