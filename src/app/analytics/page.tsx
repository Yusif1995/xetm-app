"use client";

import { useEffect, useState, type ReactNode } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { getUserGroupIds, isUserApprovedInGroup, type UserDoc } from "@/lib/db";
import { khatmSummaries, memberStats, type Assignment } from "@/lib/khatm";
import {
  bakuDay, dailyPages, dayDiff, juzAvgDays, monthlyPages, perfAllTime, perfCurrent, personAllTime,
  type Perf, type PerfCat, type PersonAllTime,
} from "@/lib/analytics";
import { khatmLabel, ordinalAz } from "@/lib/quran";
import { formatIsoDateAz } from "@/lib/dates";
import { useGroupAssignments, useGroupFullNames } from "@/lib/useGroupData";
import { JuzBadge, JuzMap, khatmJuzTiles, participantName } from "@/components/GroupWidgets";
import AppLayout from "@/components/AppLayout";
import { Avatar, Bar, Card, LoadingScreen, PageHeader } from "@/components/ui";

type Period = "cur" | "all";

const MONTHS_SHORT = ["Yan", "Fev", "Mar", "Apr", "May", "İyn", "İyl", "Avq", "Sen", "Okt", "Noy", "Dek"];
const CAT: Record<PerfCat, { label: string; chip: string; bar: string }> = {
  strong: { label: "Güclü", chip: "bg-donebg text-donetext", bar: "bg-juzdone" },
  mid: { label: "Orta", chip: "bg-progress text-progresstext", bar: "bg-juzassignedline" },
  weak: { label: "Zəif", chip: "bg-[#FBEFEB] text-danger", bar: "bg-danger" },
  none: { label: "Məlumat yoxdur", chip: "bg-sand text-muted", bar: "bg-track" },
};
const dec = (x: number) => x.toFixed(1).replace(".", ",");
const pct = (x: number) => `${Math.round(x * 100)}%`;

