// Analytics on top of the juz assignment records: per-day/month pages, how long juz take,
// on-time finishes and the Güclü / Orta / Zəif performance label. Pure functions only.
// Days are Baku calendar days ("YYYY-MM-DD"), the same keys startDate/endDate use.
import { memberStats, type Assignment } from "./khatm.ts";

export function bakuDay(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-CA", { timeZone: "Asia/Baku" });
}

// b - a in whole days
export function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

export function addDays(key: string, n: number): string {
  return new Date(Date.parse(`${key}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
}

const startOf = (a: Assignment) => a.startDate || bakuDay(a.createdAt);

export interface FinishedJuz {
  khatm: number;
  juz: number;
  days: number;     // from the day it was given to the day it was finished, inclusive
  onTime: boolean;  // finished on or before its end date
}

export function finishedJuzOf(assignments: Assignment[], uid: string): FinishedJuz[] {
  return assignments
    .filter((a) => a.uid === uid && a.done)
    .map((a) => {
      const doneDay = bakuDay(a.doneAt || a.createdAt);
      return {
        khatm: a.khatm,
        juz: a.juz,
        days: Math.max(1, dayDiff(startOf(a), doneDay) + 1),
        onTime: !a.endDate || doneDay <= a.endDate,
      };
    })
    .sort((x, y) => x.khatm - y.khatm || x.juz - y.juz);
}

export interface PersonAllTime {
  pages: number;
  juz: number;
  personalKhatms: number;
  finished: FinishedJuz[];
  overdue: number;          // unfinished juz whose end date has passed
  avgDays: number | null;   // per finished juz
  onTime: number | null;    // share of finished-on-time among finished + overdue juz
}

export function personAllTime(assignments: Assignment[], uid: string, today: string): PersonAllTime {
  const stats = memberStats(assignments, uid);
  const finished = finishedJuzOf(assignments, uid);
  const overdue = assignments.filter((a) => a.uid === uid && !a.done && !!a.endDate && a.endDate < today).length;
  const measured = finished.length + overdue;
  return {
    pages: stats.pagesRead,
    juz: stats.juzDone.length,
    personalKhatms: stats.personalKhatms,
    finished,
    overdue,
    avgDays: finished.length ? finished.reduce((s, f) => s + f.days, 0) / finished.length : null,
    onTime: measured ? finished.filter((f) => f.onTime).length / measured : null,
  };
}

export type PerfCat = "strong" | "mid" | "weak" | "none";
export interface Perf {
  score: number; // 0..1, -1 when there is nothing to judge
  cat: PerfCat;
  why: string;
}

const NONE = (why: string): Perf => ({ score: -1, cat: "none", why });
const dateAz = (key: string) => key.split("-").reverse().join(".");

// Current khatm: how far the member is against the time that has passed in their reading window
export function perfCurrent(assignments: Assignment[], uid: string, khatm: number, today: string): Perf {
  const mine = assignments.filter((a) => a.uid === uid && a.khatm === khatm);
  if (mine.length === 0) return NONE("Bu xətmdə cüzü yoxdur");
  const open = mine.filter((a) => !a.done);
  if (open.length === 0) {
    const late = mine.some((a) => a.endDate && a.doneAt && bakuDay(a.doneAt) > a.endDate);
    return late ? { score: 0.7, cat: "mid", why: "Cüzünü gecikmə ilə bitirib" } : { score: 1, cat: "strong", why: "Cüzünü vaxtında bitirib" };
  }
  const total = open.reduce((s, a) => s + a.pages.length, 0);
  const read = open.reduce((s, a) => s + a.completedPages.length, 0);
  const left = total - read;
  const ratio = total ? read / total : 0;
  const ends = open.map((a) => a.endDate).filter(Boolean).sort();
  const end = ends[0];
  if (!end) return ratio > 0 ? { score: 0.6, cat: "mid", why: "Davam edir" } : { score: 0.3, cat: "weak", why: "Hələ başlamayıb" };
  if (end < today) return { score: ratio * 0.4, cat: "weak", why: `Müddət ${dateAz(end)} bitib, ${left} səhifə qalıb` };
  const start = open.map(startOf).sort()[0];
  const windowDays = Math.max(1, dayDiff(start, end) + 1);
  const expected = Math.min(1, Math.max(1, dayDiff(start, today) + 1) / windowDays);
  const s = ratio / expected;
  if (s >= 0.9) return { score: Math.min(1, s), cat: "strong", why: "Qrafikdən irəlidədir" };
  const lastDay = end === today ? `Bu gün son gündür, ${left} səhifə qalıb` : "";
  if (s >= 0.5) return { score: s, cat: "mid", why: lastDay || "Qrafikdən bir az geridədir" };
  return { score: s, cat: "weak", why: lastDay || (read === 0 ? "Hələ başlamayıb" : "Qrafikdən xeyli geridədir") };
}

// All time: 60% on-time finishes + 40% speed against the group's average days per juz
export function perfAllTime(p: PersonAllTime, groupAvgDays: number | null): Perf {
  if (p.onTime === null) return NONE("Hələ bitmiş cüzü yoxdur");
  const speed = p.avgDays === null ? 0 : groupAvgDays ? Math.min(1, groupAvgDays / p.avgDays) : 1;
  const score = 0.6 * p.onTime + 0.4 * speed;
  const days = p.avgDays === null ? "" : ` · cüz başına ${p.avgDays.toFixed(1).replace(".", ",")} gün`;
  return {
    score,
    cat: score >= 0.8 ? "strong" : score >= 0.55 ? "mid" : "weak",
    why: `${Math.round(p.onTime * 100)}% vaxtında${days}`,
  };
}

// Pages marked per Baku day between two days (inclusive); with uid, only that holder's juz
export function dailyPages(assignments: Assignment[], from: string, to: string, uid?: string): { day: string; pages: number }[] {
  const n = Math.max(0, dayDiff(from, to)) + 1;
  const days = Array.from({ length: n }, (_, i) => ({ day: addDays(from, i), pages: 0 }));
  assignments.forEach((a) => {
    if (uid && a.uid !== uid) return;
    Object.values(a.completedAt || {}).forEach((iso) => {
      const i = dayDiff(from, bakuDay(iso));
      if (i >= 0 && i < n) days[i].pages += 1;
    });
  });
  return days;
}

// Pages per calendar month (Baku), from the first month with activity up to this month, at most `max` months
export function monthlyPages(assignments: Assignment[], today: string, max = 12, uid?: string): { month: string; pages: number }[] {
  const counts = new Map<string, number>();
  assignments.forEach((a) => {
    if (uid && a.uid !== uid) return;
    Object.values(a.completedAt || {}).forEach((iso) => {
      const m = bakuDay(iso).slice(0, 7);
      counts.set(m, (counts.get(m) || 0) + 1);
    });
  });
  const months: string[] = [];
  let y = Number(today.slice(0, 4));
  let m = Number(today.slice(5, 7));
  const first = Array.from(counts.keys()).sort()[0] || today.slice(0, 7);
  for (let i = 0; i < max; i++) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    months.unshift(key);
    if (key <= first) break;
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
  }
  return months.map((month) => ({ month, pages: counts.get(month) || 0 }));
}

// Average days a finished juz took, per juz number (index 0 = juz 1); null if never finished
export function juzAvgDays(assignments: Assignment[]): (number | null)[] {
  const sums = Array.from({ length: 30 }, () => ({ s: 0, n: 0 }));
  assignments.filter((a) => a.done).forEach((a) => {
    const days = Math.max(1, dayDiff(startOf(a), bakuDay(a.doneAt || a.createdAt)) + 1);
    sums[a.juz - 1].s += days;
    sums[a.juz - 1].n += 1;
  });
  return sums.map(({ s, n }) => (n ? s / n : null));
}
