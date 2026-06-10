"use client";

import { useAuth } from "@/lib/auth";
import PageCard from "@/components/PageCard";
import { togglePreviousCompletedPages } from "@/lib/db";
import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import Link from "next/link";

export default function ReadingsPage() {
  const { user, loading, refreshUser } = useAuth();
  const [completedPagesState, setCompletedPagesState] = useState<number[]>([]);
  const [prevCompletedPagesState, setPrevCompletedPagesState] = useState<number[]>([]);

  useEffect(() => {
    if (user) {
      setCompletedPagesState(user.completedPages || []);
      setPrevCompletedPagesState(user.previousCompletedPages || []);
    }
  }, [user]);

  if (loading) {
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

  if (!user) {
    return null; // Guarded by middleware
  }

  const assignedPages = user.assignedPages || [];
  const prevAssignedPages = user.previousAssignedPages || [];

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
      <div className="space-y-6">
        
        {/* Hadith Header Banner */}
        <div className="p-5 islamic-card relative overflow-hidden text-center border border-[#c9a84c]/30 rounded-xl bg-gradient-to-r from-[#0c2e1b] via-[#05180d] to-[#0c2e1b]">
          <div className="islamic-card-inner" />
          <div className="islamic-pattern opacity-[0.03]" />
          <div className="relative z-10 space-y-2 max-w-xl mx-auto">
            <span className="text-[10px] font-bold text-[#c9a84c] uppercase tracking-widest block">Günün Hədisi — İstikrar və Davamlılıq</span>
            <p className="font-serif text-sm md:text-base italic text-[#fdf6e3] leading-relaxed">
              &quot;Allah qatında əməllərin ən sevimlisi az da olsa davamlı olanıdır.&quot;
            </p>
            <span className="text-[10px] text-[#fdf6e3]/50 block font-semibold">— Buxari</span>
          </div>
        </div>

        {/* Assigned Pages List */}
        {assignedPages.length === 0 && prevAssignedPages.length === 0 ? (
          <div className="text-center py-16 px-6 islamic-card max-w-2xl mx-auto flex flex-col items-center">
            <div className="islamic-card-inner" />
            <div className="islamic-pattern" />
            <div className="relative z-10 flex flex-col items-center w-full">
              <span className="text-5xl mb-4">🕋</span>
              <h3 className="text-lg font-semibold text-[#fdf6e3] mb-2">Səhifə təyin edilməyib</h3>
              <p className="text-sm text-[#fdf6e3]/60 leading-relaxed mb-6 max-w-md">
                Hörmətli iştirakçı, hazırda sizə oxumaq üçün heç bir səhifə təyin edilməyib.
              </p>
              <Link
                href="/dashboard"
                className="px-4 py-2 bg-[#c9a84c]/20 hover:bg-[#c9a84c]/30 text-[#c9a84c] border border-[#c9a84c]/40 font-semibold rounded-lg transition-all text-xs"
              >
                Panelə Qayıt
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Section 1: Previous Assignment (if exists and has uncompleted pages) */}
            {prevAssignedPages.length > 0 && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 border-b border-[#c9a84c]/20 pb-3">
                  <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
                    <span>⚠️ Əvvəlki Oxu Tapşırığı</span>
                    <span className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full border border-red-500/20 font-mono">
                      {prevAssignedPages.length} səhifə
                    </span>
                  </h3>
                  {user.previousStartDate && user.previousEndDate && (
                    <span className="text-[10px] md:text-xs font-bold text-red-400 bg-red-950/20 px-3 py-1 rounded-lg border border-red-500/25 font-mono">
                      Müddət: {formatDateDisplay(user.previousStartDate)} — {formatDateDisplay(user.previousEndDate)}
                    </span>
                  )}
                </div>

                {hasUncompletedPrev && (
                  <div className="p-3 bg-red-950/20 border border-red-500/30 text-red-400 text-[11px] rounded-xl text-center font-bold">
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
                      toggleFn={togglePreviousCompletedPages}
                      disabled={false}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Section 2: Current/New Assignment */}
            {assignedPages.length > 0 && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 border-b border-[#c9a84c]/20 pb-3">
                  <h3 className="text-sm font-bold text-[#fdf6e3]/90 uppercase tracking-wider flex items-center gap-2.5">
                    <span>📖 {prevAssignedPages.length > 0 ? "Yeni Oxu Tapşırığı" : "Təyin Olunmuş Səhifələrim"}</span>
                    <span className="text-xs bg-[#c9a84c]/20 text-[#c9a84c] px-2.5 py-0.5 rounded-full border border-[#c9a84c]/30 font-mono">
                      {assignedPages.length} səhifə
                    </span>
                  </h3>
                  {user.assignmentStartDate && user.assignmentEndDate && (
                    <span className="text-[10px] md:text-xs font-bold text-[#fdf6e3]/90 bg-[#05180d] px-3 py-1 rounded-lg border border-[#c9a84c]/25 font-mono">
                      Müddət: {formatDateDisplay(user.assignmentStartDate)} — {formatDateDisplay(user.assignmentEndDate)}
                    </span>
                  )}
                </div>

                {hasUncompletedPrev && (
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 text-yellow-500/80 text-[11px] rounded-xl text-center font-bold">
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
