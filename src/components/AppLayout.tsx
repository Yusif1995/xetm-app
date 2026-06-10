"use client";

import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { IslamicBorders } from "./IslamicBorders";

interface AppLayoutProps {
  children: React.ReactNode;
  activeTab: "dashboard" | "progress" | "admin";
}

export default function AppLayout({ children, activeTab }: AppLayoutProps) {
  const { user, loading, logout } = useAuth();

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
      <header className="sticky top-0 z-30 bg-[#05180d]/95 backdrop-blur-md border-b border-[#c9a84c]/20 px-4 md:px-8 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center w-full">
          <div className="flex items-center gap-3">
            {/* Logo */}
            <div className="w-8 h-8 flex items-center justify-center relative">
              <div className="absolute w-7 h-7 bg-[#c9a84c] rotate-0 rounded-sm"></div>
              <div className="absolute w-7 h-7 bg-[#c9a84c] rotate-45 rounded-sm"></div>
              <div className="absolute w-2.2 h-2.2 bg-[#0b301a] rounded-full z-10"></div>
            </div>
            <span className="text-lg md:text-xl font-amiri font-bold text-[#fdf6e3]">
              Quran Xətm İzləyicisi
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* User Profile */}
            <div className="flex items-center gap-2">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.name}
                  className="w-8 h-8 rounded-full border border-[#c9a84c]/30 shadow"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#1a5c38]/40 border border-[#c9a84c]/30 flex items-center justify-center font-bold text-[#c9a84c] text-xs">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-xs md:text-sm font-semibold text-[#fdf6e3]/90 hidden sm:inline">{user.name}</span>
            </div>

            <button
              onClick={logout}
              className="px-3 py-1.5 bg-red-950/20 hover:bg-red-900/40 border border-red-500/30 text-red-400 hover:text-red-300 text-xs font-semibold rounded-lg transition-all"
            >
              Çıxış
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex relative">
        {/* Left Sidebar (Desktop) */}
        <aside className="w-28 shrink-0 hidden md:flex flex-col border-r border-[#c9a84c]/10 py-8 px-2 gap-4 relative z-10">
          <Link
            href="/dashboard"
            className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-1 shadow-sm ${
              activeTab === "dashboard"
                ? "bg-[#c9a84c]/15 border-[#c9a84c] text-[#c9a84c]"
                : "bg-transparent border-transparent text-[#fdf6e3]/50 hover:text-[#fdf6e3] hover:bg-[#1a5c38]/10"
            }`}
          >
            <span className="text-2xl">🏠</span>
            <span className="text-[10px] font-bold tracking-wide">Panelim</span>
          </Link>

          <Link
            href="/progress"
            className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-1 shadow-sm ${
              activeTab === "progress"
                ? "bg-[#c9a84c]/15 border-[#c9a84c] text-[#c9a84c]"
                : "bg-transparent border-transparent text-[#fdf6e3]/50 hover:text-[#fdf6e3] hover:bg-[#1a5c38]/10"
            }`}
          >
            <span className="text-2xl">📊</span>
            <span className="text-[10px] font-bold tracking-wide">Gedişat</span>
          </Link>

          {user.role === "admin" && (
            <Link
              href="/admin"
              className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-1 shadow-sm ${
                activeTab === "admin"
                  ? "bg-[#c9a84c]/15 border-[#c9a84c] text-[#c9a84c]"
                  : "bg-transparent border-transparent text-[#fdf6e3]/50 hover:text-[#fdf6e3] hover:bg-[#1a5c38]/10"
              }`}
            >
              <span className="text-2xl">⚙️</span>
              <span className="text-[10px] font-bold tracking-wide">Admin</span>
            </Link>
          )}
        </aside>

        {/* Content Area */}
        <main className="flex-1 p-4 md:p-8 min-w-0 relative z-10">
          {children}
        </main>
      </div>

      {/* Bottom Nav Bar (Mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#05180d]/95 backdrop-blur-md border-t border-[#c9a84c]/20 flex justify-around items-center py-2 shadow-2xl pb-safe">
        <Link
          href="/dashboard"
          className={`flex flex-col items-center py-1 px-3 rounded-lg ${
            activeTab === "dashboard" ? "text-[#c9a84c]" : "text-[#fdf6e3]/50"
          }`}
        >
          <span className="text-xl">🏠</span>
          <span className="text-[9px] font-bold mt-0.5">Panel</span>
        </Link>
        <Link
          href="/progress"
          className={`flex flex-col items-center py-1 px-3 rounded-lg ${
            activeTab === "progress" ? "text-[#c9a84c]" : "text-[#fdf6e3]/50"
          }`}
        >
          <span className="text-xl">📊</span>
          <span className="text-[9px] font-bold mt-0.5">Gedişat</span>
        </Link>
        {user.role === "admin" && (
          <Link
            href="/admin"
            className={`flex flex-col items-center py-1 px-3 rounded-lg ${
              activeTab === "admin" ? "text-[#c9a84c]" : "text-[#fdf6e3]/50"
            }`}
          >
            <span className="text-xl">⚙️</span>
            <span className="text-[9px] font-bold mt-0.5">Admin</span>
          </Link>
        )}
      </nav>
    </div>
  );
}
