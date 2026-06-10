"use client";

import { useAuth } from "@/lib/auth";
import { getAllUsers, toggleCompletedPages, getGlobalSettings, type UserDoc, type AppSettings } from "@/lib/db";
import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";

// 1-30 Cüz üzrə Surə aralıqları xəritəsi
const JUZ_MAP: Record<number, { surah: string }> = {
  1: { surah: "Əl-Fatihə - Əl-Bəqərə" },
  2: { surah: "Əl-Bəqərə" },
  3: { surah: "Əl-Bəqərə - Ali-İmran" },
  4: { surah: "Ali-İmran - An-Nisa" },
  5: { surah: "An-Nisa" },
  6: { surah: "An-Nisa - Al-Maidə" },
  7: { surah: "Al-Maidə - Al-Ənam" },
  8: { surah: "Al-Ənam - Al-Əraf" },
  9: { surah: "Al-Əraf - Al-Ənfal" },
  10: { surah: "Al-Ənfal - At-Tövbə" },
  11: { surah: "At-Tövbə - Hud" },
  12: { surah: "Hud - Yusuf" },
  13: { surah: "Yusuf - İbrahim" },
  14: { surah: "Al-Hicr - An-Nahl" },
  15: { surah: "Al-İsra - Al-Kəhf" },
  16: { surah: "Al-Kəhf - Taha" },
  17: { surah: "Al-Ənbiya - Al-Həcc" },
  18: { surah: "Al-Muminun - Al-Furqan" },
  19: { surah: "Al-Furqan - An-Naml" },
  20: { surah: "An-Naml - Al-Ankabut" },
  21: { surah: "Al-Ankabut - Al-Ahzab" },
  22: { surah: "Al-Ahzab - Yasin" },
  23: { surah: "Yasin - Az-Zumar" },
  24: { surah: "Az-Zumar - Fussilat" },
  25: { surah: "Fussilat - Al-Jasiya" },
  26: { surah: "Al-Ahqaf - Az-Zariyat" },
  27: { surah: "Az-Zariyat - Al-Hadid" },
  28: { surah: "Al-Mujadilah - At-Tahrim" },
  29: { surah: "Al-Mulk - Al-Mursalat" },
  30: { surah: "Ən-Nəbə - Ən-Nas" }
};

const CornerOrnament = ({ className }: { className?: string }) => (
  <svg className={`absolute w-12 h-12 text-[#c9a84c]/60 pointer-events-none select-none z-10 ${className}`} viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M 8 8 L 75 8 M 8 8 L 8 75" strokeLinecap="round" />
    <path d="M 8 24 C 8 16, 16 8, 24 8" strokeLinecap="round" />
    <path d="M 8 40 C 8 28, 28 8, 40 8" strokeLinecap="round" />
    <path d="M 16 16 L 36 36" strokeLinecap="round" />
    <path d="M 12 28 C 20 28, 28 20, 28 12" strokeLinecap="round" />
    <circle cx="8" cy="8" r="1.5" fill="currentColor" />
  </svg>
);

