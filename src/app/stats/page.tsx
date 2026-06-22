"use client";

import { useAuth } from "@/lib/auth";
import { getAllUsers, type UserDoc, getUserGroupIds, getUserAssignment, getGroupDoc, isUserApprovedInGroup } from "@/lib/db";
import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import ProgressBar from "@/components/ProgressBar";

export default function StatsPage() {
  const { user, loading, activeGroupId } = useAuth();
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    async function loadData() {
      try {
        let createdBy: string | null = null;
        if (activeGroupId !== "default") {
          const groupDoc = await getGroupDoc(activeGroupId);
          if (groupDoc) {
            createdBy = groupDoc.createdBy || null;
          }
        }

        const usersList = await getAllUsers();
        const filtered = usersList.filter((u) => 
          (getUserGroupIds(u).includes(activeGroupId) || (createdBy && u.uid === createdBy))
          && isUserApprovedInGroup(u, activeGroupId)
        );
        setUsers(filtered);
      } catch (err) {
        console.error("Error loading stats data:", err);
      } finally {
        setDataLoading(false);
      }
    }
    loadData();
  }, [user, activeGroupId]);

  if (loading || dataLoading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-[#FAF7F2] text-[#0F3D2C] min-h-screen">
        <div className="animate-spin h-10 w-10 text-[#0F3D2C] mb-4">
          <svg className="w-full h-full" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
        <p className="text-sm font-semibold tracking-wide text-[#0F3D2C]/80">Məlumatlar yüklənir...</p>
      </div>
    );
  }

  // Calculate unique completed pages (out of 604)
  const allCompletedPages = users.flatMap((u) => getUserAssignment(u, activeGroupId).completedPages || []);
  const uniqueCompleted = Array.from(new Set(allCompletedPages)).length;

  // Calculate how many users are assigned to each Juz (1-30) and their completion status
  const juzStatus = Array.from({ length: 30 }, (_, idx) => {
    const juzNum = idx + 1;
    const juzUsers = users.filter((u) => {
      const assignment = getUserAssignment(u, activeGroupId);
      return (assignment.assignedJuzs && assignment.assignedJuzs.includes(juzNum)) || assignment.assignedJuz === juzNum;
    });
    const isAssigned = juzUsers.length > 0;
    const isCompleted = isAssigned && juzUsers.every((u) => {
      const assignment = getUserAssignment(u, activeGroupId);
      const startPage = (juzNum - 1) * 20 + 1;
      const endPage = juzNum === 30 ? 604 : juzNum * 20;
      for (let p = startPage; p <= endPage; p++) {
        if (!(assignment.completedPages || []).includes(p)) return false;
      }
      return true;
    });
    return { juzNum, isAssigned, isCompleted, usersCount: juzUsers.length };
  });

  return (
    <AppLayout activeTab="stats">
      <div className="space-y-6 max-w-5xl mx-auto">
        
        {/* Title Header */}
        <div className="flex flex-col border-b border-[#0F3D2C]/5 pb-4">
          <h1 className="text-3xl font-bold tracking-tight text-[#0F3D2C]">
            Xətm Statistikaları
          </h1>
          <p className="text-xs font-semibold text-[#0F3D2C]/60 mt-1 uppercase tracking-wider">
            Qrupumuzun ümumi xətm gedişatına aid statistik göstəricilər və cüzlərin tamamlanma vəziyyətini buradan izləyə bilərsiniz.
          </p>
        </div>

        {/* Global Progress Card */}
        <ProgressBar 
          completed={uniqueCompleted} 
          total={604} 
          label="Qrup Xətm Tamamlanması" 
        />

        {/* Juz Progress Grid (Visualizing all 30 Juz) */}
        <div className="card-premium flex flex-col gap-4">
          <h3 className="text-sm font-bold text-[#0F3D2C] uppercase tracking-wider border-b border-[#0F3D2C]/5 pb-3">
            30 Cüz Üzrə Tamamlanma Vəziyyəti
          </h3>
          
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-10 gap-3 pt-2">
            {juzStatus.map((j) => (
              <div 
                key={j.juzNum} 
                className={`p-3 rounded-2xl border text-center flex flex-col justify-between items-center transition-all ${
                  j.isCompleted 
                    ? "bg-[#E8F4EC] border-[#0F3D2C] text-[#0F3D2C]" 
                    : j.isAssigned
                      ? "bg-[#EFE9DF] border-[#0F3D2C]/30 text-[#0F3D2C]"
                      : "bg-[#FFFFFF] border-[#0F3D2C]/10 text-[#0F3D2C]/30"
                }`}
              >
                <span className="text-[10px] font-bold uppercase block">Cüz</span>
                <span className="text-lg font-extrabold font-mono my-0.5">{j.juzNum}</span>
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

          <div className="flex flex-wrap gap-4 items-center text-[10px] font-bold text-[#0F3D2C]/70 pt-2 border-t border-[#0F3D2C]/5">
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 bg-[#E8F4EC] border border-[#0F3D2C] rounded" />
              <span>Tamamlanmış Cüz</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 bg-[#EFE9DF] border border-[#0F3D2C]/30 rounded" />
              <span>Oxunmaqda Olan Cüz</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 bg-[#FFFFFF] border border-[#0F3D2C]/10 rounded" />
              <span>Təyin edilməmiş Cüz</span>
            </div>
          </div>

        </div>

      </div>
    </AppLayout>
  );
}
