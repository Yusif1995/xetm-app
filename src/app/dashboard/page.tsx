"use client";

import { useAuth } from "@/lib/auth";
import ProgressBar from "@/components/ProgressBar";
import PageCard from "@/components/PageCard";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const { user, loading, logout, refreshUser } = useAuth();
  const [completedPagesState, setCompletedPagesState] = useState<number[]>([]);

  // Sync state with user doc when it loads
  useEffect(() => {
    if (user) {
      setCompletedPagesState(user.completedPages || []);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-[#1a1a2e] text-[#fdf6e3] min-h-screen">
        <div className="animate-spin h-10 w-10 text-[#c9a84c] mb-4">
          <svg className="w-full h-full" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
        <p className="text-sm font-semibold tracking-wide text-[#fdf6e3]/85">Məlumatlar yüklənir...</p>
      </div>
    );
  }

  if (!user) {
    return null; // Guarded by middleware
  }

  const assignedPages = user.assignedPages || [];
  // Ensure we only count completed pages that are actually assigned
  const activeCompleted = completedPagesState.filter(p => assignedPages.includes(p));

  // Group pages into chunks of 5
  const sortedPages = [...assignedPages].sort((a, b) => a - b);
  const pageChunks: number[][] = [];
  for (let i = 0; i < sortedPages.length; i += 5) {
    pageChunks.push(sortedPages.slice(i, i + 5));
  }

  const handleStatusChange = (pageNumbers: number[], isCompleted: boolean) => {
    if (isCompleted) {
      setCompletedPagesState(prev => {
        const next = [...prev];
        pageNumbers.forEach(p => {
          if (!next.includes(p)) {
            next.push(p);
          }
        });
        return next;
      });
    } else {
      setCompletedPagesState(prev => prev.filter(p => !pageNumbers.includes(p)));
    }
    // Also trigger user doc refresh in auth context in background
    refreshUser();
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#1a1a2e]">
      {/* Navigation Header */}
      <header className="sticky top-0 z-30 bg-[#1a1a2e]/90 backdrop-blur-md border-b border-[#c9a84c]/20 px-4 md:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            {/* Rub el Hizb logo decoration */}
            <div className="w-8 h-8 flex items-center justify-center relative">
              <div className="absolute w-7 h-7 bg-[#c9a84c] rotate-0 rounded-sm"></div>
              <div className="absolute w-7 h-7 bg-[#c9a84c] rotate-45 rounded-sm"></div>
              <div className="absolute w-2.2 h-2.2 bg-[#1a1a2e] rounded-full z-10"></div>
            </div>
            <h1 className="text-xl md:text-2xl font-amiri font-bold text-[#fdf6e3]">
              Quran Xətm İzləyicisi
            </h1>
          </div>

          <div className="flex items-center gap-4 flex-wrap justify-center">
            {/* User Profile Info */}
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
              <span className="text-xs md:text-sm font-semibold text-[#fdf6e3]/90">{user.name}</span>
            </div>

            {/* Navigation links */}
            <nav className="flex items-center gap-2.5">
              <Link
                href="/progress"
                className="px-3 py-1.5 bg-[#1a5c38]/10 hover:bg-[#1a5c38]/30 border border-[#1a5c38]/30 hover:border-[#1a5c38] text-[#fdf6e3]/90 text-xs font-semibold rounded-lg transition-all"
              >
                Gedişat Cədvəli
              </Link>

              {user.role === "admin" && (
                <Link
                  href="/admin"
                  className="px-3 py-1.5 bg-[#c9a84c]/10 hover:bg-[#c9a84c] border border-[#c9a84c]/30 hover:border-[#c9a84c] text-[#c9a84c] hover:text-[#1a1a2e] text-xs font-semibold rounded-lg transition-all"
                >
                  Admin Panel
                </Link>
              )}

              <button
                onClick={logout}
                className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 hover:text-red-300 text-xs font-semibold rounded-lg transition-all"
              >
                Çıxış
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-8">
        {/* Welcome Card banner */}
        <div className="mb-8 p-6 bg-[#1a5c38]/10 rounded-2xl border border-[#c9a84c]/20 relative overflow-hidden">
          <div className="absolute right-0 bottom-0 translate-y-4 translate-x-4 opacity-5 pointer-events-none text-9xl">
            📖
          </div>
          <h2 className="text-2xl md:text-3xl font-amiri font-bold text-[#c9a84c] mb-1">
            Salam, {user.name}!
          </h2>
          <p className="text-sm text-[#fdf6e3]/75 max-w-xl">
            Sizin üçün təyin edilmiş Quran səhifələrini aşağıdakı siyahıdan izləyə bilərsiniz. Oxuduğunuz hər bir səhifəni işarələməyi unutmayın.
          </p>
        </div>

        {/* Assigned Pages validation */}
        {assignedPages.length === 0 ? (
          <div className="text-center py-16 px-6 bg-[#1a1a2e]/45 border border-[#c9a84c]/20 rounded-2xl max-w-2xl mx-auto flex flex-col items-center shadow-lg">
            <span className="text-5xl mb-4">🕋</span>
            <h3 className="text-lg md:text-xl font-semibold text-[#fdf6e3] mb-2">Səhifə təyin edilməyib</h3>
            <p className="text-sm text-[#fdf6e3]/60 leading-relaxed mb-4 max-w-md">
              Hörmətli iştirakçı, hazırda sizə oxumaq üçün heç bir səhifə təyin edilməyib. İnzibatçı səhifə təyin edən kimi səhifələriniz burada görünəcək.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 items-center">
              <Link
                href="/progress"
                className="px-4 py-2 bg-[#c9a84c]/20 hover:bg-[#c9a84c]/30 text-[#c9a84c] border border-[#c9a84c]/40 font-semibold rounded-lg transition-all text-sm shadow"
              >
                Ümumi gedişata baxın
              </Link>
              
              {user.role !== "admin" && (
                <button
                  onClick={async () => {
                    try {
                      const { doc, updateDoc } = await import("firebase/firestore");
                      const { db } = await import("@/lib/firebase");
                      await updateDoc(doc(db, "users", user.uid), { role: "admin" });
                      await refreshUser();
                    } catch (e) {
                      console.error("Role update failed:", e);
                      const msg = e instanceof Error ? e.message : String(e);
                      alert("Admin rolunu aktiv edərkən xəta baş verdi: " + msg);
                    }
                  }}
                  className="px-4 py-2 bg-[#c9a84c] hover:bg-[#b0913e] text-[#1a1a2e] font-semibold rounded-lg transition-all text-sm shadow"
                >
                  Özünü Admin Et (İnzibatçı)
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Progress metrics */}
            <div className="bg-[#1a1a2e]/40 border border-[#c9a84c]/10 rounded-2xl p-6">
              <h3 className="text-xs font-bold text-[#c9a84c] mb-4 uppercase tracking-wider">
                Şəxsi Oxuma Gedişatınız
              </h3>
              <ProgressBar completed={activeCompleted.length} total={assignedPages.length} label="Tamamlanan Səhifələrim" />
            </div>

            {/* Grid of assigned pages */}
            <div>
              <h3 className="text-lg font-bold text-[#fdf6e3] mb-4 flex items-center gap-2.5">
                <span>Mənim Səhifələrim</span>
                <span className="text-xs bg-[#c9a84c]/20 text-[#c9a84c] px-2.5 py-0.5 rounded-full border border-[#c9a84c]/30 font-mono">
                  {assignedPages.length} səhifə
                </span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {pageChunks.map((chunk) => (
                  <PageCard
                    key={chunk.join(",")}
                    userId={user.uid}
                    pageNumbers={chunk}
                    initialCompleted={chunk.every((page) => completedPagesState.includes(page))}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
