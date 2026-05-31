"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { 
  getAllUsers, 
  assignPagesToUser, 
  getGlobalSettings, 
  setGlobalSettings, 
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
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);

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
      <div className="flex-1 flex flex-col justify-center items-center bg-[#1a1a2e] text-[#fdf6e3] min-h-screen">
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
      
      // Calculate additions and removals for arrayUnion / arrayRemove compliance
      const currentPages = selectedUser.assignedPages || [];
      const pagesToAdd = newPages.filter((p) => !currentPages.includes(p));
      const pagesToRemove = currentPages.filter((p) => !newPages.includes(p));

      await assignPagesToUser(selectedUser.uid, pagesToAdd, pagesToRemove);
      
      setAssignSuccess(true);
      setSelectedUser(null);
      setPagesInput("");
      
      // Reload users to update metrics in the table
      await loadData();
    } catch (err) {
      console.error(err);
      setAssignError("Səhifələr təyin edilərkən xəta baş verdi.");
    } finally {
      setAssignLoading(false);
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
    <div className="flex-1 flex flex-col min-h-screen bg-[#1a1a2e]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#1a1a2e]/90 backdrop-blur-md border-b border-[#c9a84c]/20 px-4 md:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center relative">
              <div className="absolute w-7 h-7 bg-[#c9a84c] rotate-0 rounded-sm"></div>
              <div className="absolute w-7 h-7 bg-[#c9a84c] rotate-45 rounded-sm"></div>
              <div className="absolute w-2.2 h-2.2 bg-[#1a1a2e] rounded-full z-10"></div>
            </div>
            <h1 className="text-xl md:text-2xl font-amiri font-bold text-[#fdf6e3]">
              İnzibatçı Paneli (Admin)
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="px-4 py-2 bg-[#1a5c38]/10 hover:bg-[#1a5c38]/30 border border-[#1a5c38]/30 text-[#fdf6e3]/90 font-semibold rounded-lg text-xs md:text-sm transition-all"
            >
              Panelimə Keç
            </Link>
            <Link
              href="/progress"
              className="px-4 py-2 bg-[#c9a84c]/10 hover:bg-[#c9a84c] border border-[#c9a84c]/30 text-[#c9a84c] hover:text-[#1a1a2e] font-semibold rounded-lg text-xs md:text-sm transition-all"
            >
              Gedişat Cədvəli
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-8 space-y-8">
        
        {/* Global Progress overview */}
        <div className="bg-[#1a5c38]/10 border border-[#c9a84c]/20 rounded-2xl p-6 shadow-md">
          <h2 className="text-sm font-bold text-[#c9a84c] mb-3 uppercase tracking-wider">
            Quranın Ümumi Xətm Vəziyyəti
          </h2>
          <ProgressBar completed={totalUniqueCompleted} total={604} label="Tamamlanan Səhifələr (Bütün iştirakçılar)" />
        </div>

        {/* Mid grid: User pages assignment & Login settings */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User page assignment card */}
          <div className="lg:col-span-2 bg-[#1a1a2e]/45 border border-[#c9a84c]/15 rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-bold text-[#c9a84c] mb-2 font-amiri">
                Səhifə Təyin Etmə Paneli
              </h3>
              <p className="text-xs text-[#fdf6e3]/60 mb-6">
                İstifadəçiyə səhifə təyin etmək üçün aşağıdakı cədvəldən onun qarşısındakı &quot;Səhifə Təyin Et&quot; düyməsinə klikləyin.
              </p>

              {selectedUser ? (
                <form onSubmit={handleAssignSubmit} className="space-y-4">
                  <div className="p-4 bg-[#1a5c38]/10 border border-[#c9a84c]/20 rounded-lg">
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
                      className="w-full px-4 py-3 bg-[#1a1a2e] border border-[#c9a84c]/30 rounded-lg text-[#fdf6e3] focus:outline-none focus:border-[#c9a84c] font-mono text-sm"
                    />
                    <span className="text-[10px] text-[#fdf6e3]/40 mt-1 block">
                      Range-ləri tire (-) ilə ayırın, tək səhifələri isə vergüllə daxil edin (1-604 arası).
                    </span>
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
                      className="px-5 py-2.5 bg-[#c9a84c] hover:bg-[#b0913e] disabled:opacity-50 text-[#1a1a2e] font-semibold rounded-lg text-sm transition-all"
                    >
                      {assignLoading ? "Yadda saxlanılır..." : "Təyin et"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedUser(null)}
                      className="px-5 py-2.5 bg-gray-500/10 hover:bg-gray-500/20 text-[#fdf6e3]/80 rounded-lg text-sm transition-all"
                    >
                      Ləğv Et
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-[#c9a84c]/20 rounded-xl bg-[#1a1a2e]/20">
                  <span className="text-3xl mb-2">📋</span>
                  <p className="text-xs text-[#fdf6e3]/50 max-w-xs">
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

          {/* Login Page Config (Ayah/Hadith) */}
          <div className="bg-[#1a1a2e]/45 border border-[#c9a84c]/15 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-[#c9a84c] mb-2 font-amiri">
              Giriş Səhifəsi Ayarları
            </h3>
            <p className="text-xs text-[#fdf6e3]/60 mb-6">
              Giriş səhifəsində nümayiş etdirilməsi üçün Quran Ayəsini və ya Hədisi buradan təyin edə bilərsiniz.
            </p>

            <form onSubmit={handleSettingsSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#c9a84c] mb-1 uppercase tracking-wide">
                  Günün Ayəsi (Ərəb və ya Tərcümə)
                </label>
                <textarea
                  value={settings.currentAyah || ""}
                  onChange={(e) => setSettings({ ...settings, currentAyah: e.target.value })}
                  placeholder="Ayəni daxil edin..."
                  rows={3}
                  className="w-full px-3 py-2 bg-[#1a1a2e] border border-[#c9a84c]/20 rounded-lg text-xs text-[#fdf6e3] focus:outline-none focus:border-[#c9a84c] resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#c9a84c] mb-1 uppercase tracking-wide">
                  Günün Hədisi
                </label>
                <textarea
                  value={settings.currentHadith || ""}
                  onChange={(e) => setSettings({ ...settings, currentHadith: e.target.value })}
                  placeholder="Hədisi daxil edin..."
                  rows={3}
                  className="w-full px-3 py-2 bg-[#1a1a2e] border border-[#c9a84c]/20 rounded-lg text-xs text-[#fdf6e3] focus:outline-none focus:border-[#c9a84c] resize-none"
                />
              </div>

              {settingsSuccess && (
                <div className="p-2.5 bg-green-500/10 border border-green-500/25 text-green-400 text-xs rounded">
                  Ayarlar uğurla yadda saxlanıldı!
                </div>
              )}

              <button
                type="submit"
                disabled={settingsLoading}
                className="w-full px-4 py-2.5 bg-[#1a5c38] hover:bg-[#1a5c38]/80 disabled:opacity-50 text-[#fdf6e3] border border-[#c9a84c]/30 font-semibold rounded-lg text-xs transition-all"
              >
                {settingsLoading ? "Yadda saxlanılır..." : "Məlumatları Yenilə"}
              </button>
            </form>
          </div>
        </div>

        {/* User list with search */}
        <div className="bg-[#1a1a2e]/45 border border-[#c9a84c]/15 rounded-2xl shadow-lg overflow-hidden">
          <div className="p-5 border-b border-[#c9a84c]/15 bg-[#1a5c38]/5 flex flex-col md:flex-row justify-between items-center gap-4">
            <h3 className="text-lg font-bold text-[#fdf6e3] flex items-center gap-2">
              <span>Qeydiyyatlı İştirakçılar</span>
              <span className="text-xs bg-[#c9a84c]/25 text-[#c9a84c] px-2.5 py-0.5 rounded-full border border-[#c9a84c]/30 font-mono">
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
                className="w-full px-3 py-2 bg-[#1a1a2e] border border-[#c9a84c]/20 rounded-lg text-xs text-[#fdf6e3] focus:outline-none focus:border-[#c9a84c]"
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
                  <tr className="bg-[#1a1a2e]/60 border-b border-[#c9a84c]/15 text-xs text-[#c9a84c] uppercase font-bold tracking-wider">
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
                    />
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