export default function AnalyticsPage() {
  const { user, activeGroupId, activeGroup, isSuperAdmin } = useAuth();
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("cur");
  const [filter, setFilter] = useState<PerfCat | "all">("all");
  const [openMember, setOpenMember] = useState<string | null>(null);
  const isAdmin = !!user && (isSuperAdmin || activeGroup?.createdBy === user.uid);
  const fullNames = useGroupFullNames(activeGroupId, isAdmin);
  const approvedHere = !!user && (isSuperAdmin || isUserApprovedInGroup(user, activeGroupId, activeGroup));
  const { assignments, loaded } = useGroupAssignments(activeGroupId, approvedHere);

  useEffect(() => {
    if (!user) return;
    if (!activeGroupId) {
      setUsers([]);
      setUsersLoading(false);
      return;
    }
    const membersQuery = query(collection(db, "users"), where("groupIds", "array-contains", activeGroupId));
    const unsub = onSnapshot(membersQuery, (snap) => {
      setUsers(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserDoc)));
      setUsersLoading(false);
    }, (err) => {
      console.error("Error loading members:", err);
      setUsersLoading(false);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, activeGroupId]);

  if (!user || usersLoading || (approvedHere && !loaded)) {
    return <LoadingScreen text="Analitika hazırlanır..." />;
  }

  const groupCreatedBy = activeGroup?.createdBy || null;
  const members = users.filter((u) =>
    (getUserGroupIds(u).includes(activeGroupId) || u.uid === groupCreatedBy)
    && isUserApprovedInGroup(u, activeGroupId, activeGroup)
  );
  const nameOf = (u: UserDoc) => participantName(u, user, fullNames);

  const today = bakuDay(new Date());
  const summaries = khatmSummaries(assignments);
  const currentKhatm = summaries.find((k) => !k.completedAt)?.khatm ?? summaries[summaries.length - 1]?.khatm ?? 1;

  // Everyone's numbers, for ranking and the group averages
  const people = members.map((u) => {
    const all = personAllTime(assignments, u.uid, today);
    return { user: u, all, cur: perfCurrent(assignments, u.uid, currentKhatm, today) };
  });
  const withDays = people.filter((p) => p.all.avgDays !== null);
  const groupAvgDays = withDays.length ? withDays.reduce((s, p) => s + p.all.avgDays!, 0) / withDays.length : null;
  const withOnTime = people.filter((p) => p.all.onTime !== null);
  const groupOnTime = withOnTime.length ? withOnTime.reduce((s, p) => s + p.all.onTime!, 0) / withOnTime.length : null;
  const ranked = people
    .map((p) => ({ ...p, perf: period === "cur" ? p.cur : perfAllTime(p.all, groupAvgDays) }))
    .sort((a, b) => b.perf.score - a.perf.score || b.all.pages - a.all.pages);

  const pagesInKhatm = (uid: string) => memberStats(assignments, uid).perKhatm.find((k) => k.khatm === currentKhatm)?.pagesRead || 0;
  const groupAvg = {
    pagesCur: people.length ? people.reduce((s, p) => s + pagesInKhatm(p.user.uid), 0) / people.length : 0,
    pagesAll: people.length ? people.reduce((s, p) => s + p.all.pages, 0) / people.length : 0,
    avgDays: groupAvgDays,
    onTime: groupOnTime,
  };

  const ctx: Ctx = { assignments, today, khatm: currentKhatm, period, groupAvg, ranked: ranked.map((r) => ({ uid: r.user.uid, perf: r.perf })) };
  const me = people.find((p) => p.user.uid === user.uid);
  const periodLabel = period === "cur" ? khatmLabel(currentKhatm) : "bütün dövr";

  return (
    <AppLayout activeTab="analytics">
      <div className="flex flex-col gap-5 md:gap-7">
        <PageHeader
          title="Analitika"
          subtitle={`Qrupun oxuma ritmi · ${periodLabel}`}
          tabs={[
            { id: "qrup", label: "Qrup üzrə" },
            ...(isAdmin ? [{ id: "istirakcilar", label: "İştirakçılar" }] : me ? [{ id: "performans", label: "Performansım" }, { id: "sexsi", label: "Şəxsi analiz" }] : []),
          ]}
          actions={
            <Segmented
              label="Dövr"
              value={period}
              onChange={(v) => { setPeriod(v); setOpenMember(null); }}
              options={[["cur", "Cari xətm"], ["all", "Bütün dövr"]]}
            />
          }
        />

        {assignments.length === 0 ? (
          <Card><p className="m-0 text-sm text-muted">Hələ cüz paylanmayıb. İlk bölgüdən sonra analitika burada görünəcək.</p></Card>
        ) : (
          <>
            <Section id="qrup" title="Qrup üzrə" note={periodLabel} hideTitleMd>
              <GroupSection ctx={ctx} summaries={summaries} distributions={activeGroup?.distributionCount || 0} holderName={isAdmin ? (uid) => {
                const u = users.find((x) => x.uid === uid);
                return u ? nameOf(u) : "Keçmiş üzv";
              } : undefined} />
            </Section>

            {isAdmin ? (
              <Section id="istirakcilar" title="İştirakçılar" note={`${members.length} nəfər · ${periodLabel}`}>
                <AdminList
                  ctx={ctx}
                  rows={ranked}
                  nameOf={nameOf}
                  viewerUid={user.uid}
                  filter={filter}
                  onFilter={setFilter}
                  open={openMember}
                  onOpen={(uid) => setOpenMember(openMember === uid ? null : uid)}
                />
              </Section>
            ) : me ? (
              <>
                <Section id="performans" title="Bu qrupda performansın" note={periodLabel}>
                  <Card><Performance ctx={ctx} uid={me.user.uid} all={me.all} self /></Card>
                </Section>
                <Section id="sexsi" title="Şəxsi analizim" note={periodLabel}>
                  <Card><Personal ctx={ctx} uid={me.user.uid} all={me.all} /></Card>
                </Section>
              </>
            ) : null}
          </>
        )}
      </div>
    </AppLayout>
  );
}

interface Ctx {
  assignments: Assignment[];
  today: string;
  khatm: number;
  period: Period;
  groupAvg: { pagesCur: number; pagesAll: number; avgDays: number | null; onTime: number | null };
  ranked: { uid: string; perf: Perf }[];
}

// `hideTitleMd`: the section opens straight with its figure strip riding over the night band (phone and desktop)
function Section({ id, title, note, children, hideTitleMd = false }: { id?: string; title: string; note?: string; children: ReactNode; hideTitleMd?: boolean }) {
  return (
    <section id={id} className="scroll-mt-28 flex flex-col gap-3.5 md:gap-6">
      <h2 className={`m-0 flex flex-wrap items-baseline gap-x-2.5 text-lg md:text-xl font-extrabold text-ink ${hideTitleMd ? "sr-only" : ""}`}>
        {title}
        {note && <span className="text-[13px] font-bold text-muted">{note}</span>}
      </h2>
      {children}
    </section>
  );
}

