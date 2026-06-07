"use client";

import { useEffect, useState } from "react";
import { getAllUsers, getGlobalSettings, type UserDoc, type AppSettings } from "@/lib/db";
import { useAuth } from "@/lib/auth";
import ProgressBar from "@/components/ProgressBar";
import UserRow from "@/components/UserRow";
import Link from "next/link";

export default function ProgressPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ completedKhatms: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const allUsers = await getAllUsers();
        setUsers(allUsers);
        const appSettings = await getGlobalSettings();
        setSettings(appSettings);
      } catch (err) {
        console.error("Error loading progress data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Calculate unique pages completed by the group out of 604
  const completedPagesSet = new Set<number>();
  users.forEach((u) => {
    const assigned = u.assignedPages || [];
    const completed = u.completedPages || [];
    completed.forEach((page) => {
      // Only count if the page is assigned to this user and is within the Quran page bounds
      if (page >= 1 && page <= 604 && assigned.includes(page)) {
        completedPagesSet.add(page);
      }
    });
  });
  
  const totalUniqueCompleted = completedPagesSet.size;

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-[#1a1a2e] text-[#fdf6e3] min-h-screen">
        <div className="animate-spin h-10 w-10 text-[#c9a84c] mb-4">
          <svg className="w-full h-full" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
        <p className="text-sm font-semibold tracking-wide text-[#fdf6e3]/85">Ümumi gedişat yüklənir...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#1a1a2e]">
      {/* Navigation Header */}
      <header className="sticky top-0 z-30 bg-[#1a1a2e]/90 backdrop-blur-md border-b border-[#c9a84c]/20 px-4 md:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            {/* Logo */}
            <div className="w-8 h-8 flex items-center justify-center relative">
              <div className="absolute w-7 h-7 bg-[#c9a84c] rotate-0 rounded-sm"></div>
              <div className="absolute w-7 h-7 bg-[#c9a84c] rotate-45 rounded-sm"></div>
              <div className="absolute w-2.2 h-2.2 bg-[#1a1a2e] rounded-full z-10"></div>
            </div>
            <h1 className="text-xl md:text-2xl font-amiri font-bold text-[#fdf6e3]">
              Quran Xətm İzləyicisi
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {!authLoading && currentUser ? (
              <Link
                href="/dashboard"
                className="px-4 py-2 bg-[#c9a84c] hover:bg-[#b0913e] text-[#1a1a2e] font-semibold rounded-lg text-xs md:text-sm transition-all"
              >
                Panelimə Keç
              </Link>
            ) : (
              <Link
                href="/"
                className="px-4 py-2 bg-[#1a5c38] hover:bg-[#1a5c38]/80 text-[#fdf6e3] border border-[#c9a84c]/30 font-semibold rounded-lg text-xs md:text-sm transition-all"
              >
                Google ilə Daxil Ol
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-8 space-y-8">
        
        {/* Top Summary Card */}
        <div className="bg-[#1a5c38]/10 border border-[#c9a84c]/20 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute right-6 bottom-2 opacity-5 pointer-events-none text-8xl md:text-9xl select-none font-bold">
            ۞
          </div>
          <h2 className="text-xl md:text-2xl font-amiri font-bold text-[#c9a84c] mb-2 uppercase tracking-wide">
            Qrup Üzrə Ümumi Gedişat
          </h2>
          <p className="text-sm text-[#fdf6e3]/75 mb-6 max-w-2xl">
            Bu xətm qrupumuzdakı bütün iştirakçıların oxuduğu Quran səhifələrinin cəmidir. Məqsədimiz Quranın 604 səhifəsinin hamısını birgə tamamlamaqdır.
          </p>

          <ProgressBar 
            completed={totalUniqueCompleted} 
            total={604} 
            label="Qrup Xətm Tamamlanması" 
          />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-[#1a5c38]/10 border border-[#c9a84c]/20 rounded-xl text-center shadow-md">
            <span className="text-xs text-[#c9a84c] uppercase font-bold tracking-wider">Tamamlanan Ümumi Xətm</span>
            <div className="text-3xl font-extrabold text-[#fdf6e3] mt-1 font-mono">{settings.completedKhatms || 0}</div>
          </div>
          <div className="p-4 bg-[#1a1a2e]/45 border border-[#c9a84c]/15 rounded-xl text-center shadow-sm">
            <span className="text-xs text-[#c9a84c] uppercase font-bold tracking-wider">Cari Xətmin Səhifələri</span>
            <div className="text-3xl font-extrabold text-[#fdf6e3] mt-1 font-mono">{totalUniqueCompleted} / 604</div>
          </div>
          <div className="p-4 bg-[#1a1a2e]/45 border border-[#c9a84c]/15 rounded-xl text-center shadow-sm">
            <span className="text-xs text-[#c9a84c] uppercase font-bold tracking-wider">Cari Xətm Faiz</span>
            <div className="text-3xl font-extrabold text-[#c9a84c] mt-1 font-mono">
              {Math.round((totalUniqueCompleted / 604) * 100)}%
            </div>
          </div>
        </div>

        {/* Participants Table */}
        <div className="bg-[#1a1a2e]/45 border border-[#c9a84c]/10 rounded-2xl shadow-lg overflow-hidden">
          <div className="p-5 border-b border-[#c9a84c]/15 bg-[#1a5c38]/5">
            <h3 className="text-lg font-bold text-[#fdf6e3] flex items-center gap-2">
              <span>İştirakçıların Siyahısı</span>
              <span className="text-xs bg-[#c9a84c]/15 text-[#c9a84c] px-2.5 py-0.5 rounded-full border border-[#c9a84c]/20">
                {users.length} nəfər
              </span>
            </h3>
          </div>

          {users.length === 0 ? (
            <div className="text-center py-16 text-[#fdf6e3]/50">
              Siyahıda hələ heç bir iştirakçı yoxdur.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#1a1a2e]/60 border-b border-[#c9a84c]/15 text-xs text-[#c9a84c] uppercase font-bold tracking-wider">
                    <th className="px-4 py-3 md:px-6 md:py-4">İştirakçı</th>
                    <th className="px-4 py-3 md:px-6 md:py-4">Təyin edilmiş Səhifələr</th>
                    <th className="px-4 py-3 md:px-6 md:py-4">Tamamlanan</th>
                    <th className="px-4 py-3 md:px-6 md:py-4">Faiz</th>
                    <th className="px-4 py-3 md:px-6 md:py-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <UserRow key={u.uid} user={u} isAdminView={false} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
