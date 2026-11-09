"use client";

import { useAuth } from "@/lib/auth";
import { isUserApprovedInGroup } from "@/lib/db";
import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import Link from "next/link";
import { khatmLabel } from "@/lib/quran";
import { formatIsoDateAz } from "@/lib/dates";
import { helperPages, memberStats, openAssignmentsOf } from "@/lib/khatm";
import { useGroupAssignments } from "@/lib/useGroupData";
import { Card, IconBook, LoadingScreen, PageHeader, btn } from "@/components/ui";
import { MyOverview } from "@/components/MyOverview";
import { JuzBadge } from "@/components/GroupWidgets";
import { PageMedal } from "@/components/ornament";

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
  // Pages a friend reads for you: not yours to read, though the juz stays yours
  const helped = helperPages(current);
  const nextPage = pages.find((p) => !done.includes(p) && !helped.has(p));
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
          tabs={[
            { id: "gedis", label: "Mənim cüzüm" },
            { id: "ritm", label: "Oxuma ritmi" },
            { id: "butun", label: "Səhifələr" },
            ...(mine.juzDone.length > 0 ? [{ id: "bitirdiklerim", label: "Bitirdiklərim" }] : []),
          ]}
        />

        <MyOverview assignments={assignments} uid={user!.uid} current={current} />

        <div className="flex flex-wrap gap-5 md:gap-7 items-start">
          <div className="flex-[999_1_520px] min-w-0 flex flex-col gap-5 md:gap-7">


            {/* Current juz pages */}
            <Card id="butun" className="scroll-mt-28">
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
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-x-1 gap-y-1.5">
                  {visiblePages.map((p, i) => {
                    const isDone = done.includes(p);
                    const isNext = p === nextPage;
                    const isHelped = !isDone && helped.has(p);
                    return (
                      <PageMedal
                        key={p}
                        page={p}
                        index={i}
                        href={`/oxu?s=${p}`}
                        state={isDone ? "done" : isNext ? "next" : isHelped ? "helped" : "open"}
                        label={`Səhifə ${p}${isDone ? ", oxunub" : isNext ? ", növbəti" : isHelped ? ", dostun oxuyur" : ", gözləyir"}. Quranda aç`}
                      />
                    );
                  })}
                </div>
              )}
            </Card>

          </div>

          {/* Right column */}
          <div className="flex-[1_1_320px] min-w-0 flex flex-col gap-5 md:gap-7">
            {/* Queued juz (locked until the current one is finished) */}
            {queued.length > 0 && (
              <Card>
                <h2 className="m-0 text-base md:text-lg font-bold text-ink">Növbədə olan cüzlər</h2>
                <p className="m-0 text-sm text-muted">Cari cüzü bitirəndə növbəti cüz açılacaq.</p>
                <div className="flex flex-wrap gap-2">
                  {queued.map((a) => (
                    <JuzBadge
                      key={a.id}
                      size="sm"
                      juz={a.juz}
                      state="locked"
                      sub="Kilidli"
                      label={`Cüz ${a.juz}, ${khatmLabel(a.khatm)}, kilidli`}
                      title={a.startDate && a.endDate ? `${khatmLabel(a.khatm)} · ${formatIsoDateAz(a.startDate)} — ${formatIsoDateAz(a.endDate)}` : khatmLabel(a.khatm)}
                    />
                  ))}
                </div>
              </Card>
            )}

            <FinishedList items={mine.juzDone} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function FinishedList({ items }: { items: { khatm: number; juz: number; doneAt: string | null }[] }) {
  if (items.length === 0) return null;
  return (
    <Card id="bitirdiklerim" className="scroll-mt-28">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="m-0 text-base md:text-lg font-bold text-ink">Bitirdiyim cüzlər</h2>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-donebg text-donetext">{items.length} cüz</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {[...items].reverse().map((x) => (
          <JuzBadge
            key={`${x.khatm}-${x.juz}`}
            size="sm"
            juz={x.juz}
            state="done"
            sub={khatmLabel(x.khatm)}
            title={x.doneAt ? `Bitib: ${formatIsoDateAz(x.doneAt.slice(0, 10))}` : undefined}
          />
        ))}
      </div>
    </Card>
  );
}
