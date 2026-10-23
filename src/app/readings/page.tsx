"use client";

import { useAuth } from "@/lib/auth";
import { isUserApprovedInGroup } from "@/lib/db";
import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import Link from "next/link";
import { khatmLabel, surahForPage } from "@/lib/quran";
import { formatIsoDateAz } from "@/lib/dates";
import { memberStats, openAssignmentsOf } from "@/lib/khatm";
import { useGroupAssignments } from "@/lib/useGroupData";
import { Bar, Card, IconBook, LoadingScreen, PageHeader, btn } from "@/components/ui";

type Filter = "all" | "done" | "pending";

export default function ReadingsPage() {
  const { user, loading, activeGroupId, activeGroup, isSuperAdmin } = useAuth();
  const approvedHere = !!user && (isSuperAdmin || isUserApprovedInGroup(user, activeGroupId, activeGroup));
  const { assignments, loaded } = useGroupAssignments(activeGroupId, approvedHere);
  const [filter, setFilter] = useState<Filter>("all");

  if (loading || (approvedHere && !loaded)) {
    return <LoadingScreen />;
  }

  if (!user) {
    return null; // Guarded by middleware
  }

  // Oldest unfinished juz first; only that one can be marked (the rest are locked until it is done)
  const myOpen = openAssignmentsOf(assignments, user.uid);
  const current = myOpen[0] || null;
  const queued = myOpen.slice(1);
  const mine = memberStats(assignments, user.uid);


  // Nothing to read right now
  if (!current) {
    return (
      <AppLayout activeTab="readings">
        <div className="flex flex-col gap-5 md:gap-7">
          <PageHeader title="Səhifələrim" subtitle="Sənə təyin edilmiş cüzlər burada görünəcək" />
          <section className="bg-white border border-line rounded-hero shadow-card px-5 py-8 md:px-8 md:py-14 flex flex-col items-center text-center gap-3.5 md:gap-[18px]">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-mint flex items-center justify-center text-forest">
              <IconBook size={44} />
            </div>
            <h2 className="m-0 font-bold text-2xl md:text-[28px] leading-tight text-ink">
              {mine.juzDone.length > 0 ? "Bütün cüzlərini bitirdin" : "Hələ sənə cüz təyin edilməyib"}
            </h2>
            <p className="m-0 max-w-[460px] text-sm md:text-base leading-relaxed text-muted">
              {mine.juzDone.length > 0
                ? "Allah qəbul etsin. Növbəti bölgüdə sənə yeni cüz veriləcək."
                : "Qrup sahibi cüzləri bölüşdürən kimi cüzün burada görünəcək və bildiriş alacaqsan."}
            </p>
            <div className="flex flex-col md:flex-row gap-2.5 md:gap-3 w-full md:w-auto mt-1.5">
              <Link href="/dashboard" className={btn.primary}>Panelə qayıt</Link>
              <Link href="/analytics" className={btn.outline}>Analitikama bax</Link>
            </div>
          </section>
          <FinishedList items={mine.juzDone} />
        </div>
      </AppLayout>
    );
  }

  const pages = [...current.pages].sort((a, b) => a - b);
  const done = current.completedPages;
  const nextPage = pages.find((p) => !done.includes(p));
  const remaining = pages.length - done.length;
  const ratio = pages.length > 0 ? done.length / pages.length : 0;
  const counts = {
    all: pages.length,
    done: pages.filter((p) => done.includes(p)).length,
    pending: pages.filter((p) => !done.includes(p)).length,
  };
  const visiblePages = pages.filter((p) =>
    filter === "all" ? true : filter === "done" ? done.includes(p) : !done.includes(p)
  );

  return (
    <AppLayout activeTab="readings">
      <div className="flex flex-col gap-5 md:gap-7">
        <PageHeader
          title="Səhifələrim"
          subtitle={`Cüz ${current.juz} · ${khatmLabel(current.khatm)}${activeGroup?.name ? ` · qrup: ${activeGroup.name}` : ""}`}
        />

        <div className="flex flex-wrap gap-5 md:gap-7 items-start">
          <div className="flex-[999_1_520px] min-w-0 flex flex-col gap-5 md:gap-7">

            {/* Next page hero */}
            <section aria-labelledby="novbeti" className="bg-white border border-line rounded-hero shadow-card p-5 md:p-8 flex flex-wrap items-center gap-4 md:gap-8">
              <div className="flex flex-col items-center justify-center w-[88px] h-[88px] md:w-[168px] md:h-[168px] rounded-[20px] md:rounded-hero bg-donebg shrink-0">
                <div className="text-[11px] md:text-[13px] font-bold text-donetext">Səhifə</div>
                <div className="font-extrabold text-[44px] md:text-[80px] leading-none tabular-nums text-ink">{nextPage ?? pages[pages.length - 1]}</div>
              </div>
              <div className="flex-[1_1_200px] flex flex-col gap-4 min-w-0">
                <div className="flex flex-col gap-1 md:gap-1.5">
                  <div className="text-[13px] font-bold text-muted">Növbəti səhifə</div>
                  <h2 id="novbeti" className="m-0 font-bold text-[22px] md:text-[28px] leading-tight text-ink">
                    {nextPage ? surahForPage(nextPage) : "Hamısı oxunub"}
                  </h2>
                  <div className="text-[14px] md:text-[15px] text-muted">
                    Cüz {current.juz} · {khatmLabel(current.khatm)} · {remaining} səhifə qalıb
                  </div>
                </div>
                {nextPage && (
                  <div className="flex flex-col md:flex-row gap-2.5 md:gap-3">
                    <Link href={`/oxu?s=${nextPage}`} className={btn.gold}>Quranda oxu</Link>
                  </div>
                )}
              </div>
            </section>

            {/* Current juz pages */}
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="m-0 text-base md:text-lg font-bold text-ink">Bütün səhifələr</h2>
                <div role="tablist" aria-label="Filtr" className="grid grid-cols-3 md:flex gap-1 p-1 rounded-[14px] bg-sand w-full md:w-auto">
                  {([
                    ["all", "Hamısı", counts.all],
                    ["done", "Oxunmuş", counts.done],
                    ["pending", "Gözləyən", counts.pending],
                  ] as [Filter, string, number][]).map(([key, label, count]) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={filter === key}
                      onClick={() => setFilter(key)}
                      className={`press min-h-[40px] px-1.5 md:px-3.5 rounded-[11px] text-[12px] md:text-[13px] whitespace-nowrap inline-flex items-center justify-center gap-1 ${
                        filter === key ? "bg-white text-forest font-extrabold shadow-card" : "text-muted font-bold"
                      }`}
                    >
                      {label}
                      <span className="tabular-nums">· {count}</span>
                    </button>
                  ))}
                </div>
              </div>
              {current.startDate && current.endDate && (
                <div className="text-xs text-muted font-semibold">
                  Müddət: {formatIsoDateAz(current.startDate)} — {formatIsoDateAz(current.endDate)}
                </div>
              )}
              {visiblePages.length === 0 ? (
                <p className="m-0 text-sm text-muted">Bu filtrdə səhifə yoxdur.</p>
              ) : (
                <div className="grid grid-cols-5 md:grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-2">
                  {visiblePages.map((p) => {
                    const isDone = done.includes(p);
                    const isNext = p === nextPage;
                    return (
                      <Link
                        key={p}
                        href={`/oxu?s=${p}`}
                        aria-label={`Səhifə ${p}${isDone ? ", oxunub" : isNext ? ", növbəti" : ", gözləyir"}. Quranda aç`}
                        className={`press min-h-[48px] rounded-[14px] font-bold text-[15px] tabular-nums box-border flex items-center justify-center ${
                          isDone
                            ? "bg-forest text-white border border-forest"
                            : isNext
                              ? "bg-mint text-forest border-2 border-forest"
                              : "bg-cream text-muted border border-line"
                        }`}
                      >
                        {p}
                      </Link>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Queued juz (locked until the current one is finished) */}
            {queued.length > 0 && (
              <Card>
                <h2 className="m-0 text-base md:text-lg font-bold text-ink">Növbədə olan cüzlər</h2>
                <p className="m-0 text-sm text-muted">Cari cüzü bitirəndə növbəti cüz açılacaq.</p>
                <div className="flex flex-col gap-2">
                  {queued.map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-cream opacity-80">
                      <div className="min-w-0">
                        <div className="text-[15px] font-extrabold text-ink">Cüz {a.juz} · {khatmLabel(a.khatm)}</div>
                        <div className="text-xs text-muted">
                          {a.startDate && a.endDate ? `${formatIsoDateAz(a.startDate)} — ${formatIsoDateAz(a.endDate)}` : `${a.pages.length} səhifə`}
                        </div>
                      </div>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-sand text-muted">Kilidli</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <FinishedList items={mine.juzDone} />
          </div>

          {/* Right column */}
          <div className="flex-[1_1_320px] min-w-0 flex flex-col gap-5 md:gap-7">
            <Card>
              <h2 className="m-0 text-sm md:text-[15px] font-bold text-muted">Cüz {current.juz} gedişatı</h2>
              <div className="flex items-baseline gap-2">
                <div className="font-extrabold text-4xl md:text-[40px] leading-none tabular-nums text-ink">{done.length}</div>
                <div className="text-sm md:text-[15px] text-muted">/ {pages.length} səhifə</div>
              </div>
              <Bar ratio={ratio} color={ratio >= 1 ? "done" : "accent"} height={12} />
              <div className="text-xs md:text-[13px] text-muted">Cüzün {Math.round(ratio * 100)}%-i oxunub</div>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function FinishedList({ items }: { items: { khatm: number; juz: number; doneAt: string | null }[] }) {
  if (items.length === 0) return null;
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="m-0 text-base md:text-lg font-bold text-ink">Bitirdiyim cüzlər</h2>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-donebg text-donetext">{items.length} cüz</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {[...items].reverse().map((x) => (
          <span
            key={`${x.khatm}-${x.juz}`}
            title={x.doneAt ? formatIsoDateAz(x.doneAt.slice(0, 10)) : undefined}
            className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-[12px] bg-donebg text-sm font-bold text-donetext"
          >
            Cüz {x.juz}
            <span className="text-xs font-medium text-muted">· {khatmLabel(x.khatm)}</span>
          </span>
        ))}
      </div>
    </Card>
  );
}
