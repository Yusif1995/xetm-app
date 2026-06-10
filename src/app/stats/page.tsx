"use client";

import { useAuth } from "@/lib/auth";
import { getAllUsers, getGlobalSettings, type UserDoc, type AppSettings } from "@/lib/db";
import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import ProgressBar from "@/components/ProgressBar";

export default function StatsPage() {
  const { loading } = useAuth();
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ completedKhatms: 0 });
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [usersList, appSettings] = await Promise.all([
          getAllUsers(),
          getGlobalSettings()
        ]);
        setUsers(usersList);
        setSettings(appSettings);
      } catch (err) {
        console.error("Error loading stats data:", err);
      } finally {
        setDataLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading || dataLoading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center islamic-bg text-[#fdf6e3] min-h-screen">
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

  // Calculate unique completed pages (out of 604)
  const allCompletedPages = users.flatMap((u) => u.completedPages || []);
  const uniqueCompleted = Array.from(new Set(allCompletedPages)).length;

  // Calculate how many users are assigned to each Juz (1-30) and their completion status
  const juzStatus = Array.from({ length: 30 }, (_, idx) => {
    const juzNum = idx + 1;
    const juzUsers = users.filter((u) => u.assignedJuz === juzNum);
    const isAssigned = juzUsers.length > 0;
    const isCompleted = isAssigned && juzUsers.every((u) => (u.completedPages || []).length === (u.assignedPages || []).length);
    return { juzNum, isAssigned, isCompleted, usersCount: juzUsers.length };
  });

  return (
    <AppLayout activeTab="stats">
      <div className="space-y-6">
        {/* Main Stats Header */}
        <div className="p-6 islamic-card relative overflow-hidden">
          <div className="islamic-card-inner" />
          <div className="islamic-pattern" />
          <div className="relative z-10">
            <h2 className="text-2xl font-amiri font-bold text-[#c9a84c] mb-1">
              Xətm Statistikaları
            </h2>
            <p className="text-xs text-[#fdf6e3]/75 max-w-xl">
              Qrupumuzun ümumi xətm gedişatına aid statistik göstəricilər və cüzlərin tamamlanma vəziyyətini buradan izləyə bilərsiniz.
            </p>
          </div>
        </div>

        {/* Global Progress Card */}
        <div className="islamic-card p-6 shadow-xl relative overflow-hidden">
          <div className="islamic-card-inner" />
          <div className="islamic-pattern" />
          <div className="relative z-10 w-full space-y-4">
            <h3 className="text-xs font-bold text-[#c9a84c] uppercase tracking-wider">
              Ümumi Xətm Gedişatı
            </h3>
            <ProgressBar 
              completed={uniqueCompleted} 
              total={604} 
              label="Qrup Xətm Tamamlanması" 
            />
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              <span className="text-xs text-[#c9a84c] uppercase font-bold tracking-wider">Oxunan Cari Səhifə</span>
              <div className="text-3xl font-extrabold text-[#fdf6e3] mt-1 font-mono">{uniqueCompleted} / 604</div>
            </div>
          </div>
          <div className="islamic-card p-6 text-center shadow-md">
            <div className="islamic-card-inner" />
            <div className="islamic-pattern" />
            <div className="relative z-10">
              <span className="text-xs text-[#c9a84c] uppercase font-bold tracking-wider">Aktiv İştirakçılar</span>
              <div className="text-3xl font-extrabold text-[#c9a84c] mt-1 font-mono">
                {users.filter(u => (u.assignedPages || []).length > 0).length} / {users.length}
              </div>
            </div>
          </div>
        </div>

        {/* Juz Progress Grid (Visualizing all 30 Juz) */}
        <div className="islamic-card p-6 shadow-lg relative overflow-hidden">
          <div className="islamic-card-inner" />
          <div className="islamic-pattern" />
          <div className="relative z-10 w-full space-y-4">
            <h3 className="text-sm font-bold text-[#fdf6e3] uppercase tracking-wider border-b border-[#c9a84c]/20 pb-3">
              30 Cüz Üzrə Tamamlanma Vəziyyəti
            </h3>
            
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-10 gap-3 pt-2">
              {juzStatus.map((j) => (
                <div 
                  key={j.juzNum} 
                  className={`p-3 rounded-xl border text-center flex flex-col justify-between items-center transition-all ${
                    j.isCompleted 
                      ? "bg-[#c9a84c]/15 border-[#c9a84c] text-[#c9a84c]" 
                      : j.isAssigned
                        ? "bg-[#1a5c38]/20 border-[#1a5c38] text-[#fdf6e3]/95"
                        : "bg-[#030e07]/45 border-[#c9a84c]/10 text-[#fdf6e3]/30"
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase block">Cüz</span>
                  <span className="text-lg font-black font-mono my-0.5">{j.juzNum}</span>
                  <span className="text-[8px] font-bold uppercase tracking-wider block">
                    {j.isCompleted 
                      ? "Bitib" 
                      : j.isAssigned
                        ? "Oxunur"
                        : "Boşdur"
                    }
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-4 items-center text-[10px] font-semibold text-[#fdf6e3]/70 pt-2 border-t border-[#c9a84c]/10">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-[#c9a84c]/15 border border-[#c9a84c] rounded-sm" />
                <span>Tamamlanmış Cüz</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-[#1a5c38]/20 border border-[#1a5c38] rounded-sm" />
                <span>Oxunmaqda Olan Cüz</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-[#030e07]/45 border border-[#c9a84c]/10 rounded-sm" />
                <span>Təyin edilməmiş Cüz</span>
              </div>
            </div>

          </div>
        </div>

      </div>
    </AppLayout>
  );
}
