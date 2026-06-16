"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { 
  getAllUsers, 
  getGlobalSettings, 
  setGlobalSettings, 
  setAssignmentForUser,
  distributeJuzToUsers,
  updateUserRole,
  clearAllAssignments,
  updateUserAdminNotification,
  deleteUserDoc,
  type UserDoc, 
  type AppSettings 
} from "@/lib/db";
import ProgressBar from "@/components/ProgressBar";
import UserRow from "@/components/UserRow";
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

export default function AdminPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Selection and form state for assigning pages
  const [selectedUser, setSelectedUser] = useState<UserDoc | null>(null);
  const [pagesInput, setPagesInput] = useState("");
  const [startDateInput, setStartDateInput] = useState("");
  const [endDateInput, setEndDateInput] = useState("");
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);

  // Auto distribution modal state
  const [showAutoModal, setShowAutoModal] = useState(false);
  const [autoStartDate, setAutoStartDate] = useState("");
  const [autoEndDate, setAutoEndDate] = useState("");
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoSuccess, setAutoSuccess] = useState(false);
  const [autoError, setAutoError] = useState<string | null>(null);

  // Settings state
  const [settings, setSettings] = useState<AppSettings>({ currentAyah: "", currentHadith: "" });
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [showParticipantsList, setShowParticipantsList] = useState(true);

  // Local states for the 30 Juz group setup
  const [groupStartDate, setGroupStartDate] = useState("");
  const [groupEndDate, setGroupEndDate] = useState("");

  async function loadData() {
    try {
      const allUsers = await getAllUsers();
      setUsers(allUsers);
      const appSettings = await getGlobalSettings();
      setSettings(appSettings);
    } catch (err) {
      console.error("Error loading admin data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const list: UserDoc[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const totalCompletedPages = data.totalCompletedPages !== undefined
          ? data.totalCompletedPages
          : ((data.completedPages?.length || 0) + (data.previousCompletedPages?.length || 0));
        list.push({ uid: docSnap.id, ...data, totalCompletedPages } as UserDoc);
      });
      setUsers(list);
      setLoading(false);
    }, (err) => {
      console.error("Error in real-time users listener:", err);
      setLoading(false);
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

  // Set default group dates based on current assignments if available
  useEffect(() => {
    const assignedUser = users.find(u => u.assignmentStartDate);
    if (assignedUser) {
      if (!groupStartDate) setGroupStartDate(assignedUser.assignmentStartDate || "");
      if (!groupEndDate) setGroupEndDate(assignedUser.assignmentEndDate || "");
    }
  }, [users, groupStartDate, groupEndDate]);

  if (authLoading || loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-[#FAF7F2] text-[#0F3D2C] min-h-screen">
        <div className="animate-spin h-10 w-10 text-[#0F3D2C] mb-4">
          <svg className="w-full h-full" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
        <p className="text-sm font-semibold tracking-wide text-[#0F3D2C]/80">İnzibatçı paneli yüklənir...</p>
      </div>
    );
  }

  if (!currentUser || currentUser.role !== "admin") {
    return null; // Guarded by middleware
  }

  // Calculate unique pages completed by the group out of 604
  const completedPagesSet = new Set<number>();
  users.forEach((u) => {
    const assigned = u.assignedPages || [];
    const completed = u.completedPages || [];
    completed.forEach((page) => {
      if (page >= 1 && page <= 604 && assigned.includes(page)) {
        completedPagesSet.add(page);
      }
    });
  });
  const totalUniqueCompleted = completedPagesSet.size;

  const handleRoleToggle = async (user: UserDoc) => {
    try {
      const newRole = user.role === "admin" ? "user" : "admin";
      await updateUserRole(user.uid, newRole);
      await loadData();
    } catch (err) {
      console.error("Error toggling role:", err);
      alert("Rol dəyişdirilərkən xəta baş verdi.");
    }
  };

  const handleClearAll = async () => {
    if (window.confirm("Bütün iştirakçıların səhifə təyinatlarını və arxiv tarixçələrini tamamilə sıfırlamaq (təmizləmək) istəyirsiniz?")) {
      try {
        setLoading(true);
        await clearAllAssignments();
        alert("Bütün səhifə təyinatları uğurla təmizləndi.");
        await loadData();
      } catch (err) {
        console.error("Error clearing assignments:", err);
        alert("Təmizləmə zamanı xəta baş verdi.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleNotifyClick = async (user: UserDoc) => {
    const msg = window.prompt(
      "İştirakçıya admin bildirişi daxil edin (Boş buraxdıqda mövcud bildiriş silinir):",
      user.adminNotification || ""
    );
    if (msg !== null) {
      try {
        await updateUserAdminNotification(user.uid, msg);
        await loadData();
      } catch (err) {
        console.error("Error updating admin notification:", err);
        alert("Bildiriş göndərilərkən xəta baş verdi.");
      }
    }
  };

  const handleRemoveUser = async (user: UserDoc) => {
    if (window.confirm(`${user.name} adlı iştirakçını qrupdan silmək istədiyinizə əminsiniz?`)) {
      try {
        setLoading(true);
        await deleteUserDoc(user.uid);
        alert("İştirakçı qrupdan silindi.");
        await loadData();
      } catch (err) {
        console.error("Error removing user:", err);
        alert("Silinmə zamanı xəta baş verdi.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAssignJuz = async (uid: string, juzNum: number) => {
    if (!groupStartDate || !groupEndDate) {
      alert("Zəhmət olmasa, əvvəlcə qrup üçün Başlama və Bitmə tarixlərini daxil edin (yuxarı sağ küncdən).");
      return;
    }
    
    const userToAssign = users.find(u => u.uid === uid);
    if (userToAssign && userToAssign.assignedPages && userToAssign.assignedPages.length > 0) {
      if (!window.confirm(`${userToAssign.name} adlı iştirakçının artıq mövcud təyinatı var. Onu silib bu Cüzlə əvəz etmək istəyirsiniz?`)) {
        return;
      }
    }

    try {
      setLoading(true);
      const startPage = (juzNum - 1) * 20 + 1;
      const endPage = juzNum === 30 ? 604 : juzNum * 20;
      const pages: number[] = [];
      for (let p = startPage; p <= endPage; p++) {
        pages.push(p);
      }
      
      await setAssignmentForUser(uid, pages, groupStartDate, groupEndDate, juzNum);
      alert(`Cüz ${juzNum} uğurla ${userToAssign?.name || "iştirakçıya"} təyin edildi.`);
      await loadData();
    } catch (err) {
      console.error("Error assigning juz:", err);
      alert("Cüz təyinatı zamanı xəta baş verdi.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveJuzAssignment = async (user: UserDoc) => {
    if (window.confirm(`${user.name} adlı iştirakçının Cüz ${user.assignedJuz} təyinatını ləğv etmək istəyirsiniz?`)) {
      try {
        setLoading(true);
        await setAssignmentForUser(user.uid, [], "", "", undefined);
        alert("Cüz təyinatı ləğv edildi.");
        await loadData();
      } catch (err) {
        console.error("Error removing juz assignment:", err);
        alert("Təyinatı silərkən xəta baş verdi.");
      } finally {
        setLoading(false);
      }
    }
  };

  // Filter users by name or email (though email is not displayed)
  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const parsePagesString = (input: string): number[] => {
    const result: number[] = [];
    const parts = input.split(",");
    
    for (let part of parts) {
      part = part.trim();
      if (part.includes("-")) {
        const [startStr, endStr] = part.split("-");
        const start = parseInt(startStr.trim(), 10);
        const end = parseInt(endStr.trim(), 10);
        
        if (!isNaN(start) && !isNaN(end) && start <= end) {
          for (let i = start; i <= end; i++) {
            if (i >= 1 && i <= 604) {
              result.push(i);
            }
          }
        }
      } else {
        const page = parseInt(part, 10);
        if (!isNaN(page) && page >= 1 && page <= 604) {
          result.push(page);
        }
      }
    }
    
    return Array.from(new Set(result)).sort((a, b) => a - b);
  };

  const handleSelectUser = (user: UserDoc) => {
    setSelectedUser(user);
    setAssignSuccess(false);
    setAssignError(null);
    setStartDateInput(user.assignmentStartDate || "");
    setEndDateInput(user.assignmentEndDate || "");
    
    if (user.assignedPages && user.assignedPages.length > 0) {
      const sorted = [...user.assignedPages].sort((a, b) => a - b);
      const ranges: string[] = [];
      let start = sorted[0];
      let end = sorted[0];
      
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === end + 1) {
          end = sorted[i];
        } else {
          ranges.push(start === end ? `${start}` : `${start}-${end}`);
          start = sorted[i];
          end = sorted[i];
        }
      }
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      setPagesInput(ranges.join(", "));
    } else {
      setPagesInput("");
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setAssignLoading(true);
    setAssignError(null);
    setAssignSuccess(false);

    try {
      const newPages = parsePagesString(pagesInput);
      
      await setAssignmentForUser(
        selectedUser.uid, 
        newPages, 
        startDateInput, 
        endDateInput
      );
      
      setAssignSuccess(true);
      setSelectedUser(null);
      setPagesInput("");
      setStartDateInput("");
      setEndDateInput("");
      
      await loadData();
    } catch (err) {
      console.error(err);
      setAssignError("Səhifələr təyin edilərkən xəta baş verdi.");
    } finally {
      setAssignLoading(false);
    }
  };

  const handleAutoDistribute = async (e: React.FormEvent) => {
    e.preventDefault();
    setAutoLoading(true);
    setAutoError(null);
    setAutoSuccess(false);

    try {
      await distributeJuzToUsers(autoStartDate, autoEndDate);
      setAutoSuccess(true);
      setShowAutoModal(false);
      setAutoStartDate("");
      setAutoEndDate("");
      
      await loadData();
    } catch (err) {
      console.error(err);
      setAutoError("Avtomatik paylanma zamanı xəta baş verdi.");
    } finally {
      setAutoLoading(false);
    }
  };

  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsLoading(true);
    setSettingsSuccess(false);

    try {
      await setGlobalSettings(settings);
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving global settings:", err);
    } finally {
      setSettingsLoading(false);
    }
  };

  return (
    <AppLayout activeTab="admin">
      <div className="flex flex-col gap-6 max-w-7xl mx-auto px-4 py-6 text-[#0F3D2C]">
        
        {/* Page Title */}
        <div className="flex justify-between items-center">
          <h1 className="text-xl md:text-2xl font-bold font-sans tracking-wide">
            İnzibatçı Paneli
          </h1>
        </div>

        {/* Global Progress overview */}
        <div className="card-premium">
          <h2 className="text-xs font-bold text-[#0F3D2C] mb-3 uppercase tracking-wider">
            Quranın Ümumi Xətm Vəziyyəti
          </h2>
          <ProgressBar completed={totalUniqueCompleted} total={604} label="Tamamlanan Səhifələr (Bütün iştirakçılar)" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card-premium text-center">
            <span className="text-xs text-[#0F3D2C]/60 uppercase font-bold tracking-wider">Tamamlanan Ümumi Xətm</span>
            <div className="text-3xl font-extrabold text-[#0F3D2C] mt-1 font-mono">{settings.completedKhatms || 0}</div>
          </div>
          <div className="card-premium text-center">
            <span className="text-xs text-[#0F3D2C]/60 uppercase font-bold tracking-wider">Cari Xətmin Səhifələri</span>
            <div className="text-3xl font-extrabold text-[#0F3D2C] mt-1 font-mono">{totalUniqueCompleted} / 604</div>
          </div>
          <div className="card-premium text-center">
            <span className="text-xs text-[#0F3D2C]/60 uppercase font-bold tracking-wider">Cari Xətm Faiz</span>
            <div className="text-3xl font-extrabold text-[#D5A85A] mt-1 font-mono">
              {Math.round((totalUniqueCompleted / 604) * 100)}%
            </div>
          </div>
        </div>

        {/* 30 Cüz üzrə Qrup İdarəetməsi */}
        <div className="card-premium flex flex-col gap-4">
          <div className="flex flex-col md:flex-row justify-between md:items-center border-b border-[#0F3D2C]/5 pb-3">
            <div>
              <h3 className="text-base font-bold text-[#0F3D2C] font-sans">
                30 Cüz üzrə Qrup İdarəetməsi (Xətm Qrupu)
              </h3>
              <p className="text-xs text-[#0F3D2C]/65 mt-0.5">
                Quranın 30 cüzünü 30 fərqli iştirakçıya təyin edərək qrup formatında xətm yaradın.
              </p>
            </div>
            
            {/* Global dates for the group assignment */}
            <div className="flex flex-wrap gap-3 mt-3 md:mt-0 items-center">
              <div className="flex items-center gap-1.5 text-xs text-[#0F3D2C] font-semibold">
                <span>Başlama:</span>
                <input
                  type="date"
                  value={groupStartDate}
                  onChange={(e) => setGroupStartDate(e.target.value)}
                  className="px-2 py-1 bg-white border border-[#0F3D2C]/15 focus:border-[#0F3D2C] rounded text-xs font-mono focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#0F3D2C] font-semibold">
                <span>Bitmə:</span>
                <input
                  type="date"
                  value={groupEndDate}
                  onChange={(e) => setGroupEndDate(e.target.value)}
                  className="px-2 py-1 bg-white border border-[#0F3D2C]/15 focus:border-[#0F3D2C] rounded text-xs font-mono focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 30 Juz slots grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[420px] overflow-y-auto pr-1">
            {Array.from({ length: 30 }, (_, i) => {
              const juzNum = i + 1;
              const juzInfo = JUZ_MAP[juzNum];
              const assignedUser = users.find(u => u.assignedJuz === juzNum);
              
              return (
                <div key={juzNum} className="p-3 bg-[#FAF7F2] border border-[#0F3D2C]/5 rounded-xl flex flex-col justify-between gap-3 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                      <span className="text-xs font-extrabold text-[#D5A85A]">Cüz {juzNum}</span>
                      <span className="text-[10px] text-[#0F3D2C]/65 font-bold leading-tight mt-0.5">
                        {juzInfo?.surah || ""}
                      </span>
                    </div>
                    {assignedUser && (
                      <span className="text-[9px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-100">
                        Təyin edilib
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-[#0F3D2C]/5 pt-2">
                    {assignedUser ? (
                      <div className="flex justify-between items-center w-full">
                        <span className="text-xs font-bold text-[#0F3D2C] truncate max-w-[130px]" title={assignedUser.name}>
                          {assignedUser.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveJuzAssignment(assignedUser)}
                          className="px-2 py-1 text-[9px] font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded transition-colors"
                        >
                          Ləğv et
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 w-full">
                        <select
                          id={`juz-select-${juzNum}`}
                          className="flex-1 px-1.5 py-1 bg-white border border-[#0F3D2C]/10 focus:border-[#0F3D2C] rounded text-[11px] text-[#0F3D2C] focus:outline-none"
                          defaultValue=""
                        >
                          <option value="" disabled>İştirakçı...</option>
                          {users.map(u => (
                            <option key={u.uid} value={u.uid}>{u.name}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const selectElement = document.getElementById(`juz-select-${juzNum}`) as HTMLSelectElement;
                            const selectedUid = selectElement?.value;
                            if (selectedUid) {
                              handleAssignJuz(selectedUid, juzNum);
                              selectElement.value = ""; 
                            } else {
                              alert("Zəhmət olmasa, əvvəlcə bir iştirakçı seçin.");
                            }
                          }}
                          className="px-2 py-1 text-[9px] font-bold text-[#0F3D2C] bg-white hover:bg-[#FAF7F2] border border-[#0F3D2C]/20 rounded transition-colors"
                        >
                          Təyin et
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mid grid: User pages assignment & Login settings */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* User page assignment card */}
          <div className="lg:col-span-2 card-premium flex flex-col justify-between gap-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#0F3D2C]/5 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#0F3D2C]">
                  Səhifə Təyin Etmə Paneli
                </h3>
                <p className="text-xs text-[#0F3D2C]/60 mt-0.5">
                  İstifadəçiyə səhifə təyin etmək üçün aşağıdakı cədvəldən &quot;Səhifə Təyin Et&quot; düyməsinə klikləyin.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setShowAutoModal(true)}
                  className="px-4 py-2 bg-[#D5A85A] hover:bg-[#b0913e] text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
                >
                  Cüzləri Avtomatik Payla
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="px-4 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
                >
                  Təmizlə (Sıfırla)
                </button>
              </div>
            </div>

            {autoSuccess && (
              <div className="p-3 bg-green-50/80 border border-green-200 text-green-700 text-xs rounded-lg font-semibold">
                Cüzlər iştirakçılara uğurla və təsadüfi ardıcıllıqla paylanıldı!
              </div>
            )}

            {selectedUser ? (
              <form onSubmit={handleAssignSubmit} className="space-y-4">
                <div className="p-4 bg-[#FAF7F2] border border-[#0F3D2C]/10 rounded-xl">
                  <span className="text-xs text-[#0F3D2C]/65 block mb-1">Seçilən İstifadəçi:</span>
                  <span className="text-sm font-bold text-[#0F3D2C]">{selectedUser.name}</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F3D2C]/80 mb-1.5 uppercase tracking-wide">
                    Səhifə Aralığı və ya Nömrələri
                  </label>
                  <input
                    type="text"
                    required
                    value={pagesInput}
                    onChange={(e) => setPagesInput(e.target.value)}
                    placeholder="Məsələn: 1-20, 35, 40-50"
                    className="w-full px-4 py-2 bg-white border border-[#0F3D2C]/15 focus:border-[#0F3D2C] rounded-lg text-[#0F3D2C] focus:outline-none font-mono text-sm"
                  />
                  <span className="text-[10px] text-[#0F3D2C]/50 mt-1 block">
                    Range-ləri tire (-) ilə ayırın, tək səhifələri isə vergüllə daxil edin (1-604 arası).
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#0F3D2C]/80 mb-1.5 uppercase tracking-wide">
                      Başlama Tarixi
                    </label>
                    <input
                      type="date"
                      required
                      value={startDateInput}
                      onChange={(e) => setStartDateInput(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#0F3D2C]/15 focus:border-[#0F3D2C] rounded-lg text-xs text-[#0F3D2C] focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#0F3D2C]/80 mb-1.5 uppercase tracking-wide">
                      Bitmə Tarixi
                    </label>
                    <input
                      type="date"
                      required
                      value={endDateInput}
                      onChange={(e) => setEndDateInput(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#0F3D2C]/15 focus:border-[#0F3D2C] rounded-lg text-xs text-[#0F3D2C] focus:outline-none font-mono"
                    />
                  </div>
                </div>

                {assignError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg font-semibold">
                    {assignError}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={assignLoading}
                    className="px-5 py-2 bg-[#0F3D2C] hover:bg-[#1C2E24] text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
                  >
                    {assignLoading ? "Yadda saxlanılır..." : "Təyin et"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedUser(null)}
                    className="px-5 py-2 bg-white hover:bg-[#FAF7F2] border border-[#0F3D2C]/20 text-[#0F3D2C] rounded-lg text-xs font-bold transition-all"
                  >
                    Ləğv Et
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-[#0F3D2C]/15 rounded-xl bg-[#FAF7F2]/40">
                <span className="text-3xl mb-2">📋</span>
                <p className="text-xs text-[#0F3D2C]/55 max-w-xs font-semibold">
                  Heç bir iştirakçı seçilməyib. Aşağıdakı cədvəldən bir istifadəçi seçin.
                </p>
              </div>
            )}

            {assignSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 text-green-700 text-xs rounded-lg font-semibold">
                Səhifələr uğurla təyin edildi!
              </div>
            )}
          </div>

          {/* Login Page Config (Ayah/Hadith) */}
          <div className="card-premium flex flex-col justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-[#0F3D2C] border-b border-[#0F3D2C]/5 pb-2">
                Giriş Səhifəsi Ayarları
              </h3>
              <p className="text-xs text-[#0F3D2C]/60 mt-1 mb-4">
                Giriş səhifəsində nümayiş etdirilməsi üçün Quran Ayəsini və ya Hədisi buradan təyin edə bilərsiniz.
              </p>

              <form onSubmit={handleSettingsSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#0F3D2C]/80 mb-1.5 uppercase tracking-wide">
                    Günün Ayəsi
                  </label>
                  <textarea
                    value={settings.currentAyah || ""}
                    onChange={(e) => setSettings({ ...settings, currentAyah: e.target.value })}
                    placeholder="Ayəni daxil edin..."
                    rows={3}
                    className="w-full px-3 py-2 bg-white border border-[#0F3D2C]/15 focus:border-[#0F3D2C] rounded-lg text-xs text-[#0F3D2C] focus:outline-none resize-none font-sans"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F3D2C]/80 mb-1.5 uppercase tracking-wide">
                    Günün Hədisi
                  </label>
                  <textarea
                    value={settings.currentHadith || ""}
                    onChange={(e) => setSettings({ ...settings, currentHadith: e.target.value })}
                    placeholder="Hədisi daxil edin..."
                    rows={3}
                    className="w-full px-3 py-2 bg-white border border-[#0F3D2C]/15 focus:border-[#0F3D2C] rounded-lg text-xs text-[#0F3D2C] focus:outline-none resize-none font-sans"
                  />
                </div>

                {settingsSuccess && (
                  <div className="p-2.5 bg-green-50 border border-green-200 text-green-700 text-xs rounded-lg font-semibold animate-fadeIn">
                    Ayarlar uğurla yadda saxlanıldı!
                  </div>
                )}

                <button
                  type="submit"
                  disabled={settingsLoading}
                  className="w-full px-4 py-2.5 bg-[#0F3D2C] hover:bg-[#1C2E24] text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
                >
                  {settingsLoading ? "Yadda saxlanılır..." : "Məlumatları Yenilə"}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* User list with search */}
        <div className="card-premium overflow-hidden flex flex-col gap-4">
          <div 
            onClick={() => setShowParticipantsList(!showParticipantsList)}
            className="border-b border-[#0F3D2C]/5 pb-3 flex flex-col md:flex-row justify-between items-center gap-4 cursor-pointer select-none"
          >
            <h3 className="text-base font-bold text-[#0F3D2C] flex items-center gap-2">
              <span>Qeydiyyatlı İştirakçılar</span>
              <span className="text-xs bg-[#D5A85A]/15 text-[#D5A85A] px-2.5 py-0.5 rounded-full border border-[#D5A85A]/30 font-mono">
                {users.length} iştirakçı
              </span>
              <span className="text-xs text-[#0F3D2C] ml-1 font-mono">
                {showParticipantsList ? "▲" : "▼"}
              </span>
            </h3>

            {/* Search Input */}
            {showParticipantsList && (
              <div className="w-full md:w-72" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ad ilə axtar..."
                  className="w-full px-3 py-1.5 bg-white border border-[#0F3D2C]/15 focus:border-[#0F3D2C] rounded-lg text-xs text-[#0F3D2C] focus:outline-none"
                />
              </div>
            )}
          </div>

          {showParticipantsList && (
            filteredUsers.length === 0 ? (
              <div className="text-center py-16 text-[#0F3D2C]/50 text-sm">
                Heç bir iştirakçı tapılmadı.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#FAF7F2] border-b border-[#0F3D2C]/10 text-xs text-[#0F3D2C] uppercase font-bold tracking-wider">
                      <th className="px-4 py-3 md:px-6 md:py-4">İştirakçı</th>
                      <th className="px-4 py-3 md:px-6 md:py-4">Təyin edilmiş Səhifələr</th>
                      <th className="px-4 py-3 md:px-6 md:py-4">Tamamlanan</th>
                      <th className="px-4 py-3 md:px-6 md:py-4">Faiz</th>
                      <th className="px-4 py-3 md:px-6 md:py-4">Status</th>
                      <th className="px-4 py-3 md:px-6 md:py-4 text-right">Əməliyyat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <UserRow 
                        key={u.uid} 
                        user={u} 
                        isAdminView={true} 
                        onAssignPagesClick={handleSelectUser} 
                        onRoleToggle={handleRoleToggle}
                        onNotifyClick={handleNotifyClick}
                        onRemoveUserClick={handleRemoveUser}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </div>

      {/* Auto Distribution Modal */}
      {showAutoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="card-premium max-w-md w-full p-6 shadow-2xl relative z-10 flex flex-col gap-4 text-[#0F3D2C]">
            <h3 className="text-base font-bold text-[#0F3D2C] flex items-center gap-2 border-b border-[#0F3D2C]/5 pb-2">
              <span>🕋</span>
              <span>Cüzləri Avtomatik Payla</span>
            </h3>
            <p className="text-xs text-[#0F3D2C]/70 leading-relaxed font-medium">
              Bu əməliyyat bütün aktiv iştirakçılara növbəti xətm üzrə təsadüfi cüzləri (20-şər səhifə, 30-cu cüz üçün 24 səhifə) paylayacaq və oxunma tarixçələrini sıfırlayacaq.
            </p>
            
            <form onSubmit={handleAutoDistribute} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#0F3D2C]/80 mb-1.5 uppercase tracking-wide">
                    Başlama Tarixi
                  </label>
                  <input
                    type="date"
                    required
                    value={autoStartDate}
                    onChange={(e) => setAutoStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#0F3D2C]/15 focus:border-[#0F3D2C] rounded-lg text-xs text-[#0F3D2C] focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#0F3D2C]/80 mb-1.5 uppercase tracking-wide">
                    Bitmə Tarixi
                  </label>
                  <input
                    type="date"
                    required
                    value={autoEndDate}
                    onChange={(e) => setAutoEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#0F3D2C]/15 focus:border-[#0F3D2C] rounded-lg text-xs text-[#0F3D2C] focus:outline-none font-mono"
                  />
                </div>
              </div>

              {autoError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg font-semibold">
                  {autoError}
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAutoModal(false);
                    setAutoError(null);
                  }}
                  className="px-4 py-2 bg-white border border-[#0F3D2C]/20 text-[#0F3D2C] text-xs font-bold rounded-lg transition-all"
                >
                  Ləğv Et
                </button>
                <button
                  type="submit"
                  disabled={autoLoading}
                  className="px-4 py-2 bg-[#0F3D2C] hover:bg-[#1C2E24] text-white text-xs font-bold rounded-lg transition-all shadow-sm active:scale-95"
                >
                  {autoLoading ? "Paylanılır..." : "Paylanmanı Başlat"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