export default function DashboardPage() {
  const { user, loading, refreshUser } = useAuth();
  const [allUsers, setAllUsers] = useState<UserDoc[]>([]);
  const [completedPagesState, setCompletedPagesState] = useState<number[]>([]);
  const [isMarking, setIsMarking] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    if (user) {
      setCompletedPagesState(user.completedPages || []);
    }
  }, [user]);

  useEffect(() => {
    async function loadData() {
      try {
        const [usersList, appSettings] = await Promise.all([
          getAllUsers(),
          getGlobalSettings()
        ]);
        setAllUsers(usersList);
        setSettings(appSettings);
      } catch (err) {
        console.error("Error loading dashboard data:", err);
      }
    }
    loadData();
  }, []);

  if (loading || !user) {
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

  const assignedPages = user.assignedPages || [];
  const activeCompleted = completedPagesState.filter(p => assignedPages.includes(p));

  // 5-lik qruplar
  const sortedPages = [...assignedPages].sort((a, b) => a - b);
  const chunks: number[][] = [];
  for (let i = 0; i < sortedPages.length; i += 5) {
    chunks.push(sortedPages.slice(i, i + 5));
  }
  const activeChunk = chunks.find(chunk => !chunk.every(page => completedPagesState.includes(page))) || chunks[0] || [];

  // Şəxsi faiz
  const personalPercentage = assignedPages.length > 0
    ? Math.round((activeCompleted.length / assignedPages.length) * 100)
    : 0;

  // Qrup statistikası
  const totalAssignedPagesList = allUsers.flatMap(u => u.assignedPages || []);
  const totalUniqueAssigned = Array.from(new Set(totalAssignedPagesList)).length;

  const totalCompletedPagesList = allUsers.flatMap(u => u.completedPages || []);
  const totalUniqueCompleted = Array.from(new Set(totalCompletedPagesList)).length;

  const groupPercentage = totalUniqueAssigned > 0 
    ? Math.round((totalUniqueCompleted / 604) * 100) 
    : 0;

  const activeRecitersCount = allUsers.filter(u => (u.assignedPages || []).length > 0).length;

  // Son oxu vaxtı
  const getLastReadTime = () => {
    if (!user.completedAt || Object.keys(user.completedAt).length === 0) return "Oxunmayıb";
    const timestamps = Object.values(user.completedAt).map(t => new Date(t).getTime());
    const mostRecent = Math.max(...timestamps);
    const diffMs = Date.now() - mostRecent;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "İndi";
    if (diffMins < 60) return `${diffMins} dəq əvvəl`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} saat əvvəl`;
    return `${Math.floor(diffHours / 24)} gün əvvəl`;
  };

  // Oxundu olaraq qeyd et
  const handleMarkAsComplete = async () => {
    if (activeChunk.length === 0 || isMarking) return;
    setIsMarking(true);
    try {
      await toggleCompletedPages(user.uid, activeChunk, true);
      setCompletedPagesState(prev => {
        const next = [...prev];
        activeChunk.forEach(p => {
          if (!next.includes(p)) next.push(p);
        });
        return next;
      });
      await refreshUser();
    } catch (err) {
      console.error("Error marking chunk as completed:", err);
    } finally {
      setIsMarking(false);
    }
  };

  // Surə / Səhifə
  const juzDetails = JUZ_MAP[user.assignedJuz || 30] || { surah: "Qrup Xətmi" };
  const chunkPagesLabel = activeChunk.length > 0 
    ? `${activeChunk[0]}-${activeChunk[activeChunk.length - 1]}`
    : "Təyin edilməyib";

  return (
    <AppLayout activeTab="dashboard">
      {/* Main Glassmorphic Ornamental Container */}
      <div className="w-full p-6 md:p-10 islamic-card relative shadow-2xl rounded-2xl border-[5px] border-double border-[#c9a84c]/85 bg-gradient-to-b from-[#0c2e1b]/95 to-[#05160c]/95 backdrop-blur-md overflow-hidden min-h-[500px]">
        {/* Ornaments in 4 Corners */}
        <CornerOrnament className="top-2 left-2" />
        <CornerOrnament className="top-2 right-2 rotate-90" />
        <CornerOrnament className="bottom-2 left-2 -rotate-90" />
        <CornerOrnament className="bottom-2 right-2 rotate-180" />

        {/* Outer decorative inner line */}
        <div className="absolute inset-2 border border-[#c9a84c]/20 rounded-xl pointer-events-none z-0" />
        <div className="islamic-pattern opacity-[0.03]" />

        {/* Dashboard Title */}
        <h1 className="text-center font-serif text-3xl md:text-4xl text-transparent bg-clip-text bg-gradient-to-b from-[#fdf6e3] via-[#c9a84c] to-[#b0913e] font-bold mb-8 tracking-wide relative z-10">
          Xətm İdarəetmə Paneli
        </h1>

        {/* Günün Ayəsi & Günün Hədisi Kartı */}
        {(settings?.currentAyah || settings?.currentHadith) && (
          <div className="mb-6 bg-[#05180d]/80 border border-[#c9a84c]/20 rounded-2xl p-5 md:p-6 shadow-inner relative overflow-hidden z-10">
            <div className="islamic-card-inner !border-[#c9a84c]/10" />
            <div className={`relative z-10 grid gap-6 ${settings.currentAyah && settings.currentHadith ? "grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#c9a84c]/15" : "grid-cols-1"}`}>
              {settings.currentAyah && (
                <div className="flex flex-col items-center text-center px-4 justify-center">
                  <span className="text-[10px] font-bold text-[#c9a84c] uppercase tracking-wider mb-2">GÜNÜN AYƏSİ</span>
                  <p className="text-xs md:text-sm font-serif text-[#fdf6e3] italic leading-relaxed whitespace-pre-line">
                    {settings.currentAyah}
                  </p>
                </div>
              )}
              {settings.currentHadith && (
                <div className={`flex flex-col items-center text-center px-4 justify-center ${settings.currentAyah ? "pt-4 md:pt-0 md:pl-6" : ""}`}>
                  <span className="text-[10px] font-bold text-[#c9a84c] uppercase tracking-wider mb-2">GÜNÜN HƏDİSİ</span>
                  <p className="text-xs md:text-sm font-serif text-[#fdf6e3] italic leading-relaxed whitespace-pre-line">
                    {settings.currentHadith}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
          
          {/* Column 1: Təyin Olunmuş Səhifələr */}
          <div className="flex flex-col bg-[#05180d]/80 border border-[#c9a84c]/20 rounded-2xl p-5 shadow-inner relative overflow-hidden min-h-[360px]">
            <div className="islamic-card-inner !border-[#c9a84c]/10" />
            <div className="relative z-10 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-center text-sm font-bold text-[#fdf6e3] tracking-wide mb-1 uppercase">Təyin Olunmuş Səhifələr</h3>
                <h4 className="text-center text-[10px] font-bold text-[#c9a84c] uppercase tracking-wider mb-5">Bugünkü Oxu ({activeChunk.length} Səhifə)</h4>
                
                {assignedPages.length === 0 ? (
                  <p className="text-center text-xs text-[#fdf6e3]/50 py-8 leading-relaxed">
                    Hörmətli iştirakçı, sizə hələ heç bir səhifə təyin edilməyib.
                  </p>
                ) : (
                  <div className="w-full space-y-4 border-b border-[#c9a84c]/15 pb-4">
                    {/* Reading Table - Ayat column removed */}
                    <div className="grid grid-cols-2 text-center text-xs font-bold pb-2 text-[#c9a84c] border-b border-[#c9a84c]/15">
                      <span>Surə</span>
                      <span>Səhifələr</span>
                    </div>
                    <div className="grid grid-cols-2 text-center text-[11px] text-[#fdf6e3] font-semibold">
                      <span className="truncate px-1 font-serif text-xs text-[#c9a84c]">{juzDetails.surah}</span>
                      <span className="font-mono">{chunkPagesLabel}</span>
                    </div>
                  </div>
                )}
              </div>

              {assignedPages.length > 0 && (
                <div className="mt-4 space-y-4 flex flex-col items-center">
                  {/* Mark as Complete Button */}
                  {activeChunk.length > 0 ? (
                    <button
                      onClick={handleMarkAsComplete}
                      disabled={isMarking}
                      className="w-full py-2.5 bg-gradient-to-r from-[#c9a84c] to-[#b0913e] text-[#05160c] hover:shadow-lg hover:shadow-[#c9a84c]/20 font-bold rounded-xl text-xs uppercase tracking-wider transition-all select-none border border-[#c9a84c]/50 active:scale-98"
                    >
                      {isMarking ? "Qeyd olunur..." : "OXUNDU OLARAQ QEYD ET"}
                    </button>
                  ) : (
                    <div className="w-full py-2.5 bg-[#1a5c38]/10 text-[#c9a84c] border border-[#c9a84c]/30 text-center font-bold rounded-xl text-xs select-none">
                      TƏBRİKLƏR! BÜTÜN SƏHİFƏLƏRİNİZ OXUNUB
                    </div>
                  )}

                  {/* Quran rehal illustration */}
                  <div className="w-full flex flex-col items-center mt-2 relative">
                    <img 
                      src="/quran-rehal.png" 
                      alt="Quran on Rehal" 
                      className="w-36 h-auto drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)] transform hover:scale-105 transition-transform select-none" 
                    />
                    {/* Gold Base Arc decoration */}
                    <div className="w-36 h-2 bg-gradient-to-r from-transparent via-[#c9a84c]/40 to-transparent rounded-full mt-1.5" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Şəxsi Gedişat */}
          <div className="flex flex-col bg-[#05180d]/80 border border-[#c9a84c]/20 rounded-2xl p-5 shadow-inner relative overflow-hidden min-h-[360px]">
            <div className="islamic-card-inner !border-[#c9a84c]/10" />
            <div className="relative z-10 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-center text-sm font-bold text-[#fdf6e3] tracking-wide mb-5 uppercase">Şəxsi Gedişat</h3>
                
                {/* Circular Progress Ring */}
                <div className="relative w-36 h-36 mx-auto flex items-center justify-center my-2">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                    <circle 
                      cx="60" 
                      cy="60" 
                      r="50" 
                      stroke="rgba(201, 168, 76, 0.08)" 
                      strokeWidth="7" 
                      fill="none" 
                    />
                    <circle 
                      cx="60" 
                      cy="60" 
                      r="50" 
                      stroke="#c9a84c" 
                      strokeWidth="7" 
                      fill="none" 
                      strokeDasharray={2 * Math.PI * 50} 
                      strokeDashoffset={(2 * Math.PI * 50) - (personalPercentage / 100) * (2 * Math.PI * 50)} 
                      strokeLinecap="round" 
                      className="transition-all duration-700 ease-out"
                    />
                  </svg>
                  {/* Percentage in center */}
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-3xl font-extrabold text-[#fdf6e3] tracking-tight font-mono">
                      {personalPercentage}%
                    </span>
                  </div>
                </div>

                <p className="text-center text-[10px] text-[#fdf6e3]/75 font-semibold mt-4">
                  Şəxsi Gedişat: <span className="text-[#c9a84c] font-bold font-mono text-xs ml-0.5">{activeCompleted.length}/{assignedPages.length} Səhifə</span>
                </p>
              </div>

              {/* Stats at bottom */}
              <div className="w-full border-t border-[#c9a84c]/15 pt-4 mt-6 space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#fdf6e3]/65 font-medium">Cari Cüz:</span>
                  <span className="font-extrabold text-[#c9a84c] font-mono text-sm">{user.assignedJuz || "Təyin edilməyib"}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#fdf6e3]/65 font-medium">Son oxu:</span>
                  <span className="font-semibold text-[#fdf6e3]/85 font-mono">{getLastReadTime()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Column 3: Qrup Gedişatı */}
          <div className="flex flex-col bg-[#05180d]/80 border border-[#c9a84c]/20 rounded-2xl p-5 shadow-inner relative overflow-hidden min-h-[360px]">
            <div className="islamic-card-inner !border-[#c9a84c]/10" />
            <div className="relative z-10 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-center text-sm font-bold text-[#fdf6e3] tracking-wide mb-3 uppercase">Qrup Gedişatı</h3>
                
                {/* Horizontal progress bar */}
                <div className="space-y-2 mt-2">
                  <div className="flex justify-between items-center text-[10px] font-bold text-[#c9a84c] uppercase tracking-wider">
                    <span>Qrup Xətm Gedişatı</span>
                    <span className="font-mono text-xs">{groupPercentage}%</span>
                  </div>
                  <div className="w-full h-5 bg-[#030e07] border border-[#c9a84c]/30 rounded-full p-0.5 shadow-inner overflow-hidden relative flex items-center justify-center">
                    <div 
                      className="h-full bg-gradient-to-r from-[#1a5c38] to-[#c9a84c] rounded-full transition-all duration-750 border border-[#c9a84c]/30"
                      style={{ width: `${groupPercentage}%` }}
                    />
                    {/* Centered Percentage Badge inside the bar */}
                    <span className="absolute text-[9px] font-extrabold text-[#fdf6e3] font-mono drop-shadow">{groupPercentage}%</span>
                  </div>
                </div>

                {/* Group Stats */}
                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-b border-[#c9a84c]/15 pb-4">
                  <div className="text-left">
                    <span className="text-[9px] text-[#fdf6e3]/60 uppercase block font-medium">Cəmi Oxunub</span>
                    <span className="text-[11px] font-bold text-[#fdf6e3] font-mono">{totalUniqueCompleted} / 604</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-[#fdf6e3]/60 uppercase block font-medium">Aktiv Oxucular</span>
                    <span className="text-[11px] font-bold text-[#c9a84c] font-mono">{activeRecitersCount} / {allUsers.length}</span>
                  </div>
                </div>
              </div>

              {/* Active Reciters List */}
              <div className="mt-4 flex-1 flex flex-col justify-end">
                <span className="text-[9px] text-[#c9a84c] uppercase tracking-wider font-bold block mb-2">Aktiv Oxucular</span>
                <div className="space-y-2">
                  {allUsers
                    .filter(u => u.approved === true && (u.assignedPages || []).length > 0)
                    .slice(0, 3)
                    .map((reciter) => {
                      const completed = (reciter.completedPages || []).length === (reciter.assignedPages || []).length;
                      return (
                        <div key={reciter.uid} className="flex justify-between items-center bg-[#030e07]/45 p-2 rounded-xl border border-[#c9a84c]/10">
                          <div className="flex items-center gap-2">
                            {reciter.photoURL ? (
                              <img src={reciter.photoURL} alt={reciter.name} className="w-6 h-6 rounded-full border border-[#c9a84c]/20" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-[#1a5c38]/40 border border-[#c9a84c]/20 flex items-center justify-center font-bold text-[#c9a84c] text-[9px]">
                                {reciter.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="flex flex-col text-[10px]">
                              <span className="font-bold text-[#fdf6e3] truncate max-w-[90px]">{reciter.name.split(" ")[0]}</span>
                              <span className="text-[8px] text-[#fdf6e3]/50">{reciter.role === "admin" ? "İnzibatçı" : "İştirakçı"}</span>
                            </div>
                          </div>
                          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${completed ? "text-[#c9a84c] bg-[#c9a84c]/10" : "text-[#fdf6e3]/45 bg-[#fdf6e3]/5"}`}>
                            {completed ? "Tamamladı" : "Oxuyur"}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
