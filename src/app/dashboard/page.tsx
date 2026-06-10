"use client";

import { useAuth } from "@/lib/auth";
import { getAllUsers, toggleCompletedPages, type UserDoc } from "@/lib/db";
import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";

// 1-30 Juz to Surah & Ayat Mapping
const JUZ_MAP: Record<number, { surah: string; ayat: string }> = {
  1: { surah: "Əl-Fatihə / Əl-Bəqərə", ayat: "1:1 - 2:141" },
  2: { surah: "Əl-Bəqərə", ayat: "2:142 - 2:252" },
  3: { surah: "Əl-Bəqərə / Ali-İmran", ayat: "2:253 - 3:92" },
  4: { surah: "Ali-İmran / An-Nisa", ayat: "3:93 - 4:23" },
  5: { surah: "An-Nisa", ayat: "4:24 - 4:147" },
  6: { surah: "An-Nisa / Al-Maidə", ayat: "4:148 - 5:81" },
  7: { surah: "Al-Maidə / Al-Ənam", ayat: "5:82 - 6:110" },
  8: { surah: "Al-Ənam / Al-Əraf", ayat: "6:111 - 7:87" },
  9: { surah: "Al-Əraf / Al-Ənfal", ayat: "7:88 - 8:40" },
  10: { surah: "Al-Ənfal / At-Tövbə", ayat: "8:41 - 9:92" },
  11: { surah: "At-Tövbə / Hud", ayat: "9:93 - 11:5" },
  12: { surah: "Hud / Yusuf", ayat: "11:6 - 12:52" },
  13: { surah: "Yusuf / Ar-Rad / İbrahim", ayat: "12:53 - 14:52" },
  14: { surah: "Al-Hicr / An-Nahl", ayat: "15:1 - 16:128" },
  15: { surah: "Al-İsra / Al-Kəhf", ayat: "17:1 - 18:74" },
  16: { surah: "Al-Kəhf / Məryəm / Taha", ayat: "18:75 - 20:135" },
  17: { surah: "Al-Ənbiya / Al-Həcc", ayat: "21:1 - 22:78" },
  18: { surah: "Al-Muminun / An-Nur / Al-Furqan", ayat: "23:1 - 25:20" },
  19: { surah: "Al-Furqan / Ash-Shuara / An-Naml", ayat: "25:21 - 27:55" },
  20: { surah: "An-Naml / Al-Qasas / Al-Ankabut", ayat: "27:56 - 29:45" },
  21: { surah: "Al-Ankabut / Ar-Rum / Luqman / As-Sajdah / Al-Ahzab", ayat: "29:46 - 33:30" },
  22: { surah: "Al-Ahzab / Saba / Fatir / Yasin", ayat: "33:31 - 36:27" },
  23: { surah: "Yasin / As-Saffat / Sad / Az-Zumar", ayat: "36:28 - 39:31" },
  24: { surah: "Az-Zumar / Ghafir / Fussilat", ayat: "39:32 - 41:46" },
  25: { surah: "Fussilat / Ash-Shura / Az-Zuxruf / Ad-Duxan / Al-Jasiya", ayat: "41:47 - 45:37" },
  26: { surah: "Al-Ahqaf / Muhammad / Al-Fath / Al-Hujurat / Qaf / Az-Zariyat", ayat: "46:1 - 51:30" },
  27: { surah: "Az-Zariyat / At-Tur / An-Najm / Al-Qamar / Ar-Rahman / Al-Waqiah / Al-Hadid", ayat: "51:31 - 57:29" },
  28: { surah: "Al-Mujadilah - At-Tahrim", ayat: "Surə 58 - 66" },
  29: { surah: "Al-Mulk - Al-Mursalat", ayat: "Surə 67 - 77" },
  30: { surah: "An-Naba - An-Nas", ayat: "Surə 78 - 114" }
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

  useEffect(() => {
    if (user) {
      setCompletedPagesState(user.completedPages || []);
    }
  }, [user]);

  useEffect(() => {
    async function loadData() {
      try {
        const usersList = await getAllUsers();
        setAllUsers(usersList);
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

  // Find the first uncompleted 5-page chunk
  const sortedPages = [...assignedPages].sort((a, b) => a - b);
  const chunks: number[][] = [];
  for (let i = 0; i < sortedPages.length; i += 5) {
    chunks.push(sortedPages.slice(i, i + 5));
  }
  const activeChunk = chunks.find(chunk => !chunk.every(page => completedPagesState.includes(page))) || chunks[0] || [];

  // Personal percentage
  const personalPercentage = assignedPages.length > 0
    ? Math.round((activeCompleted.length / assignedPages.length) * 100)
    : 0;

  // Group stats calculation
  // Total completed pages across all users
  const totalAssignedPagesList = allUsers.flatMap(u => u.assignedPages || []);
  const totalUniqueAssigned = Array.from(new Set(totalAssignedPagesList)).length;

  const totalCompletedPagesList = allUsers.flatMap(u => u.completedPages || []);
  const totalUniqueCompleted = Array.from(new Set(totalCompletedPagesList)).length;

  const groupPercentage = totalUniqueAssigned > 0 
    ? Math.round((totalUniqueCompleted / 604) * 100) 
    : 0;

  const activeRecitersCount = allUsers.filter(u => (u.assignedPages || []).length > 0).length;

  // Last read minutes calculation
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

  // Mark active chunk as complete
  const handleMarkAsComplete = async () => {
    if (activeChunk.length === 0 || isMarking) return;
    setIsMarking(true);
    try {
      await toggleCompletedPages(user.uid, activeChunk, true);
      // Sync local state
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

  // Surah / Ayat / Pages for Active Chunk
  const juzDetails = JUZ_MAP[user.assignedJuz || 30] || { surah: "Qrup Xətmi", ayat: "Quran" };
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
          Quran Khatm Dashboard
        </h1>

        {/* 3-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
          
          {/* Column 1: Your Assigned Pages */}
          <div className="flex flex-col bg-[#05180d]/80 border border-[#c9a84c]/20 rounded-2xl p-5 shadow-inner relative overflow-hidden min-h-[360px]">
            <div className="islamic-card-inner !border-[#c9a84c]/10" />
            <div className="relative z-10 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-center text-sm font-bold text-[#fdf6e3] tracking-wide mb-1 uppercase">Your Assigned Pages</h3>
                <h4 className="text-center text-[11px] font-bold text-[#c9a84c] uppercase tracking-wider mb-5">Today&apos;s Reading ({activeChunk.length} Pages)</h4>
                
                {assignedPages.length === 0 ? (
                  <p className="text-center text-xs text-[#fdf6e3]/50 py-8 leading-relaxed">
                    Hörmətli iştirakçı, sizə hələ heç bir səhifə təyin edilməyib.
                  </p>
                ) : (
                  <div className="w-full space-y-4 border-b border-[#c9a84c]/15 pb-4">
                    {/* Reading Table */}
                    <div className="grid grid-cols-3 text-center text-xs font-bold pb-2 text-[#c9a84c] border-b border-[#c9a84c]/15">
                      <span>Surah</span>
                      <span>Ayat</span>
                      <span>Pages</span>
                    </div>
                    <div className="grid grid-cols-3 text-center text-[11px] text-[#fdf6e3] font-semibold">
                      <span className="truncate px-1">{juzDetails.surah.split("/")[0].trim()}</span>
                      <span className="font-mono">{juzDetails.ayat.split("-")[0].trim()}</span>
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
                      {isMarking ? "Yadda saxlanılır..." : "Mark as Complete"}
                    </button>
                  ) : (
                    <div className="w-full py-2.5 bg-[#1a5c38]/10 text-[#c9a84c] border border-[#c9a84c]/30 text-center font-bold rounded-xl text-xs select-none">
                      TƏBRİKLƏR! BÜTÜN SƏHİFƏLƏR OXUNDU
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

          {/* Column 2: Personal Progress */}
          <div className="flex flex-col bg-[#05180d]/80 border border-[#c9a84c]/20 rounded-2xl p-5 shadow-inner relative overflow-hidden min-h-[360px]">
            <div className="islamic-card-inner !border-[#c9a84c]/10" />
            <div className="relative z-10 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-center text-sm font-bold text-[#fdf6e3] tracking-wide mb-5 uppercase">Personal Progress</h3>
                
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
                  Personal Progress: <span className="text-[#c9a84c] font-bold font-mono text-xs ml-0.5">{activeCompleted.length}/{assignedPages.length} Pages</span>
                </p>
              </div>

              {/* Stats at bottom */}
              <div className="w-full border-t border-[#c9a84c]/15 pt-4 mt-6 space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#fdf6e3]/65 font-medium">Current Juz:</span>
                  <span className="font-extrabold text-[#c9a84c] font-mono text-sm">{user.assignedJuz || "Təyin edilməyib"}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#fdf6e3]/65 font-medium">Last Read:</span>
                  <span className="font-semibold text-[#fdf6e3]/85 font-mono">{getLastReadTime()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Column 3: Group Progress */}
          <div className="flex flex-col bg-[#05180d]/80 border border-[#c9a84c]/20 rounded-2xl p-5 shadow-inner relative overflow-hidden min-h-[360px]">
            <div className="islamic-card-inner !border-[#c9a84c]/10" />
            <div className="relative z-10 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-center text-sm font-bold text-[#fdf6e3] tracking-wide mb-3 uppercase">Group Progress</h3>
                
                {/* Horizontal progress bar */}
                <div className="space-y-2 mt-2">
                  <div className="flex justify-between items-center text-[10px] font-bold text-[#c9a84c] uppercase tracking-wider">
                    <span>Group Khatm Progress</span>
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
                    <span className="text-[9px] text-[#fdf6e3]/60 uppercase block font-medium">Total Read</span>
                    <span className="text-[11px] font-bold text-[#fdf6e3] font-mono">{totalUniqueCompleted} / 604</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-[#fdf6e3]/60 uppercase block font-medium">Active Reciters</span>
                    <span className="text-[11px] font-bold text-[#c9a84c] font-mono">{activeRecitersCount} / {allUsers.length}</span>
                  </div>
                </div>
              </div>

              {/* Active Reciters List */}
              <div className="mt-4 flex-1 flex flex-col justify-end">
                <span className="text-[9px] text-[#c9a84c] uppercase tracking-wider font-bold block mb-2">Active Reciters</span>
                <div className="space-y-2">
                  {allUsers
                    .filter(u => (u.assignedPages || []).length > 0)
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
                              <span className="text-[8px] text-[#fdf6e3]/50 capitalize">{reciter.role}</span>
                            </div>
                          </div>
                          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${completed ? "text-[#c9a84c] bg-[#c9a84c]/10" : "text-[#fdf6e3]/45 bg-[#fdf6e3]/5"}`}>
                            {completed ? "Completed" : "Reading"}
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
