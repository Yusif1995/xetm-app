"use client";

import { useAuth } from "@/lib/auth";
import { toggleCompletedPages, type UserDoc, type AppSettings, getGroupDoc, updateUserGroup, type GroupDoc } from "@/lib/db";
import { useEffect, useState, Suspense } from "react";
import AppLayout from "@/components/AppLayout";
import { db } from "@/lib/firebase";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { useSearchParams } from "next/navigation";

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

function DashboardContent() {
  const { user, loading, refreshUser } = useAuth();
  const [allUsers, setAllUsers] = useState<UserDoc[]>([]);
  const [completedPagesState, setCompletedPagesState] = useState<number[]>([]);
  const [isMarking, setIsMarking] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  const searchParams = useSearchParams();
  const [inviteGroup, setInviteGroup] = useState<GroupDoc | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const inviteGroupId = searchParams.get("invite");
  useEffect(() => {
    if (user && inviteGroupId && inviteGroupId !== (user.groupId || "default")) {
      getGroupDoc(inviteGroupId).then((group) => {
        if (group) {
          setInviteGroup(group);
          setShowInviteModal(true);
        }
      });
    }
  }, [user, inviteGroupId]);

  const handleJoinGroup = async () => {
    if (!user || !inviteGroup) return;
    try {
      await updateUserGroup(user.uid, inviteGroup.id, false);
      setShowInviteModal(false);
      window.history.replaceState({}, "", "/dashboard");
      window.location.reload();
    } catch (err) {
      console.error("Error joining group:", err);
    }
  };

  const handleCancelInvite = () => {
    setShowInviteModal(false);
    window.history.replaceState({}, "", "/dashboard");
  };

  useEffect(() => {
    if (user) {
      setCompletedPagesState(user.completedPages || []);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    
    const userGroup = user.groupId || "default";

    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const list: UserDoc[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const totalCompletedPages = data.totalCompletedPages !== undefined
          ? data.totalCompletedPages
          : ((data.completedPages?.length || 0) + (data.previousCompletedPages?.length || 0));
        list.push({ uid: docSnap.id, ...data, totalCompletedPages } as UserDoc);
      });
      // Filter list by same group and only approved ones
      const filtered = list.filter((u) => (u.groupId || "default") === userGroup && u.approved !== false);
      setAllUsers(filtered);
    }, (err) => {
      console.error("Error in real-time users listener:", err);
    });

    const settingsRef = userGroup === "default"
      ? doc(db, "settings", "config")
      : doc(db, "groups", userGroup);

    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as AppSettings;
        setSettings({
          currentAyah: data.currentAyah || "İnna lilləhi və inna ileyhi raciun",
          currentHadith: data.currentHadith || "Sizin ən xeyirliniz Quranı öyrənən və onu başqalarına öyrədəndir.",
          lastDistributedJuz: data.lastDistributedJuz || 0,
          cycleStartJuz: data.cycleStartJuz || 1,
          completedKhatms: data.completedKhatms || 0,
          isCurrentKhatmCompleted: data.isCurrentKhatmCompleted || false,
          currentDailyItem: data.currentDailyItem,
          lastDailyUpdate: data.lastDailyUpdate
        });
      }
    }, (err) => {
      console.error("Error in real-time settings listener:", err);
    });

    return () => {
      unsubUsers();
      unsubSettings();
    };
  }, [user]);

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
      // en-US locale for Hijri date
      const hijriFormatter = new Intl.DateTimeFormat('en-US-u-ca-islamic', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      const hijriParts = hijriFormatter.format(today).replace(" AH", "").replace(" A.H.", "").split(" ");
      const hDay = hijriParts[1]?.replace(",", "") || today.getDate();
      const hMonth = hijriParts[0] || "Muharram";
      const hYear = hijriParts[2] || "1448";
      const hijriDate = `${hDay} ${hMonth} ${hYear}`;

      // en-US locale for Gregorian date formatted as: day Month year (e.g. 16 Jun 2026)
      const gregorianFormatter = new Intl.DateTimeFormat('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
      const gParts = gregorianFormatter.formatToParts(today);
      const gDay = gParts.find(p => p.type === 'day')?.value || today.getDate();
      const gMonth = gParts.find(p => p.type === 'month')?.value || "Jun";
      const gYear = gParts.find(p => p.type === 'year')?.value || today.getFullYear();
      const gregorianDate = `${gDay} ${gMonth} ${gYear}`;

      return `${hijriDate} | ${gregorianDate}`;
    } catch {
      return "1 Muharram 1448 | 16 Jun 2026";
    }
  };



  // Son fəaliyyət
  const getRecentActivities = () => {
    const list: { title: string; time: string }[] = [];
    if (user.completedAt) {
      const sorted = Object.entries(user.completedAt)
        .map(([page, time]) => ({ page: Number(page), time: new Date(time).getTime() }))
        .sort((a, b) => b.time - a.time);

      sorted.slice(0, 5).forEach((item) => {
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

  // Card 2 üçün dinamik hesablamalar
  const prevAssigned = user.previousAssignedPages || [];
  const prevCompleted = user.previousCompletedPages || [];
  const hasPrev = prevAssigned.length > 0;
  
  const activePrevCompleted = prevCompleted.filter(p => prevAssigned.includes(p));
  const prevPercentage = hasPrev 
    ? Math.round((activePrevCompleted.length / prevAssigned.length) * 100)
    : 0;

  const personalTotalCompleted = completedPagesState.length;
  const personalContributionPercentage = Math.round((personalTotalCompleted / 604) * 100);

  let displayPrevSurah = "Əvvəlki Xətm";
  if (prevAssigned.length > 0) {
    const firstPage = Math.min(...prevAssigned);
    const lastPage = Math.max(...prevAssigned);
    const firstJuz = Math.floor((firstPage - 1) / 20) + 1;
    const lastJuz = Math.floor((lastPage - 1) / 20) + 1;
    const firstSurah = JUZ_MAP[firstJuz]?.surah.split(" - ")[0] || "";
    const lastSurah = JUZ_MAP[lastJuz]?.surah.split(" - ").pop() || "";
    if (firstJuz === lastJuz) {
      displayPrevSurah = JUZ_MAP[firstJuz]?.surah || "";
    } else {
      displayPrevSurah = `${firstSurah} - ${lastSurah}`;
    }
  }


  
  // Tamamlanmış ümumi səhifələrin sayı
  const totalPagesCompleted = user.totalCompletedPages !== undefined
    ? user.totalCompletedPages
    : (completedPagesState.length + (user.previousCompletedPages?.length || 0));

  // Dinamik ardıcıllıq (streak) hesabı
  const getStreak = () => {
    if (!user.completedAt || Object.keys(user.completedAt).length === 0) return 0;
    const dates = Object.values(user.completedAt)
      .map(timeStr => new Date(timeStr).toDateString())
      .filter((value, index, self) => self.indexOf(value) === index)
      .map(d => new Date(d).getTime())
      .sort((a, b) => b - a);

    let streak = 0;
    const oneDay = 24 * 60 * 60 * 1000;
    const today = new Date(new Date().toDateString()).getTime();
    
    if (dates[0] < today - oneDay) {
      return 0;
    }

    let expected = today;
    if (dates[0] === today - oneDay) {
      expected = today - oneDay;
    }

    for (let i = 0; i < dates.length; i++) {
      if (dates[i] === expected) {
        streak++;
        expected -= oneDay;
      } else if (dates[i] > expected) {
        continue;
      } else {
        break;
      }
    }
    return streak;
  };
  const userStreak = getStreak();

  return (
    <AppLayout activeTab="dashboard">
      <div className="max-w-6xl mx-auto flex flex-col gap-6 font-sans">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#0F3D2C]/5 pb-4">
          <div className="flex flex-col">
            <h1 className="text-3xl font-bold tracking-tight text-[#0F3D2C]">
              Xoş gördük, {user.name.split(" ")[0]}!
            </h1>
            <p className="text-xs font-semibold text-[#0F3D2C]/60 mt-1 uppercase tracking-wider">
              {getHijriDate()}
            </p>
          </div>
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
          
          {/* Left Columns (Progress Cards) */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            
            {/* Three Circular Progress Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              {/* Card 1: Aktiv Xətm (Günlük) */}
              <div className="card-premium flex flex-col items-center justify-between text-center relative overflow-hidden min-h-[220px]">
                <span className="text-xs font-bold text-[#0F3D2C] uppercase tracking-wide">
                  Aktiv Xətm (Günlük)
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
                    <span className="text-[8px] text-[#0F3D2C]/60 font-semibold">{activeCompleted.length}/{assignedPages.length} Səhifə</span>
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
                      Tamamlanıb
                    </span>
                  )}
                </div>
              </div>

              {/* Card 2: Previous Assignment / Personal Contribution */}
              <div className="card-premium flex flex-col items-center justify-between text-center relative min-h-[220px]">
                <span className="text-xs font-bold text-[#0F3D2C] uppercase tracking-wide">
                  {hasPrev ? "Əvvəlki Tapşırıq" : "Şəxsi Töhfə"}
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
                      strokeDashoffset={(2 * Math.PI * 42) - ((hasPrev ? prevPercentage : personalContributionPercentage) / 100) * (2 * Math.PI * 42)} 
                      strokeLinecap="round" 
                      className="transition-all duration-700"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-[#0F3D2C]">
                      {hasPrev ? prevPercentage : personalContributionPercentage}%
                    </span>
                    <span className="text-[8px] text-[#0F3D2C]/60 font-semibold">
                      {hasPrev 
                        ? `${activePrevCompleted.length}/${prevAssigned.length} Səhifə` 
                        : `${personalTotalCompleted}/604 Səhifə`
                      }
                    </span>
                  </div>
                </div>

                <div className="w-full flex flex-col items-center gap-1">
                  <span className="text-[9px] font-bold text-[#0F3D2C]/70">
                    {hasPrev ? displayPrevSurah : "Ümumi Mütaliə"}
                  </span>
                  <span className="text-[9px] font-bold text-[#D5A85A] uppercase bg-[#EFE9DF] px-2 py-0.5 rounded-full">
                    {hasPrev 
                      ? (prevPercentage === 100 ? "Tamamlanıb" : "Davam edir") 
                      : "Xətm Töhfəsi"
                    }
                  </span>
                </div>
              </div>

              {/* Card 3: Qrup Xətmi (Ümumi Gedişat) */}
              <div className="card-premium flex flex-col items-center justify-between text-center relative min-h-[220px]">
                <span className="text-xs font-bold text-[#0F3D2C] uppercase tracking-wide">
                  Qrup Xətmi (Ümumi Gedişat)
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
                    <span className="text-[8px] text-[#0F3D2C]/60 font-semibold">{totalUniqueCompleted}/604 Səhifə</span>
                  </div>
                </div>

                <div className="w-full flex flex-col items-center gap-1">
                  <span className="text-[9px] font-bold text-[#0F3D2C]/70">Əl-Bəqərə surəsi</span>
                  <span className="text-[9px] font-bold text-[#D5A85A] uppercase bg-[#EFE9DF] px-2 py-0.5 rounded-full">
                    Davam edir
                  </span>
                </div>
              </div>

            </div>

          </div>

          {/* Right Column widgets */}
          <div className="flex flex-col gap-6">
            
            {/* Profile Card */}
            <div className="card-premium flex flex-col gap-4">
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
                </div>
              </div>

              <div className="border-t border-[#0F3D2C]/5 pt-3 mt-1 flex flex-col gap-1.5 text-xs text-[#0F3D2C]/85 font-semibold">
                <div className="flex justify-between">
                  <span>Tamamlanmış Səhifələr</span>
                  <span className="font-bold text-[#0F3D2C]">{totalPagesCompleted} Səhifə</span>
                </div>
                <div className="flex justify-between">
                  <span>Ardıcıllıq (Gün)</span>
                  <span className="font-bold text-[#0F3D2C]">{userStreak} gün</span>
                </div>
              </div>
            </div>

            {/* Recent Activity Card */}
            <div className="card-premium flex flex-col gap-3.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0F3D2C] border-b border-[#0F3D2C]/5 pb-2">
                Son Fəaliyyət
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
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Group Invite Confirmation Modal */}
      {showInviteModal && inviteGroup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in animate-[fadeIn_0.2s_ease-out]">
          <div className="card-premium w-full max-w-md p-6 relative border border-[#D5A85A]/30 shadow-2xl bg-[#F7F4EB] text-center flex flex-col items-center">
            {/* Ornament */}
            <div className="w-12 h-12 bg-[#0F3D2C] rounded-2xl flex items-center justify-center border border-[#D5A85A]/35 mb-4 shadow-md">
              <span className="text-2xl">👥</span>
            </div>
            
            <h3 className="text-xl font-bold text-[#0F3D2C] mb-2">Qrup Dəvəti</h3>
            
            <p className="text-sm text-[#0F3D2C]/75 leading-relaxed mb-6 font-sans">
              Siz yeni <strong>“{inviteGroup.name}”</strong> qrupuna dəvət aldınız. Bu qrupa qoşulmaq istəyirsiniz?
              <br /><br />
              <span className="text-xs font-semibold text-amber-700 bg-amber-500/10 p-3 rounded-lg block border border-amber-500/20">
                ⚠️ Diqqət: Qoşulduqdan sonra köhnə qrupunuzdakı cüz/səhifə təyinatlarınız silinəcək və bu qrupda fəaliyyətə başlamaq üçün admin təsdiqini gözləməli olacaqsınız.
              </span>
            </p>
            
            <div className="flex gap-3 w-full">
              <button
                onClick={handleJoinGroup}
                className="flex-1 py-2.5 bg-[#0F3D2C] hover:bg-[#16503c] text-white rounded-xl font-bold text-xs transition-colors shadow-sm"
              >
                Qoşul
              </button>
              <button
                onClick={handleCancelInvite}
                className="flex-1 py-2.5 bg-[#EFE9DF] hover:bg-[#E5DDCB] text-[#0F3D2C] rounded-xl font-bold text-xs transition-colors"
              >
                İmtina et
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex flex-col justify-center items-center bg-[#FAF7F2] text-[#0F3D2C] min-h-screen">
        <div className="animate-spin h-10 w-10 text-[#0F3D2C] mb-4">
          <svg className="w-full h-full" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
        <p className="text-sm font-semibold tracking-wide text-[#0F3D2C]/80">Yüklənir...</p>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
