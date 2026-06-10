"use client";

import { useAuth } from "@/lib/auth";
import PageCard from "@/components/PageCard";
import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import Link from "next/link";

export default function ReadingsPage() {
  const { user, loading, refreshUser } = useAuth();
  const [completedPagesState, setCompletedPagesState] = useState<number[]>([]);

  useEffect(() => {
    if (user) {
      setCompletedPagesState(user.completedPages || []);
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

  // Group pages into chunks of 5
  const sortedPages = [...assignedPages].sort((a, b) => a - b);
  const pageChunks: number[][] = [];
  for (let i = 0; i < sortedPages.length; i += 5) {
    pageChunks.push(sortedPages.slice(i, i + 5));
  }

  const handleStatusChange = (pageNumbers: number[], isCompleted: boolean) => {
    if (isCompleted) {
      setCompletedPagesState(prev => {
        const next = [...prev];
        pageNumbers.forEach(p => {
          if (!next.includes(p)) {
            next.push(p);
          }
        });
        return next;
      });
    } else {
      setCompletedPagesState(prev => prev.filter(p => !pageNumbers.includes(p)));
    }
    refreshUser();
  };

  return (
    <AppLayout activeTab="readings">
      <div className="space-y-6">
        {/* Welcome Banner */}
        <div className="p-6 islamic-card relative overflow-hidden">
          <div className="islamic-card-inner" />
          <div className="islamic-pattern" />
          <div className="relative z-10">
            <h2 className="text-2xl font-amiri font-bold text-[#c9a84c] mb-1">
              Mənim Səhifələrim
            </h2>
            <p className="text-xs text-[#fdf6e3]/75 max-w-xl">
              Sizin üçün təyin edilmiş Quran səhifələrinin tam siyahısı aşağıdakı kimidir. Oxuduğunuz 5-lik səhifə qruplarını buradan tək-tək işarələyə bilərsiniz.
            </p>
          </div>
        </div>

        {/* Assigned Pages List */}
        {assignedPages.length === 0 ? (
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
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#fdf6e3]/80 uppercase tracking-wider flex items-center gap-2.5">
              <span>Səhifələrin Siyahısı</span>
              <span className="text-xs bg-[#c9a84c]/20 text-[#c9a84c] px-2.5 py-0.5 rounded-full border border-[#c9a84c]/30 font-mono">
                {assignedPages.length} səhifə ({pageChunks.length} qrup)
              </span>
            </h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {pageChunks.map((chunk) => (
                <PageCard
                  key={chunk.join(",")}
                  userId={user.uid}
                  pageNumbers={chunk}
                  initialCompleted={chunk.every((page) => completedPagesState.includes(page))}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
