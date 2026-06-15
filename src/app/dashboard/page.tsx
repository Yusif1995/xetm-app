"use client";

import { useAuth } from "@/lib/auth";
import { toggleCompletedPages, type UserDoc, type AppSettings } from "@/lib/db";
import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { db } from "@/lib/firebase";
import { collection, doc, onSnapshot } from "firebase/firestore";

// 1-30 Cüz üzrə Surə aralıqları
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
    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const list: UserDoc[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ uid: docSnap.id, ...docSnap.data() } as UserDoc);
      });
      setAllUsers(list);
    }, (err) => {
      console.error("Error in real-time users listener:", err);
    });

    const unsubSettings = onSnapshot(doc(db, "settings", "config"), (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data() as AppSettings);
      }
    }, (err) => {
      console.error("Error in real-time settings listener:", err);
    });

    return () => {
      unsubUsers();
      unsubSettings();
    };
  }, []);

  if (loading || !user) {
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
  const assignedJuzsList = user.assignedJuzs || (user.assignedJuz ? [user.assignedJuz] : []);
  let displaySurah = "Qrup Xətmi";
  if (assignedJuzsList.length > 0) {
    const firstJuz = assignedJuzsList[0];
    const lastJuz = assignedJuzsList[assignedJuzsList.length - 1];
    const firstSurah = JUZ_MAP[firstJuz]?.surah.split(" - ")[0] || "";
    const lastSurah = JUZ_MAP[lastJuz]?.surah.split(" - ").pop() || "";
    
    if (firstJuz === lastJuz) {
      displaySurah = JUZ_MAP[firstJuz]?.surah || "";
    } else {
      displaySurah = `${firstSurah} - ${lastSurah}`;
    }
  }

  // Tarixlərin hesabı
  const getHijriDate = () => {
    try {
      const today = new Date();
      const formatter = new Intl.DateTimeFormat('en-US-u-ca-islamic', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      const hijriParts = formatter.format(today).split(" ");
      // E.g. "Shawwal 15, 1445 AH" -> "15 Shawwal 1445"
      const day = hijriParts[1]?.replace(",", "") || today.getDate();
      const month = hijriParts[0] || "Shawwal";
      const year = hijriParts[2] || "1445";
      
      const gregorianParts = today.toLocaleDateString("en-US", {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
      return `${day} ${month} ${year} | ${gregorianParts}`;
    } catch {
      return "15 Shawwal 1445 | 13 Oct 2024";
    }
  };

  // Bar Chart Stats
  const getMonthlyStats = () => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const pageCounts = Array(12).fill(0);
    
    allUsers.forEach((u) => {
      if (u.completedAt) {
        Object.values(u.completedAt).forEach((timeStr) => {
          try {
            const date = new Date(timeStr);
            const monthIdx = date.getMonth();
            pageCounts[monthIdx]++;
          } catch {}
        });
      }
    });

    const maxVal = Math.max(...pageCounts, 10);
    return months.map((month, idx) => {
      const count = pageCounts[idx];
      const greenPercent = Math.max(10, Math.round((count / maxVal) * 80));
      return {
        month,
        count,
        greenPercent,
        goldPercent: count > 0 ? 12 : 0
      };
    });
  };

  const monthlyStats = getMonthlyStats();
  const totalReadOverall = completedPagesState.length;
  const avgPagesPerDay = (totalReadOverall / 30).toFixed(1);

  // Son fəaliyyət
  const getRecentActivities = () => {
    const list: { title: string; time: string }[] = [];
    if (user.completedAt) {
      const sorted = Object.entries(user.completedAt)
        .map(([page, time]) => ({ page: Number(page), time: new Date(time).getTime() }))
        .sort((a, b) => b.time - a.time);

      sorted.slice(0, 2).forEach((item) => {
        // Find surah corresponding to page
        let surahName = "Səhifə " + item.page;
        // Search Juz mapping
        const juzNum = Math.floor((item.page - 1) / 20) + 1;
        const juzInfo = JUZ_MAP[juzNum];
        if (juzInfo) {
          surahName = juzInfo.surah.split(" - ")[0];
        }

        const diffMin = Math.floor((Date.now() - item.time) / 60000);
        let timeLabel = "çox əvvəl";
        if (diffMin < 1) timeLabel = "indi";
        else if (diffMin < 60) timeLabel = `${diffMin} dəq əvvəl`;
        else if (diffMin < 1440) timeLabel = `${Math.floor(diffMin / 60)} saat əvvəl`;
        else timeLabel = `${Math.floor(diffMin / 1440)} gün əvvəl`;

        list.push({ title: `${surahName} (Səhifə ${item.page})`, time: timeLabel });
      });
    }

    if (list.length === 0) {
      list.push({ title: "Xətmə başlama", time: "yeni başladı" });
    }
    return list;
  };

  const recentActivities = getRecentActivities();

  return (
    <AppLayout activeTab="dashboard">
      <div className="max-w-6xl mx-auto flex flex-col gap-6 font-sans">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#0F3D2C]/5 pb-4">
          <div className="flex flex-col">
            <h1 className="text-3xl font-bold tracking-tight text-[#0F3D2C]">
              Welcome back, {user.name.split(" ")[0]}!
            </h1>
            <p className="text-xs font-semibold text-[#0F3D2C]/60 mt-1 uppercase tracking-wider">
              {getHijriDate()}
            </p>
          </div>
        </div>

        {/* Prayer Notification Banner */}
        <div className="w-full flex items-center gap-3 px-4 py-3 bg-[#EFE9DF] border border-[#0F3D2C]/10 rounded-2xl text-xs font-semibold text-[#0F3D2C] shadow-sm">
          <span className="text-base">🔔</span>
          <span>Prayer time notification to Tuesday 13 3:30 AM.</span>
        </div>

        {/* Günün Hədisi / Ayəsi */}
        {(settings?.currentAyah || settings?.currentHadith) && (
          <div className="card-premium grid grid-cols-1 md:grid-cols-2 gap-4 divide-y md:divide-y-0 md:divide-x divide-[#0F3D2C]/10 text-[#0F3D2C] relative overflow-hidden">
            {settings.currentAyah && (
              <div className="flex flex-col gap-1 pr-4">
                <span className="text-[10px] font-bold text-[#D5A85A] uppercase tracking-wider">Günün Ayəsi</span>
                <p className="text-xs italic leading-relaxed">{settings.currentAyah}</p>
              </div>
            )}
            {settings.currentHadith && (
              <div className="flex flex-col gap-1 pl-0 md:pl-4 pt-3 md:pt-0">
                <span className="text-[10px] font-bold text-[#D5A85A] uppercase tracking-wider">Günün Hədisi</span>
                <p className="text-xs italic leading-relaxed">{settings.currentHadith}</p>
              </div>
            )}
          </div>
        )}

        {/* Main Content Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Columns (Progress & Graph) */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            
            {/* Three Circular Progress Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              {/* Card 1: Current Khatam (Daily) */}
              <div className="card-premium flex flex-col items-center justify-between text-center relative overflow-hidden min-h-[220px]">
                <span className="text-xs font-bold text-[#0F3D2C] uppercase tracking-wide">
                  Current Khatam (Daily)
                </span>
                
                {/* SVG Circular Indicator */}
                <div className="relative w-28 h-28 my-3 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" stroke="#FAF7F2" strokeWidth="8" fill="none" />
                    <circle 
                      cx="50" 
                      cy="50" 
                      r="42" 
                      stroke="#0F3D2C" 
                      strokeWidth="8" 
                      fill="none" 
                      strokeDasharray={2 * Math.PI * 42} 
                      strokeDashoffset={(2 * Math.PI * 42) - (personalPercentage / 100) * (2 * Math.PI * 42)} 
                      strokeLinecap="round" 
                      className="transition-all duration-700"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-[#0F3D2C]">{personalPercentage}%</span>
                    <span className="text-[8px] text-[#0F3D2C]/60 font-semibold">{activeCompleted.length}/{assignedPages.length} Pages</span>
                  </div>
                </div>

                <div className="w-full flex flex-col items-center gap-1.5">
                  <span className="text-[9px] font-bold text-[#0F3D2C]/70">{displaySurah}</span>
                  {activeChunk.length > 0 ? (
                    <button
                      onClick={handleMarkAsComplete}
                      disabled={isMarking}
                      className="w-full py-1.5 bg-[#0F3D2C] hover:bg-[#1C2E24] text-white text-[9px] font-bold rounded-lg transition-colors uppercase tracking-wider shadow-sm active:scale-95"
                    >
                      {isMarking ? "Qeyd edilir..." : `Qeyd et (${activeChunk[0]}-${activeChunk[activeChunk.length-1]})`}
                    </button>
                  ) : (
                    <span className="text-[9px] font-bold text-[#D5A85A] uppercase bg-[#EFE9DF] px-2 py-0.5 rounded-full">
                      Remaining: 18 Days
                    </span>
                  )}
                </div>
              </div>

              {/* Card 2: Ramadan Prep Khatam */}
              <div className="card-premium flex flex-col items-center justify-between text-center relative min-h-[220px]">
                <span className="text-xs font-bold text-[#0F3D2C] uppercase tracking-wide">
                  Ramadan Prep Khatam
                </span>

                <div className="relative w-28 h-28 my-3 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" stroke="#FAF7F2" strokeWidth="8" fill="none" />
                    <circle 
                      cx="50" 
                      cy="50" 
                      r="42" 
                      stroke="#0F3D2C" 
                      strokeWidth="8" 
                      fill="none" 
                      strokeDasharray={2 * Math.PI * 42} 
                      strokeDashoffset={(2 * Math.PI * 42) - (71 / 100) * (2 * Math.PI * 42)} 
                      strokeLinecap="round" 
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-[#0F3D2C]">71%</span>
                    <span className="text-[8px] text-[#0F3D2C]/60 font-semibold">429/804 Pages</span>
                  </div>
                </div>

                <div className="w-full flex flex-col items-center gap-1">
                  <span className="text-[9px] font-bold text-[#0F3D2C]/70">Surah An-Nur</span>
                  <span className="text-[9px] font-bold text-[#D5A85A] uppercase bg-[#EFE9DF] px-2 py-0.5 rounded-full">
                    Remaining: 7 Days
                  </span>
                </div>
              </div>

              {/* Card 3: Group Khatam (Team Nur) */}
              <div className="card-premium flex flex-col items-center justify-between text-center relative min-h-[220px]">
                <span className="text-xs font-bold text-[#0F3D2C] uppercase tracking-wide">
                  Group Khatam (Team Nur)
                </span>

                <div className="relative w-28 h-28 my-3 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" stroke="#FAF7F2" strokeWidth="8" fill="none" />
                    <circle 
                      cx="50" 
                      cy="50" 
                      r="42" 
                      stroke="#0F3D2C" 
                      strokeWidth="8" 
                      fill="none" 
                      strokeDasharray={2 * Math.PI * 42} 
                      strokeDashoffset={(2 * Math.PI * 42) - (groupPercentage / 100) * (2 * Math.PI * 42)} 
                      strokeLinecap="round" 
                      className="transition-all duration-700"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-[#0F3D2C]">{groupPercentage}%</span>
                    <span className="text-[8px] text-[#0F3D2C]/60 font-semibold">{totalUniqueCompleted}/604 Pages</span>
                  </div>
                </div>

                <div className="w-full flex flex-col items-center gap-1">
                  <span className="text-[9px] font-bold text-[#0F3D2C]/70">Surah Al-Baqarah</span>
                  <span className="text-[9px] font-bold text-[#D5A85A] uppercase bg-[#EFE9DF] px-2 py-0.5 rounded-full">
                    Remaining: 21 Days
                  </span>
                </div>
              </div>

            </div>

            {/* Reading Statistics Chart Card */}
            <div className="card-premium flex flex-col gap-5">
              <div className="flex justify-between items-center border-b border-[#0F3D2C]/5 pb-3">
                <span className="text-sm font-bold text-[#0F3D2C]">Reading Statistics (October)</span>
                
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <div>
                    <span className="text-lg font-bold text-[#0F3D2C] mr-1">{avgPagesPerDay}</span>
                    <span className="text-[#0F3D2C]/60 text-[10px]">Avg Pgs/Day</span>
                  </div>
                  <div className="h-6 w-[1px] bg-[#0F3D2C]/10" />
                  <div>
                    <span className="text-lg font-bold text-[#0F3D2C] mr-1">{totalReadOverall}</span>
                    <span className="text-[#0F3D2C]/60 text-[10px]">Pages Total</span>
                  </div>
                </div>
              </div>

              {/* Bar Chart Visualization */}
              <div className="w-full h-44 flex items-end justify-between px-2 pt-4 border-b border-[#0F3D2C]/10 pb-1">
                {monthlyStats.map((stat) => (
                  <div key={stat.month} className="flex-1 flex flex-col items-center group h-full justify-end relative">
                    {/* Tooltip on Hover */}
                    <span className="absolute -top-6 text-[9px] font-bold text-[#0F3D2C] bg-[#EFE9DF] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      {stat.count} pgs
                    </span>
                    
                    {/* Bar Container */}
                    <div className="w-4 sm:w-6 rounded-t-sm flex flex-col justify-end overflow-hidden h-full relative">
                      {/* Main Green Bar Segment */}
                      <div 
                        className="w-full bg-[#0F3D2C] transition-all duration-700" 
                        style={{ height: `${stat.greenPercent}%` }}
                      />
                      {/* Gold Tip Segment */}
                      {stat.count > 0 && (
                        <div 
                          className="w-full bg-[#D5A85A] transition-all duration-700 absolute top-0" 
                          style={{ height: `${stat.goldPercent}%`, bottom: `${stat.greenPercent}%` }}
                        />
                      )}
                    </div>

                    {/* Month Label */}
                    <span className="text-[10px] font-bold text-[#0F3D2C]/50 mt-2">
                      {stat.month}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right Column widgets */}
          <div className="flex flex-col gap-6">
            
            {/* Your Profile Card */}
            <div className="card-premium flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-[#0F3D2C]">Your Profile</span>
                <span className="text-xs text-[#0F3D2C]/60">❯</span>
              </div>
              
              <div className="flex items-center gap-3">
                {user.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt={user.name} 
                    className="w-12 h-12 rounded-full border border-[#0F3D2C]/10 object-cover" 
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[#EAE3D5] flex items-center justify-center text-xl text-[#0F3D2C] font-bold border border-[#0F3D2C]/10">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-[#0F3D2C]">{user.name}</span>
                  <span className="text-[10px] text-[#0F3D2C]/60 font-semibold">Level 7 Reader</span>
                  <span className="text-[10px] text-[#0F3D2C]/40 font-medium leading-none">Level 7 Reader</span>
                </div>
              </div>

              <div className="border-t border-[#0F3D2C]/5 pt-3 mt-1 flex flex-col gap-1.5 text-xs text-[#0F3D2C]/85 font-semibold">
                <div className="flex justify-between">
                  <span>Completed Khatams</span>
                  <span className="font-bold text-[#0F3D2C]">3 Khatams</span>
                </div>
                <div className="flex justify-between">
                  <span>Streak counter</span>
                  <span className="font-bold text-[#0F3D2C]">12 days</span>
                </div>
              </div>
            </div>

            {/* Recent Activity Card */}
            <div className="card-premium flex flex-col gap-3.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0F3D2C] border-b border-[#0F3D2C]/5 pb-2">
                Recent Activity
              </span>
              
              <div className="flex flex-col gap-3">
                {recentActivities.map((act, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#0F3D2C] border-2 border-[#EFE9DF]" />
                      <span className="font-bold text-[#0F3D2C] truncate max-w-[130px]">{act.title}</span>
                    </div>
                    <span className="text-[10px] text-[#0F3D2C]/50 font-medium">{act.time}</span>
                  </div>
                ))}

                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FAF7F2] border-2 border-[#0F3D2C]/30" />
                    <span className="font-bold text-[#0F3D2C]/60">Al-Baqarah</span>
                  </div>
                  <span className="text-[10px] text-[#0F3D2C]/40 font-medium">updated mm ago</span>
                </div>
              </div>
            </div>

            {/* Upcoming Goals Card */}
            <div className="card-premium flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-[#0F3D2C]">Upcoming Goals</span>
                <span className="text-xs text-[#0F3D2C]/60">❯</span>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#EFE9DF] flex items-center justify-center text-sm">
                    📅
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[#0F3D2C]">Finish Al-Kahf by 15 Oct</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full mt-2">
                  <div className="w-full h-2 bg-[#EFE9DF] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#0F3D2C] rounded-full" 
                      style={{ width: `${personalPercentage}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </AppLayout>
  );
}