function Segmented<T extends string>({ label, value, onChange, options }: {
  label: string; value: T; onChange: (v: T) => void; options: [T, string][];
}) {
  return (
    <div role="group" aria-label={label} className="grid grid-flow-col gap-1 p-1 rounded-[14px] bg-sand w-full sm:w-auto">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={`press min-h-[40px] px-3.5 rounded-[11px] text-[13px] whitespace-nowrap ${
            value === v ? "bg-white text-forest font-extrabold shadow-card" : "text-muted font-bold"
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

// Headline figures: one white panel (2×2 on the phone, a row on desktop); `flat` tiles go inside cards
function Tiles({ items, flat = false }: { items: { label: string; value: ReactNode; sub?: ReactNode }[]; flat?: boolean }) {
  const grid = (
    <div className={`relative grid grid-cols-2 gap-2.5 ${flat ? "md:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] md:gap-3" : "gap-0 md:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]"}`}>
      {items.map((t, i) => (
        <div
          key={t.label}
          className={`${flat ? "bg-cream rounded-[20px] px-4 py-3.5" : `px-4 py-3.5 md:px-7 md:py-0 ${i % 2 === 1 ? "border-l border-line" : ""} ${i >= 2 ? "border-t md:border-t-0 border-line" : ""} ${i > 0 && i % 2 === 0 ? "md:border-l" : ""}`} flex flex-col gap-1 md:gap-0 min-w-0`}
        >
          <div className={`text-[13px] font-bold ${flat ? "text-muted" : "text-muted md:text-[14px] md:text-ink"}`}>{t.label}</div>
          <div className={`font-extrabold text-[26px] leading-none tabular-nums text-ink ${flat ? "md:text-[30px]" : "md:text-[32px] md:mt-3.5 md:mb-3"}`}>{t.value}</div>
          {t.sub && <div className={`text-xs text-muted ${flat ? "" : "md:text-[13px]"}`}>{t.sub}</div>}
        </div>
      ))}
    </div>
  );
  if (flat) return grid;
  return (
    <div className="relative overflow-hidden bg-white rounded-[18px] shadow-panel md:py-6">
      {grid}
    </div>
  );
}

// Bars on one scale; value above each bar, label below
function BarChart({ values, labels, avg, highlight, showValues = true, title }: {
  values: number[]; labels: string[]; avg?: number; highlight?: number; showValues?: boolean; title: string;
}) {
  const W = 640, H = 140;
  const n = Math.max(1, values.length);
  const bw = W / n;
  const mx = Math.max(1, ...values);
  const y = (v: number) => H - (v / mx) * (H - 18);
  return (
    <svg viewBox={`0 0 ${W} ${H + 22}`} className="w-full h-auto block" role="img" aria-label={title}>
      {values.map((v, i) => (
        <g key={i}>
          <rect x={i * bw + bw * 0.15} y={y(v)} width={bw * 0.7} height={H - y(v)} rx={3} className={i === highlight ? "fill-juzprogress" : "fill-juzdone"}>
            <title>{`${labels[i]}: ${v}`}</title>
          </rect>
          {showValues && v > 0 && n <= 20 && (
            <text x={i * bw + bw / 2} y={y(v) - 4} fontSize={11} fontWeight={800} textAnchor="middle" className="fill-ink">{v}</text>
          )}
          {labels[i] && (
            <text x={i * bw + bw / 2} y={H + 16} fontSize={11} textAnchor="middle" className="fill-muted">{labels[i]}</text>
          )}
        </g>
      ))}
      {avg !== undefined && avg > 0 && (
        <>
          <line x1={0} x2={W} y1={y(avg)} y2={y(avg)} strokeDasharray="5 4" strokeWidth={1.5} className="stroke-juzprogress" />
          <text x={W - 2} y={y(avg) - 5} fontSize={10} fontWeight={800} textAnchor="end" className="fill-juzprogress">orta {dec(avg)}</text>
        </>
      )}
    </svg>
  );
}

// Day labels: only some, so they do not crowd on a phone
const dayLabels = (days: string[]) => {
  const step = Math.ceil(days.length / 12);
  return days.map((d, i) => (i % step === 0 || i === days.length - 1 ? String(Number(d.slice(8))) : ""));
};
const monthLabel = (m: string) => MONTHS_SHORT[Number(m.slice(5, 7)) - 1];

function GroupSection({ ctx, summaries, distributions, holderName }: {
  ctx: Ctx; summaries: ReturnType<typeof khatmSummaries>; distributions: number; holderName?: (uid: string) => string;
}) {
  const { assignments, today, khatm, period } = ctx;
  const doneDurations = summaries
    .filter((k) => k.startedAt && k.completedAt)
    .map((k) => dayDiff(bakuDay(k.startedAt!), bakuDay(k.completedAt!)) + 1);
  const pastAvg = doneDurations.length ? Math.round(doneDurations.reduce((s, d) => s + d, 0) / doneDurations.length) : null;

  if (period === "cur") {
    const s = summaries.find((k) => k.khatm === khatm);
    const pages = s?.pagesRead || 0;
    const start = s?.startedAt ? bakuDay(s.startedAt) : today;
    const elapsed = Math.max(1, dayDiff(start, today) + 1);
    const perDay = pages / elapsed;
    const from = dayDiff(start, today) > 30 ? bakuDay(new Date(Date.parse(`${today}T12:00:00Z`) - 30 * 86400000)) : start;
    const daily = dailyPages(assignments.filter((a) => a.khatm === khatm), from, today);
    const left = (s?.totalPages || 604) - pages;
    return (
      <>
        <Tiles items={[
          { label: "Səhifə", value: pages, sub: `/ ${s?.totalPages || 604} · ${pct(pages / (s?.totalPages || 604))}` },
          { label: "Cüz bitib", value: s?.done || 0, sub: `/ 30 · ${s?.assigned || 0} paylanıb` },
          { label: "Gün", value: elapsed, sub: `${formatIsoDateAz(start)}-dən bəri` },
          { label: "Gündə orta", value: dec(perDay), sub: "səhifə" },
        ]} />
        <div className="flex flex-wrap gap-5 md:gap-7 items-start">
          <div className="flex-[1_1_380px] min-w-0">
            <Card>
              <h3 className="m-0 text-base font-bold text-ink">{khatmLabel(khatm)} · {s?.completedAt ? "tamamlanıb" : "davam edir"}</h3>
              <JuzMap tiles={khatmJuzTiles(assignments, khatm)} holderName={holderName} />
              {!s?.completedAt && perDay > 0 && (
                <p className="m-0 text-[13px] text-muted leading-relaxed">
                  Bu sürətlə xətm təxminən <strong className="text-ink">{Math.ceil(left / perDay)} günə</strong> bitər.
                  {pastAvg !== null && ` Əvvəlki xətmlər orta hesabla ${pastAvg} günə bitib.`}
                </p>
              )}
            </Card>
          </div>
          <div className="flex-[1_1_380px] min-w-0">
            <Card>
              <h3 className="m-0 text-base font-bold text-ink">Səhifələr · gündəlik</h3>
              <p className="m-0 -mt-1.5 text-[13px] text-muted">Qrupun hər gün oxuduğu səhifələr{from !== start ? " (son 31 gün)" : ""}</p>
              <BarChart title="Gündəlik səhifələr" values={daily.map((d) => d.pages)} labels={dayLabels(daily.map((d) => d.day))} avg={perDay} />
            </Card>
          </div>
        </div>
      </>
    );
  }

  const totalPages = summaries.reduce((s, k) => s + k.pagesRead, 0);
  const totalJuz = summaries.reduce((s, k) => s + k.done, 0);
  const completed = summaries.filter((k) => k.completedAt).length;
  const durations = summaries.map((k) => ({
    khatm: k.khatm,
    done: !!k.completedAt,
    start: k.startedAt ? bakuDay(k.startedAt) : today,
    end: k.completedAt ? bakuDay(k.completedAt) : null,
  })).map((k) => ({ ...k, days: dayDiff(k.start, k.end || today) + 1 }));
  const maxDays = Math.max(1, ...durations.map((d) => d.days));
  const juzDays = juzAvgDays(assignments);
  const known = juzDays.map((d, i) => ({ d, i })).filter((x) => x.d !== null) as { d: number; i: number }[];
  const slow = known.length ? known.reduce((a, b) => (b.d > a.d ? b : a)) : null;
  const fast = known.length ? known.reduce((a, b) => (b.d < a.d ? b : a)) : null;
  const monthly = monthlyPages(assignments, today);
  const allOnTime = ctx.groupAvg.onTime;

  return (
    <>
      <Tiles items={[
        { label: "Səhifə", value: totalPages, sub: `${summaries.length} xətmdə` },
        { label: "Cüz", value: totalJuz, sub: "bitirilib" },
        { label: "Xətm", value: completed, sub: "tamamlanıb" },
        { label: "Bölgü", value: distributions, sub: "cüz bölgüsü" },
        { label: "Vaxtında bitirmə", value: allOnTime === null ? "—" : pct(allOnTime), sub: "iştirakçıların ortası" },
      ]} />
      <div className="flex flex-wrap gap-5 md:gap-7 items-start">
        <div className="flex-[1_1_380px] min-w-0">
          <Card>
            <div className="flex items-center justify-between gap-3">
              <h3 className="m-0 text-base font-bold text-ink">Xətmlər · {summaries.length}</h3>
              <div className="text-right leading-tight">
                <div className="font-extrabold text-2xl tabular-nums text-ink">{completed}</div>
                <div className="text-xs text-muted">tamamlanıb</div>
              </div>
            </div>
            <div className="grid grid-cols-[minmax(72px,auto)_1fr_auto] gap-x-3 gap-y-2.5 items-center text-[13px]">
              {[...durations].reverse().map((k) => (
                <div key={k.khatm} className="contents">
                  <span className="font-bold text-ink whitespace-nowrap">{khatmLabel(k.khatm)}</span>
                  <div className="h-3 rounded-full bg-track overflow-hidden">
                    <div className={`h-full rounded-full ${k.done ? "bg-juzdone" : "bg-juzprogress"}`} style={{ width: `${(k.days / maxDays) * 100}%` }} />
                  </div>
                  <span className="font-extrabold tabular-nums text-ink text-right">{k.days} gün</span>
                </div>
              ))}
            </div>
            <p className="m-0 text-xs text-muted leading-relaxed">
              {[...durations].reverse().map((k) => `${ordinalAz(k.khatm)}: ${formatIsoDateAz(k.start)} – ${k.end ? formatIsoDateAz(k.end) : "davam edir"}`).join(" · ")}
            </p>
          </Card>
        </div>
        <div className="flex-[1_1_380px] min-w-0">
          <Card>
            <h3 className="m-0 text-base font-bold text-ink">Cüzlər · orta oxunma müddəti</h3>
            <p className="m-0 -mt-1.5 text-[13px] text-muted">Hər cüzün verildiyi gündən bitənə qədər keçən orta gün</p>
            {known.length === 0 ? (
              <p className="m-0 text-sm text-muted">Hələ bitmiş cüz yoxdur.</p>
            ) : (
              <>
                <BarChart
                  title="Cüzlərin orta oxunma müddəti"
                  values={juzDays.map((d) => (d === null ? 0 : Math.round(d * 10) / 10))}
                  labels={juzDays.map((_, i) => (i === 0 || (i + 1) % 5 === 0 ? String(i + 1) : ""))}
                  highlight={slow?.i}
                  showValues={false}
                />
                {slow && fast && (
                  <p className="m-0 text-xs text-muted">
                    Ən uzun: Cüz {slow.i + 1} ({dec(slow.d)} gün). Ən tez: Cüz {fast.i + 1} ({dec(fast.d)} gün).
                  </p>
                )}
              </>
            )}
          </Card>
        </div>
      </div>
      <Card>
        <h3 className="m-0 text-base font-bold text-ink">Səhifələr · aylıq</h3>
        <BarChart title="Aylıq səhifələr" values={monthly.map((m) => m.pages)} labels={monthly.map((m) => monthLabel(m.month))} />
      </Card>
    </>
  );
}

function CatChip({ perf }: { perf: Perf }) {
  return <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${CAT[perf.cat].chip}`}>{CAT[perf.cat].label}</span>;
}

function Compare({ label, mine, group, format, lowerIsBetter = false, selfLabel }: {
  label: string; mine: number; group: number; format: (x: number) => string; lowerIsBetter?: boolean; selfLabel: string;
}) {
  const mx = Math.max(mine, group) || 1;
  const better = lowerIsBetter ? mine <= group : mine >= group;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between gap-2 text-[13px]">
        <span className="text-ink">{label}</span>
        <strong className={better ? "text-juzdone" : "text-danger"}>{better ? "ortadan yaxşı" : "ortadan aşağı"}</strong>
      </div>
      <div className="grid grid-cols-[48px_1fr_52px] gap-x-2 gap-y-1 items-center text-xs text-muted">
        <span>{selfLabel}</span>
        <div className="h-2.5 rounded-full bg-track overflow-hidden">
          <div className={`h-full rounded-full ${better ? "bg-juzdone" : "bg-juzprogress"}`} style={{ width: `${(mine / mx) * 100}%` }} />
        </div>
        <strong className="text-ink text-right tabular-nums">{format(mine)}</strong>
        <span>Qrup</span>
        <div className="h-2.5 rounded-full bg-track overflow-hidden">
          <div className="h-full rounded-full bg-field" style={{ width: `${(group / mx) * 100}%` }} />
        </div>
        <span className="text-right tabular-nums">{format(group)}</span>
      </div>
    </div>
  );
}

