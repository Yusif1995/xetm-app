"use client";

import { useAuth } from "@/lib/auth";
import { togglePreviousCompletedPages, toggleCompletedPages, getUserAssignment } from "@/lib/db";
import { useEffect, useState, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import Link from "next/link";
import { surahForPage } from "@/lib/quran";
import { formatIsoDateAz } from "@/lib/dates";
import { Bar, Card, IconBook, LoadingScreen, PageHeader, btn } from "@/components/ui";

type Filter = "all" | "done" | "pending";

export default function ReadingsPage() {
  const { user, loading, refreshUser, activeGroupId, activeGroup } = useAuth();
  const [completedPagesState, setCompletedPagesState] = useState<number[]>([]);
  const [prevCompletedPagesState, setPrevCompletedPagesState] = useState<number[]>([]);
  const [busyPage, setBusyPage] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const activeAssignment = useMemo(
    () => user ? getUserAssignment(user, activeGroupId) : null,
    [user, activeGroupId]
  );

  const completedPagesKey = JSON.stringify(activeAssignment?.completedPages || []);
  const prevCompletedPagesKey = JSON.stringify(activeAssignment?.previousCompletedPages || []);
  useEffect(() => {
    setCompletedPagesState(activeAssignment?.completedPages || []);
    setPrevCompletedPagesState(activeAssignment?.previousCompletedPages || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedPagesKey, prevCompletedPagesKey]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return null; // Guarded by middleware
  }

  const assignedPages = [...(activeAssignment?.assignedPages || [])].sort((a, b) => a - b);
  const prevAssignedPages = [...(activeAssignment?.previousAssignedPages || [])].sort((a, b) => a - b);

  // Previous assignment must be completed before the new one unlocks
  const hasUncompletedPrev = prevAssignedPages.length > 0 &&
    !prevAssignedPages.every(p => prevCompletedPagesState.includes(p));

  // The hero works on the previous assignment first while it is unfinished
  const workingPrev = hasUncompletedPrev;
  const workingPages = workingPrev ? prevAssignedPages : assignedPages;
  const workingDone = workingPrev ? prevCompletedPagesState : completedPagesState;
  const nextPage = workingPages.find((p) => !workingDone.includes(p));
  const doneCount = workingPages.filter((p) => workingDone.includes(p)).length;
  const remaining = workingPages.length - doneCount;

  const juzs = activeAssignment?.assignedJuzs?.length
    ? activeAssignment.assignedJuzs
    : activeAssignment?.assignedJuz ? [activeAssignment.assignedJuz] : [];
  const juzLabel = juzs.length > 0 ? `Cüz ${juzs.join(", ")}` : "Təyinat";

  const togglePage = async (page: number, isCompleted: boolean, previous: boolean) => {
    const key = `${previous ? "p" : "c"}${page}`;
    if (busyPage) return;
    setBusyPage(key);
    try {
      if (previous) {
        await togglePreviousCompletedPages(user.uid, [page], isCompleted, activeGroupId);
        setPrevCompletedPagesState(prev => isCompleted ? [...prev, page] : prev.filter(p => p !== page));
      } else {
        await toggleCompletedPages(user.uid, [page], isCompleted, activeGroupId);
        setCompletedPagesState(prev => isCompleted ? [...prev, page] : prev.filter(p => p !== page));
      }
      refreshUser();
    } catch (err) {
      console.error("Error toggling page:", err);
    } finally {
      setBusyPage(null);
    }
  };

  const subtitle = assignedPages.length > 0
    ? `Sənə təyin edilmiş səhifələr · ${juzLabel}${activeGroup?.name ? ` · qrup: ${activeGroup.name}` : ""}`
    : "Sənə təyin edilmiş səhifələr burada görünəcək";

  const hadith = (
    <figure className="m-0 bg-white border border-line rounded-card p-5 md:p-6 flex flex-col gap-2.5 md:gap-3">
      <figcaption className="text-xs md:text-[13px] font-bold text-goldtext">Günün hədisi · istikrar və davamlılıq</figcaption>
      <blockquote className="m-0 font-display font-semibold text-[19px] md:text-[22px] leading-[1.4] text-forest">
        Allah qatında əməllərin ən sevimlisi az da olsa davamlı olanıdır.
      </blockquote>
      <div className="text-xs md:text-[13px] text-muted">Buxari</div>
    </figure>
  );

  // Empty state
  if (assignedPages.length === 0 && prevAssignedPages.length === 0) {
    return (
      <AppLayout activeTab="readings">
        <div className="flex flex-col gap-5 md:gap-7">
          <PageHeader title="Səhifələrim" subtitle={subtitle} />
          <section className="bg-white border border-line rounded-[22px] md:rounded-hero px-5 py-8 md:px-8 md:py-14 flex flex-col items-center text-center gap-3.5 md:gap-[18px]">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-mint flex items-center justify-center text-forest">
              <IconBook size={44} />
            </div>
            <h2 className="m-0 font-display font-semibold text-2xl md:text-[28px] leading-tight text-forest">Hələ sənə səhifə təyin edilməyib</h2>
            <p className="m-0 max-w-[460px] text-sm md:text-base leading-relaxed text-muted">
              Qrup sahibi cüzləri bölüşdürən kimi səhifələrin burada görünəcək və bildiriş alacaqsan.
            </p>
            <div className="flex flex-col md:flex-row gap-2.5 md:gap-3 w-full md:w-auto mt-1.5">
              <Link href="/dashboard" className={btn.primary}>Panelə qayıt</Link>
              <Link href="/progress" className={btn.outline}>Qrupa bax</Link>
            </div>
          </section>
          <div className="max-w-[640px] w-full mx-auto">{hadith}</div>
        </div>
      </AppLayout>
    );
  }

  const counts = {
    all: assignedPages.length,
    done: assignedPages.filter((p) => completedPagesState.includes(p)).length,
    pending: assignedPages.filter((p) => !completedPagesState.includes(p)).length,
  };
  const visiblePages = assignedPages.filter((p) =>
    filter === "all" ? true : filter === "done" ? completedPagesState.includes(p) : !completedPagesState.includes(p)
  );
  const currentDone = counts.done;
  const currentRatio = assignedPages.length > 0 ? currentDone / assignedPages.length : 0;
  const nextCurrent = assignedPages.find((p) => !completedPagesState.includes(p));

  return (
    <AppLayout activeTab="readings">
      <div className="flex flex-col gap-5 md:gap-7">
        <PageHeader title="Səhifələrim" subtitle={subtitle} />

        <div className="flex flex-wrap gap-5 md:gap-7 items-start">
          <div className="flex-[999_1_520px] min-w-0 flex flex-col gap-5 md:gap-7">

            {/* Next page hero */}
            <section aria-labelledby="novbeti" className="bg-forest text-cream rounded-[22px] md:rounded-hero p-5 md:p-8 flex flex-wrap items-center gap-4 md:gap-8">
              <div className="flex flex-col items-center justify-center w-[88px] h-[88px] md:w-[168px] md:h-[168px] rounded-[18px] md:rounded-hero bg-[rgba(247,243,234,0.08)] border border-[rgba(226,184,92,0.5)] shrink-0">
                <div className="text-[11px] md:text-[13px] font-semibold text-gold">Səhifə</div>
                <div className="font-display font-bold text-[44px] md:text-[84px] leading-none">{nextPage ?? "✓"}</div>
              </div>
              <div className="flex-[1_1_200px] flex flex-col gap-4 min-w-0">
                <div className="flex flex-col gap-1 md:gap-1.5">
                  <div className="text-xs md:text-[13px] font-semibold text-gold">
                    {workingPrev ? "Əvvəlki tapşırıq · növbəti səhifə" : "Növbəti səhifə"}
                  </div>
                  <h2 id="novbeti" className="m-0 font-display font-semibold text-[22px] md:text-[28px] leading-tight">
                    {nextPage ? surahForPage(nextPage) : "Hamısı oxunub"}
                  </h2>
                  <div className="text-[13px] md:text-[15px] text-onforest">
                    {remaining > 0 ? `${workingPrev ? "Əvvəlki tapşırıq" : juzLabel} · ${remaining} səhifə qalıb` : "Allah qəbul etsin"}
                  </div>
                </div>
                {nextPage && (
                  <div className="flex flex-col md:flex-row gap-2.5 md:gap-3">
                    <button
                      type="button"
                      onClick={() => togglePage(nextPage, true, workingPrev)}
                      disabled={!!busyPage}
                      className={btn.gold}
                    >
                      {busyPage ? "Qeyd edilir..." : "Oxudum"}
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* Previous assignment */}
            {prevAssignedPages.length > 0 && (
              <Card danger={hasUncompletedPrev}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className={`m-0 text-base md:text-lg font-bold ${hasUncompletedPrev ? "text-danger" : "text-forest"}`}>
                    Əvvəlki oxu tapşırığı
                  </h2>
                  {activeAssignment?.previousStartDate && activeAssignment?.previousEndDate && (
                    <span className="text-xs text-muted font-semibold">
                      {formatIsoDateAz(activeAssignment.previousStartDate)} — {formatIsoDateAz(activeAssignment.previousEndDate)}
                    </span>
                  )}
                </div>
                {hasUncompletedPrev && (
                  <p className="m-0 text-sm text-danger">
                    Yeni səhifələri işarələmək üçün əvvəlcə bu tapşırığı bitirməlisən.
                  </p>
                )}
                <PageGrid
                  pages={prevAssignedPages}
                  done={prevCompletedPagesState}
                  busyKey={busyPage}
                  keyPrefix="p"
                  onToggle={(p, isCompleted) => togglePage(p, isCompleted, true)}
                />
              </Card>
            )}

            {/* Current assignment */}
            {assignedPages.length > 0 && (
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="m-0 text-base md:text-lg font-bold text-forest">
                    {prevAssignedPages.length > 0 ? "Yeni oxu tapşırığı" : "Bütün səhifələr"}
                  </h2>
                  <div role="tablist" aria-label="Filtr" className="grid grid-cols-3 md:flex gap-1 p-1 rounded-xl bg-[#F1EBDB] w-full md:w-auto">
                    {([
                      ["all", `Hamısı · ${counts.all}`],
                      ["done", `Oxunmuş · ${counts.done}`],
                      ["pending", `Gözləyən · ${counts.pending}`],
                    ] as [Filter, string][]).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={filter === key}
                        onClick={() => setFilter(key)}
                        className={`min-h-[36px] md:min-h-[36px] px-3.5 rounded-[9px] text-xs md:text-[13px] ${
                          filter === key ? "bg-white text-forest font-bold" : "text-muted font-semibold"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {activeAssignment?.assignmentStartDate && activeAssignment?.assignmentEndDate && (
                  <div className="text-xs text-muted font-semibold">
                    Müddət: {formatIsoDateAz(activeAssignment.assignmentStartDate)} — {formatIsoDateAz(activeAssignment.assignmentEndDate)}
                  </div>
                )}
                {hasUncompletedPrev && (
                  <p className="m-0 text-sm text-progresstext">Yeni səhifələr əvvəlki tapşırıq bitəndə açılacaq.</p>
                )}
                <PageGrid
                  pages={visiblePages}
                  done={completedPagesState}
                  next={nextCurrent}
                  busyKey={busyPage}
                  keyPrefix="c"
                  disabled={hasUncompletedPrev}
                  onToggle={(p, isCompleted) => togglePage(p, isCompleted, false)}
                />
              </Card>
            )}
          </div>

          {/* Right column */}
          <div className="flex-[1_1_320px] min-w-0 flex flex-col gap-5 md:gap-7">
            {assignedPages.length > 0 && (
              <Card>
                <h2 className="m-0 text-sm md:text-[15px] font-bold text-muted">{juzLabel} gedişatı</h2>
                <div className="flex items-baseline gap-2">
                  <div className="font-display font-bold text-4xl md:text-[44px] leading-none text-forest">{currentDone}</div>
                  <div className="text-sm md:text-[15px] text-muted">/ {assignedPages.length} səhifə</div>
                </div>
                <Bar ratio={currentRatio} color={currentRatio >= 1 ? "done" : "accent"} height={12} />
                <div className="text-xs md:text-[13px] text-muted">Təyinatın {Math.round(currentRatio * 100)}%-i oxunub</div>
              </Card>
            )}
            {hadith}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function PageGrid({
  pages,
  done,
  next,
  busyKey,
  keyPrefix,
  disabled = false,
  onToggle,
}: {
  pages: number[];
  done: number[];
  next?: number;
  busyKey: string | null;
  keyPrefix: string;
  disabled?: boolean;
  onToggle: (page: number, isCompleted: boolean) => void;
}) {
  if (pages.length === 0) {
    return <p className="m-0 text-sm text-muted">Bu filtrdə səhifə yoxdur.</p>;
  }
  return (
    <div className="grid grid-cols-5 md:grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-2">
      {pages.map((p) => {
        const isDone = done.includes(p);
        const isNext = p === next;
        return (
          <button
            key={p}
            type="button"
            onClick={() => onToggle(p, !isDone)}
            disabled={disabled || !!busyKey}
            aria-pressed={isDone}
            aria-label={`Səhifə ${p}${isDone ? ", oxunub" : isNext ? ", növbəti" : ", gözləyir"}`}
            className={`min-h-[44px] md:min-h-[48px] rounded-xl font-bold text-[15px] box-border transition-colors disabled:cursor-not-allowed ${
              isDone
                ? "bg-forest text-cream border border-forest"
                : isNext
                  ? "bg-white text-forest border-2 border-accent"
                  : "bg-white text-muted border border-[#D9D1BE]"
            } ${busyKey === `${keyPrefix}${p}` ? "opacity-50" : ""} ${disabled ? "opacity-60" : ""}`}
          >
            {p}
          </button>
        );
      })}
    </div>
  );
}
