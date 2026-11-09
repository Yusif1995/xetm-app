"use client";

// Overview on "Səhifələrim": my juz, the group's khatm, my reading streak, and (desktop only) the
// reading rhythm of the last 7 days.
import Link from "next/link";
import { activeKhatms, helperPages, khatmSummaries, type Assignment } from "@/lib/khatm";
import { addDays, bakuDay, dailyPages } from "@/lib/analytics";
import { khatmLabel } from "@/lib/quran";
import { formatIsoDateAz } from "@/lib/dates";
import { Donut, LineChart, Panel, StatStrip, Up } from "./dash";

export function MyOverview({ assignments, uid, current }: { assignments: Assignment[]; uid: string; current: Assignment | null }) {
  const today = bakuDay(new Date());

  // My current juz
  const pages = current ? current.pages : [];
  const done = current ? current.completedPages.length : 0;
  const helped = current ? helperPages(current) : new Set<number>();
  const helpedUnread = pages.filter((p) => helped.has(p) && !current!.completedPages.includes(p)).length;
  const remaining = pages.filter((p) => !helped.has(p) && !current!.completedPages.includes(p)).length;

  // The group's current khatm
  const summaries = khatmSummaries(assignments);
  const khatm = activeKhatms(assignments)[0] ?? summaries[summaries.length - 1]?.khatm ?? 1;
  const sum = summaries.find((k) => k.khatm === khatm) || null;
  const inKhatm = assignments.filter((a) => a.khatm === khatm && !a.done);
  const reading = new Set(inKhatm.filter((a) => a.completedPages.length > 0).map((a) => a.juz)).size;
  const given = new Set(inKhatm.filter((a) => a.completedPages.length === 0).map((a) => a.juz)).size;
  const pct = sum ? Math.round((sum.pagesRead / sum.totalPages) * 100) : 0;

  // Last 7 days, and the streak of days in a row with a page read (today, or up to yesterday)
  const week = dailyPages(assignments, addDays(today, -6), today);
  const myWeek = dailyPages(assignments, addDays(today, -6), today, uid);
  const myToday = myWeek[myWeek.length - 1]?.pages || 0;
  const days = dailyPages(assignments, addDays(today, -89), today, uid).map((d) => d.pages > 0);
  let streak = 0;
  for (let i = days.length - (days[days.length - 1] ? 1 : 2); i >= 0 && days[i]; i--) streak++;
  const labels = week.map((d, i) => (i === week.length - 1 ? "Bu gün" : `${Number(d.day.slice(8, 10))}`));

  return (
    <>
      <StatStrip
        items={[
          {
            label: "Mənim cüzüm",
            value: current ? done : "–",
            unit: current ? `/ ${pages.length} səhifə` : undefined,
            note: current
              ? remaining > 0
                ? <><Up tone="warn">{remaining} qalıb</Up>{current.endDate ? ` · bitmə ${formatIsoDateAz(current.endDate)}` : ""}</>
                : "Öz səhifələrin bitib"
              : "Hələ cüz verilməyib",
          },
          {
            label: "Qrupun xətmi",
            value: sum?.pagesRead ?? 0,
            unit: `/ ${sum?.totalPages ?? 604}`,
            note: <><Up>{pct}%</Up> · {khatmLabel(khatm)}</>,
          },
          {
            label: "Bitmiş cüzlər",
            value: sum?.done ?? 0,
            unit: "/ 30",
            note: `${reading} oxunur, ${given} verilib`,
          },
          {
            label: "Ardıcıl oxuma",
            value: streak,
            unit: "gün",
            note: myToday > 0 ? <><Up>{myToday}</Up> səhifə bu gün</> : streak > 0 ? "Bu gün də oxu, zəncir qırılmasın" : "Bu gün bir səhifə ilə başla",
          },
        ]}
      />

      <div className="grid md:grid-cols-[1fr_1.9fr] gap-5 md:gap-6">
        <Panel id="gedis" title="Mənim cüzüm" action={current ? <span className="text-[13px] font-semibold text-muted">Cüz {current.juz} · {khatmLabel(current.khatm)}</span> : undefined}>
          <Donut
            parts={[
              { label: "Oxunub", value: done, color: "#0F5C45" },
              ...(helpedUnread > 0 ? [{ label: "Dostun oxuyur", value: helpedUnread, color: "#23406B" }] : []),
              { label: "Qalıb", value: remaining, color: "#D9DBD2" },
            ]}
            center={done}
            caption={`${pages.length || 20} səhifədən`}
          />
        </Panel>
        <Panel
          id="ritm"
          className="hidden md:flex"
          title="Oxuma ritmi"
          sub="Son 7 gündə oxunan səhifələr"
          action={<Link href="/analytics" className="press inline-flex items-center min-h-[44px] px-3.5 rounded-[10px] border border-line text-[13px] font-bold text-ink hover:bg-cream">Analitika</Link>}
        >
          <LineChart
            series={[
              { label: "Qrup", color: "#23406B", values: week.map((d) => d.pages) },
              { label: "Mən", color: "#C4862A", values: myWeek.map((d) => d.pages) },
            ]}
            labels={labels}
          />
        </Panel>
      </div>

    </>
  );
}
