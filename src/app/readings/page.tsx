"use client";

import { useAuth } from "@/lib/auth";
import PageCard from "@/components/PageCard";
import { togglePreviousCompletedPages, toggleCompletedPages, getUserAssignment } from "@/lib/db";
import { useEffect, useState, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import Link from "next/link";

export default function ReadingsPage() {
  const { user, loading, refreshUser, activeGroupId } = useAuth();
  const [completedPagesState, setCompletedPagesState] = useState<number[]>([]);
  const [prevCompletedPagesState, setPrevCompletedPagesState] = useState<number[]>([]);

  const activeAssignment = useMemo(
    () => user ? getUserAssignment(user, activeGroupId) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.uid, activeGroupId, JSON.stringify(user?.groupData?.[activeGroupId])]
  );

  const completedPagesKey = JSON.stringify(activeAssignment?.completedPages || []);
  const prevCompletedPagesKey = JSON.stringify(activeAssignment?.previousCompletedPages || []);
  useEffect(() => {
    setCompletedPagesState(activeAssignment?.completedPages || []);
    setPrevCompletedPagesState(activeAssignment?.previousCompletedPages || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedPagesKey, prevCompletedPagesKey]);

  if (loading) {
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

  if (!user) {
    return null; // Guarded by middleware
  }

  const assignedPages = activeAssignment?.assignedPages || [];
  const prevAssignedPages = activeAssignment?.previousAssignedPages || [];

  // Group pages into chunks of 5
  const sortPages = (arr: number[]) => [...arr].sort((a, b) => a - b);
  
  const getChunks = (pagesList: number[]) => {
    const sorted = sortPages(pagesList);
    const chunksList: number[][] = [];
    for (let i = 0; i < sorted.length; i += 5) {
      chunksList.push(sorted.slice(i, i + 5));
    }
    return chunksList;
  };

  const currentChunks = getChunks(assignedPages);
  const prevChunks = getChunks(prevAssignedPages);

  // Check if previous assignment is uncompleted
  const hasUncompletedPrev = prevAssignedPages.length > 0 && 
    !prevAssignedPages.every(p => prevCompletedPagesState.includes(p));

  const handleCurrentStatusChange = (pageNumbers: number[], isCompleted: boolean) => {
    if (isCompleted) {
      setCompletedPagesState(prev => {
        const next = [...prev];
        pageNumbers.forEach(p => {
          if (!next.includes(p)) next.push(p);
        });
        return next;
      });
    } else {
      setCompletedPagesState(prev => prev.filter(p => !pageNumbers.includes(p)));
    }
    refreshUser();
  };

  const handlePrevStatusChange = (pageNumbers: number[], isCompleted: boolean) => {
    if (isCompleted) {
      setPrevCompletedPagesState(prev => {
        const next = [...prev];
        pageNumbers.forEach(p => {
          if (!next.includes(p)) next.push(p);
        });
        return next;
      });
    } else {
      setPrevCompletedPagesState(prev => prev.filter(p => !pageNumbers.includes(p)));
    }
    refreshUser();
  };

  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return dateStr;
  };

  return (
    <AppLayout activeTab="readings">
      <div className="space-y-6 max-w-5xl mx-auto">
        
        {/* Title Header */}
        <div className="flex flex-col border-b border-[#0F3D2C]/5 pb-4">
          <h1 className="text-3xl font-bold tracking-tight text-[#0F3D2C]">
            Xətm Səhifələrim
          </h1>
          <p className="text-xs font-semibold text-[#0F3D2C]/60 mt-1 uppercase tracking-wider">
            Sizə təyin edilmiş səhifələri buradan izləyə və oxundu olaraq işarələyə bilərsiniz.
          </p>
        </div>

        {/* Hadith Header Banner */}
        <div className="card-premium flex flex-col items-center text-center gap-2 relative bg-[#EFE9DF] border border-[#0F3D2C]/10 text-[#0F3D2C] p-6 shadow-sm">
          <span className="text-[10px] font-bold text-[#D5A85A] uppercase tracking-widest block">Günün Hədisi — İstikrar və Davamlılıq</span>
          <p className="font-serif text-sm md:text-base italic leading-relaxed max-w-xl">
            &quot;Allah qatında əməllərin ən sevimlisi az da olsa davamlı olanıdır.&quot;
          </p>
          <span className="text-[10px] text-[#0F3D2C]/50 block font-semibold">— Buxari</span>
        </div>

        {/* Assigned Pages List */}
        {assignedPages.length === 0 && prevAssignedPages.length === 0 ? (
          <div className="card-premium text-center py-16 px-6 max-w-2xl mx-auto flex flex-col items-center bg-white">
            <span className="text-5xl mb-4">🕋</span>
            <h3 className="text-lg font-semibold text-[#0F3D2C] mb-2">Səhifə təyin edilməyib</h3>
            <p className="text-sm text-[#0F3D2C]/60 leading-relaxed mb-6 max-w-md">
              Hörmətli iştirakçı, hazırda sizə oxumaq üçün heç bir səhifə təyin edilməyib.
            </p>
            <Link
              href="/dashboard"
              className="px-4 py-2 bg-[#0F3D2C] hover:bg-[#1C2E24] text-white font-semibold rounded-xl transition-colors text-xs uppercase tracking-wider"
            >
              Panelə Qayıt
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Section 1: Previous Assignment (if exists and has uncompleted pages) */}
            {prevAssignedPages.length > 0 && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 border-b border-[#0F3D2C]/10 pb-3">
                  <h3 className="text-sm font-bold text-red-600 uppercase tracking-wider flex items-center gap-2">
                    <span>⚠️ Əvvəlki Oxu Tapşırığı</span>
                    <span className="text-xs bg-red-500/10 text-red-600 px-2 py-0.5 rounded-full border border-red-500/20 font-mono">
                      {prevAssignedPages.length} səhifə
                    </span>
                  </h3>
                  {activeAssignment?.previousStartDate && activeAssignment?.previousEndDate && (
                    <span className="text-[10px] md:text-xs font-bold text-red-600 bg-red-50 px-3 py-1 rounded-lg border border-red-500/20 font-mono">
                      Müddət: {formatDateDisplay(activeAssignment.previousStartDate)} — {formatDateDisplay(activeAssignment.previousEndDate)}
                    </span>
                  )}
                </div>

                {hasUncompletedPrev && (
                  <div className="p-3 bg-red-50 border border-red-500/20 text-red-600 text-[11px] rounded-xl text-center font-bold">
                    Diqqət! Yeni tapşırığı işarələmək üçün əvvəlcə bu bölmədəki bütün səhifələri oxuyub bitirməlisiniz.
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {prevChunks.map((chunk) => (
                    <PageCard
                      key={`prev-${chunk.join(",")}`}
                      userId={user.uid}
                      pageNumbers={chunk}
                      initialCompleted={chunk.every((page) => prevCompletedPagesState.includes(page))}
                      onStatusChange={handlePrevStatusChange}
                      toggleFn={(uid, pages, isCompleted) => togglePreviousCompletedPages(uid, pages, isCompleted, activeGroupId)}
                      disabled={false}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Section 2: Current/New Assignment */}
            {assignedPages.length > 0 && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 border-b border-[#0F3D2C]/10 pb-3">
                  <h3 className="text-sm font-bold text-[#0F3D2C] uppercase tracking-wider flex items-center gap-2.5">
                    <span>📖 {prevAssignedPages.length > 0 ? "Yeni Oxu Tapşırığı" : "Təyin Olunmuş Səhifələrim"}</span>
                    <span className="text-xs bg-[#0F3D2C]/5 text-[#0F3D2C] px-2.5 py-0.5 rounded-full border border-[#0F3D2C]/10 font-mono">
                      {assignedPages.length} səhifə
                    </span>
                  </h3>
                  {activeAssignment?.assignmentStartDate && activeAssignment?.assignmentEndDate && (
                    <span className="text-[10px] md:text-xs font-bold text-[#0F3D2C]/80 bg-[#FAF7F2] px-3 py-1 rounded-lg border border-[#0F3D2C]/10 font-mono">
                      Müddət: {formatDateDisplay(activeAssignment.assignmentStartDate)} — {formatDateDisplay(activeAssignment.assignmentEndDate)}
                    </span>
                  )}
                </div>

                {hasUncompletedPrev && (
                  <div className="p-3 bg-yellow-50 border border-yellow-500/20 text-yellow-600 text-[11px] rounded-xl text-center font-bold">
                    🔒 Yeni səhifələr kilidlidir. Əvvəlki tapşırığı tamamlayan kimi kilid avtomatik açılacaqdır.
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {currentChunks.map((chunk) => (
                    <PageCard
                      key={`curr-${chunk.join(",")}`}
                      userId={user.uid}
                      pageNumbers={chunk}
                      initialCompleted={chunk.every((page) => completedPagesState.includes(page))}
                      onStatusChange={handleCurrentStatusChange}
                      toggleFn={(uid, pages, isCompleted) => toggleCompletedPages(uid, pages, isCompleted, activeGroupId)}
                      disabled={hasUncompletedPrev}
                    />
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </AppLayout>
  );
}
