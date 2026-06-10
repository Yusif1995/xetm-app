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
  type UserDoc, 
  type AppSettings 
} from "@/lib/db";
import ProgressBar from "@/components/ProgressBar";
import UserRow from "@/components/UserRow";
import Link from "next/link";

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
    loadData();
  }, []);

  if (authLoading || loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center islamic-bg text-[#fdf6e3] min-h-screen">
        <div className="animate-spin h-10 w-10 text-[#c9a84c] mb-4">
          <svg className="w-full h-full" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
        <p className="text-sm font-semibold tracking-wide text-[#fdf6e3]/85">İnzibatçı paneli yüklənir...</p>
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

  // Filter users by name or email
  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Helper to parse page string, e.g. "1-20, 30, 45-50" -> Array of page numbers
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
    
    // Convert current assigned pages to range string for easier editing
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
      
      // Reload users to update metrics in the table
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
      
      // Reload users to update metrics in the table
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
    <div className="flex-1 flex flex-col min-h-screen islamic-bg">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0b301a]/95 backdrop-blur-md border-b border-[#c9a84c]/20 px-4 md:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center relative">
              <div className="absolute w-7 h-7 bg-[#c9a84c] rotate-0 rounded-sm"></div>
              <div className="absolute w-7 h-7 bg-[#c9a84c] rotate-45 rounded-sm"></div>
              <div className="absolute w-2.2 h-2.2 bg-[#0b301a] rounded-full z-10"></div>
            </div>
            <h1 className="text-xl md:text-2xl font-amiri font-bold text-[#fdf6e3]">
              İnzibatçı Paneli (Admin)
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="px-4 py-2 bg-[#1a5c38]/20 hover:bg-[#1a5c38]/40 border border-[#1a5c38]/40 text-[#fdf6e3]/90 font-semibold rounded-lg text-xs md:text-sm transition-all"
            >
              Panelimə Keç
            </Link>
            <Link
              href="/progress"
              className="px-4 py-2 bg-[#c9a84c]/15 hover:bg-[#c9a84c] border border-[#c9a84c]/30 text-[#c9a84c] hover:text-[#0b301a] font-semibold rounded-lg text-xs md:text-sm transition-all"
            >
              Gedişat Cədvəli
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-8 space-y-8">
        
        {/* Global Progress overview */}
        <div className="islamic-card p-6 shadow-md">
          <div className="islamic-card-inner" />
          <div className="islamic-pattern" />
          <div className="relative z-10">
            <h2 className="text-sm font-bold text-[#c9a84c] mb-3 uppercase tracking-wider">
              Quranın Ümumi Xətm Vəziyyəti
            </h2>
            <ProgressBar completed={totalUniqueCompleted} total={604} label="Tamamlanan Səhifələr (Bütün iştirakçılar)" />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="islamic-card p-6 text-center shadow-md">
            <div className="islamic-card-inner" />
            <div className="islamic-pattern" />
            <div className="relative z-10">
              <span className="text-xs text-[#c9a84c] uppercase font-bold tracking-wider">Tamamlanan Ümumi Xətm</span>
              <div className="text-3xl font-extrabold text-[#fdf6e3] mt-1 font-mono">{settings.completedKhatms || 0}</div>
            </div>
          </div>
          <div className="islamic-card p-6 text-center shadow-md">
            <div className="islamic-card-inner" />
            <div className="islamic-pattern" />
            <div className="relative z-10">
              <span className="text-xs text-[#c9a84c] uppercase font-bold tracking-wider">Cari Xətmin Səhifələri</span>
              <div className="text-3xl font-extrabold text-[#fdf6e3] mt-1 font-mono">{totalUniqueCompleted} / 604</div>
            </div>
          </div>
          <div className="islamic-card p-6 text-center shadow-md">
            <div className="islamic-card-inner" />
            <div className="islamic-pattern" />
            <div className="relative z-10">
              <span className="text-xs text-[#c9a84c] uppercase font-bold tracking-wider">Cari Xətm Faiz</span>
              <div className="text-3xl font-extrabold text-[#c9a84c] mt-1 font-mono">
                {Math.round((totalUniqueCompleted / 604) * 100)}%
              </div>
            </div>
          </div>
        </div>

        {/* Mid grid: User pages assignment & Login settings */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User page assignment card */}
          <div className="lg:col-span-2 islamic-card p-6 flex flex-col justify-between">
            <div className="islamic-card-inner" />
            <div className="islamic-pattern" />
            <div className="relative z-10 flex flex-col justify-between h-full w-full">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-[#c9a84c] font-amiri">
                      Səhifə Təyin Etmə Paneli
                    </h3>
                    <p className="text-xs text-[#fdf6e3]/60 font-sans">
                      İstifadəçiyə səhifə təyin etmək üçün aşağıdakı cədvəldən &quot;Səhifə Təyin Et&quot; düyməsinə klikləyin.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAutoModal(true)}
                    className="px-4 py-2 islamic-btn-gold rounded-lg text-xs transition-all whitespace-nowrap self-start sm:self-auto shadow-md"
                  >
                    Cüzləri Avtomatik Payla
                  </button>
                </div>

                {autoSuccess && (
                  <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 text-green-400 text-xs rounded">
                    Cüzlər iştirakçılara uğurla və təsadüfi ardıcıllıqla paylanıldı!
                  </div>
                )}

                {selectedUser ? (
                  <form onSubmit={handleAssignSubmit} className="space-y-4">
                    <div className="p-4 bg-[#05180d]/80 border border-[#c9a84c]/30 rounded-lg">
                      <span className="text-xs text-[#c9a84c] block mb-1">Seçilən İstifadəçi:</span>
                      <span className="text-sm font-bold text-[#fdf6e3]">{selectedUser.name}</span>
                      <span className="text-xs text-[#fdf6e3]/50 block">({selectedUser.email})</span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#c9a84c] mb-1.5 uppercase tracking-wide">
                        Səhifə Aralığı və ya Nömrələri
                      </label>
                      <input
                        type="text"
                        required
                        value={pagesInput}
                        onChange={(e) => setPagesInput(e.target.value)}
                        placeholder="Məsələn: 1-20, 35, 40-50"
                        className="w-full px-4 py-3 bg-[#05180d]/80 border border-[#c9a84c]/30 focus:border-[#c9a84c] rounded-lg text-[#fdf6e3] focus:outline-none font-mono text-sm"
                      />
                      <span className="text-[10px] text-[#fdf6e3]/40 mt-1 block">
                        Range-ləri tire (-) ilə ayırın, tək səhifələri isə vergüllə daxil edin (1-604 arası).
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#c9a84c] mb-1.5 uppercase tracking-wide">
                          Başlama Tarixi
                        </label>
                        <input
                          type="date"
                          required
                          value={startDateInput}
                          onChange={(e) => setStartDateInput(e.target.value)}
                          className="w-full px-3 py-2 bg-[#05180d]/80 border border-[#c9a84c]/20 focus:border-[#c9a84c] rounded-lg text-xs text-[#fdf6e3] focus:outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#c9a84c] mb-1.5 uppercase tracking-wide">
                          Bitmə Tarixi
                        </label>
                        <input
                          type="date"
                          required
                          value={endDateInput}
                          onChange={(e) => setEndDateInput(e.target.value)}
                          className="w-full px-3 py-2 bg-[#05180d]/80 border border-[#c9a84c]/20 focus:border-[#c9a84c] rounded-lg text-xs text-[#fdf6e3] focus:outline-none font-mono"
                        />
                      </div>
                    </div>

                    {assignError && (
                      <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded">
                        {assignError}
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <button
                        type="submit"
                        disabled={assignLoading}
                        className="px-5 py-2.5 islamic-btn-gold rounded-lg text-sm transition-all"
                      >
                        {assignLoading ? "Yadda saxlanılır..." : "Təyin et"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedUser(null)}
                        className="px-5 py-2.5 bg-red-950/20 hover:bg-red-900/40 border border-red-500/30 text-red-400 hover:text-red-300 rounded-lg text-sm transition-all"
                      >
                        Ləğv Et
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-[#c9a84c]/20 rounded-xl bg-[#05180d]/30">
                    <span className="text-3xl mb-2">📋</span>
                    <p className="text-xs text-[#fdf6e3]/50 max-w-xs font-medium">
                      Heç bir iştirakçı seçilməyib. Aşağıdakı cədvəldən bir istifadəçi seçin.
                    </p>
                  </div>
                )}
              </div>
              
              {assignSuccess && (
                <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 text-green-400 text-xs rounded">
                  Səhifələr uğurla təyin edildi!
                </div>
              )}
            </div>
          </div>

          {/* Login Page Config (Ayah/Hadith) */}
          <div className="islamic-card p-6 flex flex-col justify-between">
            <div className="islamic-card-inner" />
            <div className="islamic-pattern" />
            <div className="relative z-10 flex flex-col justify-between h-full w-full">
              <div>
                <h3 className="text-lg font-bold text-[#c9a84c] mb-2 font-amiri">
                  Giriş Səhifəsi Ayarları
                </h3>
                <p className="text-xs text-[#fdf6e3]/60 mb-6">
                  Giriş səhifəsində nümayiş etdirilməsi üçün Quran Ayəsini və ya Hədisi buradan təyin edə bilərsiniz.
                </p>

                <form onSubmit={handleSettingsSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#c9a84c] mb-1.5 uppercase tracking-wide">
                      Günün Ayəsi (Ərəb və ya Tərcümə)
                    </label>
                    <textarea
                      value={settings.currentAyah || ""}
                      onChange={(e) => setSettings({ ...settings, currentAyah: e.target.value })}
                      placeholder="Ayəni daxil edin..."
                      rows={3}
                      className="w-full px-3 py-2 bg-[#05180d]/80 border border-[#c9a84c]/20 focus:border-[#c9a84c] rounded-lg text-xs text-[#fdf6e3] focus:outline-none resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#c9a84c] mb-1.5 uppercase tracking-wide">
                      Günün Hədisi
                    </label>
                    <textarea
                      value={settings.currentHadith || ""}
                      onChange={(e) => setSettings({ ...settings, currentHadith: e.target.value })}
                      placeholder="Hədisi daxil edin..."
                      rows={3}
                      className="w-full px-3 py-2 bg-[#05180d]/80 border border-[#c9a84c]/20 focus:border-[#c9a84c] rounded-lg text-xs text-[#fdf6e3] focus:outline-none resize-none"
                    />
                  </div>

                  {settingsSuccess && (
                    <div className="p-2.5 bg-green-500/10 border border-green-500/25 text-green-400 text-xs rounded animate-fadeIn">
                      Ayarlar uğurla yadda saxlanıldı!
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={settingsLoading}
                    className="w-full px-4 py-2.5 islamic-btn-gold rounded-lg text-xs transition-all"
                  >
                    {settingsLoading ? "Yadda saxlanılır..." : "Məlumatları Yenilə"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* User list with search */}
        <div className="islamic-card shadow-lg overflow-hidden">
          <div className="islamic-card-inner" />
          <div className="islamic-pattern" />
          <div className="relative z-10 w-full">
            <div className="p-5 border-b border-[#c9a84c]/15 bg-[#0b301a]/60 flex flex-col md:flex-row justify-between items-center gap-4">
              <h3 className="text-lg font-bold text-[#fdf6e3] flex items-center gap-2">
                <span>Qeydiyyatlı İştirakçılar</span>
                <span className="text-xs bg-[#c9a84c]/20 text-[#c9a84c] px-2.5 py-0.5 rounded-full border border-[#c9a84c]/30 font-mono">
                  {filteredUsers.length} / {users.length} iştirakçı
                </span>
              </h3>

              {/* Search Input */}
              <div className="w-full md:w-72">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ad və ya e-poçt ilə axtar..."
                  className="w-full px-3 py-2 bg-[#05180d]/80 border border-[#c9a84c]/20 focus:border-[#c9a84c] rounded-lg text-xs text-[#fdf6e3] focus:outline-none"
                />
              </div>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="text-center py-16 text-[#fdf6e3]/50 text-sm">
                Heç bir iştirakçı tapılmadı.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#05180d]/85 border-b border-[#c9a84c]/15 text-xs text-[#c9a84c] uppercase font-bold tracking-wider">
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
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </main>

      {/* Auto Distribution Modal */}
      {showAutoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#05180d]/80 backdrop-blur-sm p-4">
          <div className="islamic-card max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="islamic-card-inner" />
            <div className="islamic-pattern" />
            <div className="relative z-10 w-full space-y-4">
              <h3 className="text-lg font-bold text-[#c9a84c] font-amiri flex items-center gap-2">
                <span>🕋</span>
                <span>Cüzləri Avtomatik Payla</span>
              </h3>
              <p className="text-xs text-[#fdf6e3]/70 leading-relaxed font-sans">
                Bu əməliyyat bütün aktiv iştirakçılara növbəti xətm üzrə təsadüfi cüzləri (20-şər səhifə, 30-cu cüz üçün 24 səhifə) paylayacaq və oxunma tarixçələrini sıfırlayacaq.
              </p>
              
              <form onSubmit={handleAutoDistribute} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#c9a84c] mb-1.5 uppercase tracking-wide">
                      Başlama Tarixi
                    </label>
                    <input
                      type="date"
                      required
                      value={autoStartDate}
                      onChange={(e) => setAutoStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-[#05180d]/80 border border-[#c9a84c]/20 focus:border-[#c9a84c] rounded-lg text-xs text-[#fdf6e3] focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#c9a84c] mb-1.5 uppercase tracking-wide">
                      Bitmə Tarixi
                    </label>
                    <input
                      type="date"
                      required
                      value={autoEndDate}
                      onChange={(e) => setAutoEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-[#05180d]/80 border border-[#c9a84c]/20 focus:border-[#c9a84c] rounded-lg text-xs text-[#fdf6e3] focus:outline-none font-mono"
                    />
                  </div>
                </div>

                {autoError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded">
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
                    className="px-4 py-2 bg-[#05180d]/60 hover:bg-[#05180d] border border-[#c9a84c]/30 text-[#fdf6e3]/85 text-xs font-semibold rounded-lg transition-all"
                  >
                    Ləğv Et
                  </button>
                  <button
                    type="submit"
                    disabled={autoLoading}
                    className="px-4 py-2 islamic-btn-gold rounded-lg text-xs transition-all shadow-md"
                  >
                    {autoLoading ? "Paylanılır..." : "Paylanmanı Başlat"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