function Performance({ ctx, uid, all, self = false }: { ctx: Ctx; uid: string; all: PersonAllTime; self?: boolean }) {
  const place = ctx.ranked.findIndex((r) => r.uid === uid) + 1;
  const perf = ctx.ranked.find((r) => r.uid === uid)?.perf;
  const selfLabel = self ? "Sən" : "Şəxs";
  const mineCur = memberStats(ctx.assignments, uid).perKhatm.find((k) => k.khatm === ctx.khatm)?.pagesRead || 0;
  const g = ctx.groupAvg;
  return (
    <div className="flex flex-col gap-4">
      <Tiles flat items={[
        { label: "Qrupda yeri", value: <>{place}<span className="text-base text-muted"> / {ctx.ranked.length}</span></> },
        { label: "Performans", value: perf ? <CatChip perf={perf} /> : "—", sub: perf?.why },
      ]} />
      <div className="flex flex-col gap-3.5">
        {ctx.period === "cur" ? (
          <Compare label={`Oxunan səhifə (${khatmLabel(ctx.khatm)})`} mine={mineCur} group={g.pagesCur} format={(x) => String(Math.round(x))} selfLabel={selfLabel} />
        ) : (
          <>
            <Compare label="Oxunan səhifə (bütün dövr)" mine={all.pages} group={g.pagesAll} format={(x) => String(Math.round(x))} selfLabel={selfLabel} />
            {all.onTime !== null && g.onTime !== null && (
              <Compare label="Vaxtında bitirdiyi cüzlər" mine={all.onTime} group={g.onTime} format={pct} selfLabel={selfLabel} />
            )}
            {all.avgDays !== null && g.avgDays !== null && (
              <Compare label="Bir cüzə orta gün" mine={all.avgDays} group={g.avgDays} format={dec} lowerIsBetter selfLabel={selfLabel} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Personal({ ctx, uid, all }: { ctx: Ctx; uid: string; all: PersonAllTime }) {
  const { assignments, today, khatm } = ctx;

  if (ctx.period === "cur") {
    const mine = assignments.filter((a) => a.uid === uid && a.khatm === khatm).sort((a, b) => a.juz - b.juz);
    if (mine.length === 0) return <p className="m-0 text-sm text-muted">{khatmLabel(khatm)} üzrə cüz təyin edilməyib.</p>;
    const read = mine.reduce((s, a) => s + a.completedPages.length, 0);
    const total = mine.reduce((s, a) => s + a.pages.length, 0);
    const start = mine.map((a) => a.startDate || bakuDay(a.createdAt)).sort()[0];
    const daily = dailyPages(mine, start, today > start ? today : start, uid);
    return (
      <div className="flex flex-col gap-4">
        {mine.map((a) => {
          const left = a.pages.length - a.completedPages.length;
          const status = a.done ? ["Bitib", "bg-donebg text-donetext"] : a.completedPages.length > 0 ? ["Davam edir", "bg-progress text-progresstext"] : ["Başlamayıb", "bg-[#FBEFEB] text-danger"];
          return (
            <div key={a.id} className="flex flex-col gap-2">
              {!a.done && a.endDate === today && (
                <div role="alert" className="rounded-btn bg-[#FBEFEB] border border-dangerline px-3.5 py-2.5 text-sm font-bold text-danger">Bu gün son gündür: {left} səhifə qalıb.</div>
              )}
              {!a.done && a.endDate && a.endDate < today && (
                <div role="alert" className="rounded-btn bg-[#FBEFEB] border border-dangerline px-3.5 py-2.5 text-sm font-bold text-danger">Müddət {formatIsoDateAz(a.endDate)} tarixində bitib: {left} səhifə qalıb.</div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-[15px] text-ink">Cüz {a.juz}</strong>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${status[1]}`}>{status[0]}</span>
                {a.startDate && a.endDate && <span className="text-xs text-muted">{formatIsoDateAz(a.startDate)} – {formatIsoDateAz(a.endDate)}</span>}
              </div>
              <Bar ratio={a.completedPages.length / a.pages.length} color={a.done ? "done" : "accent"} height={12} label={`Cüz ${a.juz}`} />
              <div className="text-xs text-muted">{a.completedPages.length} / {a.pages.length} səhifə · səhifə {Math.min(...a.pages)}–{Math.max(...a.pages)}</div>
            </div>
          );
        })}
        <Tiles flat items={[
          { label: "Oxunan səhifə", value: read, sub: `/ ${total}` },
          { label: "Bitən cüz", value: mine.filter((a) => a.done).length, sub: `/ ${mine.length} cüz` },
          { label: "Qalan", value: total - read, sub: "səhifə" },
        ]} />
        <div className="flex flex-col gap-1.5">
          <div className="text-xs font-bold text-muted">Gündəlik oxuduğu səhifələr</div>
          <BarChart title="Gündəlik səhifələr" values={daily.map((d) => d.pages)} labels={dayLabels(daily.map((d) => d.day))} />
        </div>
      </div>
    );
  }

  const khatms = Array.from(new Set(assignments.filter((a) => a.uid === uid).map((a) => a.khatm))).sort((a, b) => a - b);
  const monthly = monthlyPages(assignments, today, 12, uid);
  return (
    <div className="flex flex-col gap-4">
      <Tiles flat items={[
        { label: "Səhifə", value: all.pages },
        { label: "Cüz", value: all.juz },
        { label: "Xətm payı", value: dec(all.juz / 30), sub: `${all.juz} / 30 cüz${all.personalKhatms > 0 ? ` · ${all.personalKhatms} şəxsi xətm` : ""}` },
        { label: "Vaxtında", value: all.onTime === null ? "—" : pct(all.onTime), sub: "bitirdiyi cüzlərin" },
      ]} />
      {khatms.length === 0 ? (
        <p className="m-0 text-sm text-muted">Hələ cüz təyin edilməyib.</p>
      ) : (
        <JuzByMonth assignments={assignments} uid={uid} today={today} finished={all.finished} />
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-juzdone" />Vaxtında bitib</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-progress border border-juzassignedline" />Gecikib</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-juzprogress" />Davam edir</span>
        <span className="inline-flex items-center gap-1.5"><span className="font-extrabold text-ink">→</span>Növbəti aya keçib</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="text-xs font-bold text-muted">Aylıq oxuduğu səhifələr</div>
        <BarChart title="Aylıq səhifələr" values={monthly.map((m) => m.pages)} labels={monthly.map((m) => monthLabel(m.month))} />
      </div>
    </div>
  );
}

function AdminList({ ctx, rows, nameOf, viewerUid, filter, onFilter, open, onOpen }: {
  ctx: Ctx;
  rows: { user: UserDoc; all: PersonAllTime; perf: Perf }[];
  nameOf: (u: UserDoc) => string;
  viewerUid: string;
  filter: PerfCat | "all";
  onFilter: (f: PerfCat | "all") => void;
  open: string | null;
  onOpen: (uid: string) => void;
}) {
  const counts: Record<PerfCat, number> = { strong: 0, mid: 0, weak: 0, none: 0 };
  rows.forEach((r) => counts[r.perf.cat]++);
  const shown = rows.filter((r) => filter === "all" || r.perf.cat === filter);
  const filters: [PerfCat | "all", string][] = [
    ["all", `Hamısı · ${rows.length}`],
    ["strong", `Güclü · ${counts.strong}`],
    ["mid", `Orta · ${counts.mid}`],
    ["weak", `Zəif · ${counts.weak}`],
    ...(counts.none > 0 ? [["none", `Məlumat yoxdur · ${counts.none}`] as [PerfCat, string]] : []),
  ];

  return (
    <Card className="!gap-3">
      {rows.length > 0 && (
        <div className="flex h-[26px] rounded-[10px] overflow-hidden" role="img" aria-label="Performans paylanması">
          {(["strong", "mid", "weak", "none"] as PerfCat[]).filter((k) => counts[k] > 0).map((k) => (
            <span
              key={k}
              className={`flex items-center justify-center text-xs font-extrabold ${CAT[k].bar} ${k === "strong" || k === "weak" ? "text-white" : "text-ink"}`}
              style={{ width: `${(counts[k] / rows.length) * 100}%` }}
            >
              {counts[k]}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {filters.map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={filter === k}
            onClick={() => onFilter(k)}
            className={`press min-h-[40px] px-3.5 rounded-xl text-[13px] font-bold border ${
              filter === k ? "border-forest bg-mint text-forest" : "border-line bg-white text-muted hover:bg-sand"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="m-0 text-sm text-muted py-3">Bu bölmədə iştirakçı yoxdur.</p>
      ) : (
        <div className="flex flex-col">
          {shown.map(({ user: u, all, perf }) => {
            const rank = rows.findIndex((r) => r.user.uid === u.uid) + 1;
            const expanded = open === u.uid;
            const curOpen = ctx.assignments.filter((a) => a.uid === u.uid && a.khatm === ctx.khatm);
            const meta = ctx.period === "cur"
              ? `${curOpen.length > 0 ? curOpen.map((a) => `Cüz ${a.juz} · ${a.completedPages.length}/${a.pages.length}`).join(", ") + " · " : ""}${perf.why}`
              : `${all.pages} səhifə · ${all.juz} cüz · ${perf.why}`;
            return (
              <div key={u.uid} className="border-t border-sand">
                <button
                  type="button"
                  onClick={() => onOpen(u.uid)}
                  aria-expanded={expanded}
                  className="w-full grid grid-cols-[22px_40px_minmax(0,1fr)_auto] gap-2.5 items-center text-left py-3 px-1 rounded-xl hover:bg-cream"
                >
                  <span className="text-sm font-bold text-muted text-center">{rank}</span>
                  <Avatar name={nameOf(u)} gold={u.uid !== viewerUid} />
                  <span className="min-w-0">
                    <span className="block text-[15px] font-bold text-ink truncate">
                      {nameOf(u)} {u.uid === viewerUid && <span className="font-medium text-muted">(sən)</span>}
                    </span>
                    <span className="block text-xs text-muted">{meta}</span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <CatChip perf={perf} />
                    <span className="text-xs font-bold text-muted">{expanded ? "Bağla ▲" : "Detallı ▼"}</span>
                  </span>
                </button>
                {expanded && (
                  <div className="flex flex-col gap-5 pb-5 pt-1 md:pl-[72px]">
                    <Performance ctx={ctx} uid={u.uid} all={all} />
                    <div className="h-px bg-sand" />
                    <Personal ctx={ctx} uid={u.uid} all={all} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="m-0 text-xs text-muted leading-relaxed">
        {ctx.period === "cur"
          ? "Cari xətmdə: cüzünü vaxtında bitirən və ya qrafikdən irəli olan Güclü, bir az geridə olan Orta, xeyli geridə olan və ya müddəti keçən Zəif sayılır."
          : "Bütün dövrdə: bal = 60% vaxtında bitirmə + 40% sürət (qrupun cüz başına orta günü ilə müqayisə). 80%-dən yuxarı Güclü, 55–80% Orta, aşağı Zəif."}
      </p>
    </Card>
  );
}

const MONTHS_AZ = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];
const MONTHS_SHORT_AZ = ["Yan", "Fev", "Mar", "Apr", "May", "İyn", "İyl", "Avq", "Sen", "Okt", "Noy", "Dek"];

// One member's juz, one month at a time: year and month buttons on top (default: this month), then the
// juz that were being read in that month, per khatm. A juz counts for every month between the day it
// was given and the day it was finished (or today, while still open).
function JuzByMonth({ assignments, uid, today, finished }: {
  assignments: Assignment[]; uid: string; today: string; finished: { khatm: number; juz: number; days: number; onTime: boolean }[];
}) {
  const mine = assignments.filter((a) => a.uid === uid);
  const startOf = (a: Assignment) => a.startDate || bakuDay(a.createdAt);
  const endOf = (a: Assignment) => (a.done && a.doneAt ? bakuDay(a.doneAt) : today);
  const firstYear = Number((mine.map(startOf).sort()[0] || today).slice(0, 4));
  const thisYear = Number(today.slice(0, 4));
  const thisMonth = Number(today.slice(5, 7));
  const [year, setYear] = useState(thisYear);
  const [month, setMonth] = useState(thisMonth);
  const years = Array.from({ length: thisYear - firstYear + 1 }, (_, i) => firstYear + i);

  const key = `${year}-${String(month).padStart(2, "0")}`;
  const from = `${key}-01`;
  const to = `${key}-31`;
  const inMonth = mine.filter((a) => startOf(a) <= to && endOf(a) >= from);
  const khatms = Array.from(new Set(inMonth.map((a) => a.khatm))).sort((x, y) => x - y);
  const pagesIn = (list: Assignment[]) => list.reduce((s, a) => s + Object.values(a.completedAt || {}).filter((iso) => bakuDay(iso).slice(0, 7) === key).length, 0);
  const future = (y: number, m: number) => y > thisYear || (y === thisYear && m > thisMonth);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2.5 rounded-[16px] bg-cream p-3">
        <div role="group" aria-label="İl" className="flex flex-wrap gap-1.5">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              aria-pressed={y === year}
              onClick={() => { setYear(y); if (future(y, month)) setMonth(thisMonth); }}
              className={`press min-h-[40px] px-4 rounded-[10px] text-[14px] font-extrabold tabular-nums ${y === year ? "bg-forest text-white" : "bg-white text-ink hover:bg-sand"}`}
            >
              {y}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Ay" className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-1.5">
          {MONTHS_AZ.map((name, i) => {
            const m = i + 1;
            const disabled = future(year, m);
            return (
              <button
                key={name}
                type="button"
                disabled={disabled}
                aria-pressed={m === month}
                onClick={() => setMonth(m)}
                className={`press min-h-[40px] px-1 rounded-[10px] text-[13px] font-bold ${
                  m === month ? "bg-forest text-white" : disabled ? "bg-track text-muted/60 cursor-not-allowed" : "bg-white text-ink hover:bg-sand"
                }`}
              >
                <span aria-hidden="true">{MONTHS_SHORT_AZ[i]}</span>
                <span className="sr-only">{name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="text-[14px] font-bold text-ink">
        {MONTHS_AZ[month - 1]} {year}
        <span className="ml-2 text-[13px] font-semibold text-muted">· {inMonth.filter((a) => a.done && a.doneAt && bakuDay(a.doneAt).slice(0, 7) === key).length} cüz bitib · {pagesIn(inMonth)} səhifə oxunub</span>
      </div>

      {khatms.length === 0 ? (
        <p className="m-0 text-sm text-muted">Bu ayda oxunan cüz yoxdur.</p>
      ) : khatms.map((k) => {
        const list = inMonth.filter((a) => a.khatm === k).sort((x, y) => x.juz - y.juz);
        return (
          <div key={k} className="flex flex-col gap-2">
            <div className="text-xs font-bold text-muted">{khatmLabel(k)} · {pagesIn(list)} səhifə bu ay</div>
            <div className="flex flex-wrap gap-2">
              {list.map((a) => {
                // Finished in this month: green (or "late") with the days it took
                if (a.done && a.doneAt && bakuDay(a.doneAt).slice(0, 7) === key) {
                  const f = finished.find((x) => x.khatm === a.khatm && x.juz === a.juz);
                  const late = f ? !f.onTime : false;
                  return (
                    <JuzBadge key={a.id} size="sm" juz={a.juz} state={late ? "late" : "done"} sub={f ? `${f.days} gün` : "Bitib"} title="Bu ay bitib" label={`Cüz ${a.juz}, bu ay ${f ? `${f.days} günə ` : ""}bitib${late ? ", gecikib" : ", vaxtında"}`} />
                  );
                }
                // Still being read at the end of this month: pages read by then, and an arrow if it went on into the next month
                const readBy = Object.values(a.completedAt || {}).filter((iso) => bakuDay(iso).slice(0, 7) <= key).length;
                const carried = endOf(a).slice(0, 7) > key;
                return (
                  <JuzBadge
                    key={a.id}
                    size="sm"
                    juz={a.juz}
                    state={readBy > 0 ? "progress" : "assigned"}
                    sub={`${readBy}/${a.pages.length}${carried ? " →" : ""}`}
                    title={carried ? "Növbəti aya keçib" : "Davam edir"}
                    label={`Cüz ${a.juz}, ay sonunadək ${readBy} / ${a.pages.length} səhifə${carried ? ", növbəti ayda davam edib" : ", davam edir"}`}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
