// Khatm bookkeeping on top of per-juz assignment records (groups/{gid}/assignments).
// Pure functions only, so the distribution and the statistics can be unit tested.
import { juzPages } from "./quran.ts";

export interface PreviousHolder {
  uid: string;
  pagesRead: number;
}

export interface Assignment {
  id: string;
  uid: string;              // current holder
  khatm: number;            // 1, 2, 3 ...
  juz: number;              // 1..30
  distribution: number;     // which distribution round created it
  pages: number[];          // pages of the juz
  completedPages: number[];
  completedAt: Record<string, string>; // page -> ISO time
  done: boolean;
  doneAt: string | null;
  startDate: string;        // YYYY-MM-DD
  endDate: string;
  createdAt: string;        // ISO
  previousHolders?: PreviousHolder[]; // set when the owner transfers the juz
}

export const JUZ_COUNT = 30;

// A member who still has this many unfinished juz is skipped by the next distribution
export const MAX_OPEN_ASSIGNMENTS = 2;

export type Rng = () => number;

function randomPick<T>(items: T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

export function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Juz numbers already handed out, per khatm
export function assignedJuzByKhatm(assignments: Assignment[]): Map<number, Set<number>> {
  const map = new Map<number, Set<number>>();
  assignments.forEach((a) => {
    if (!map.has(a.khatm)) map.set(a.khatm, new Set());
    map.get(a.khatm)!.add(a.juz);
  });
  return map;
}

// The khatm that is still being handed out (lowest khatm with an unassigned juz) and its free juz
export function openKhatmForAssignment(assignments: Assignment[]): { khatm: number; free: number[] } {
  const byKhatm = assignedJuzByKhatm(assignments);
  for (let k = 1; ; k++) {
    const taken = byKhatm.get(k) || new Set<number>();
    const free = Array.from({ length: JUZ_COUNT }, (_, i) => i + 1).filter((j) => !taken.has(j));
    if (free.length > 0) return { khatm: k, free };
  }
}

export function openAssignmentsOf(assignments: Assignment[], uid: string): Assignment[] {
  return assignments
    .filter((a) => a.uid === uid && !a.done)
    .sort((a, b) => a.distribution - b.distribution || a.khatm - b.khatm || a.juz - b.juz);
}

// Members allowed into the next distribution: fewer than MAX_OPEN_ASSIGNMENTS unfinished juz
export function eligibleMembers(memberUids: string[], assignments: Assignment[]): { eligible: string[]; skipped: string[] } {
  const eligible: string[] = [];
  const skipped: string[] = [];
  memberUids.forEach((uid) => {
    (openAssignmentsOf(assignments, uid).length >= MAX_OPEN_ASSIGNMENTS ? skipped : eligible).push(uid);
  });
  return { eligible, skipped };
}

export interface PlannedAssignment {
  uid: string;
  khatm: number;
  juz: number;
}

// One juz per eligible member, in random order. Juz are taken from the khatm that is still being
// handed out and continue into the next khatm when it runs out. Each member preferably gets a juz
// number they have never had before, so nobody can predict their next juz and members gradually
// cover all 30 juz themselves.
export function planDistribution(eligibleUids: string[], assignments: Assignment[], rng: Rng = Math.random): PlannedAssignment[] {
  const history = new Map<string, Set<number>>();
  assignments.forEach((a) => {
    if (!history.has(a.uid)) history.set(a.uid, new Set());
    history.get(a.uid)!.add(a.juz);
    (a.previousHolders || []).forEach((h) => {
      if (!history.has(h.uid)) history.set(h.uid, new Set());
      history.get(h.uid)!.add(a.juz);
    });
  });

  const start = openKhatmForAssignment(assignments);
  let khatm = start.khatm;
  let pool = [...start.free];
  const plan: PlannedAssignment[] = [];

  for (const uid of shuffle(eligibleUids, rng)) {
    if (pool.length === 0) {
      khatm += 1;
      pool = Array.from({ length: JUZ_COUNT }, (_, i) => i + 1);
    }
    const seen = history.get(uid) || new Set<number>();
    const fresh = pool.filter((j) => !seen.has(j));
    const juz = randomPick(fresh.length > 0 ? fresh : pool, rng);
    pool = pool.filter((j) => j !== juz);
    plan.push({ uid, khatm, juz });
  }
  return plan;
}

export function newAssignmentData(
  p: PlannedAssignment,
  distribution: number,
  startDate: string,
  endDate: string,
  now: string
): Omit<Assignment, "id"> {
  return {
    uid: p.uid,
    khatm: p.khatm,
    juz: p.juz,
    distribution,
    pages: juzPages(p.juz),
    completedPages: [],
    completedAt: {},
    done: false,
    doneAt: null,
    startDate,
    endDate,
    createdAt: now,
  };
}

// ---------- statistics ----------

export interface KhatmSummary {
  khatm: number;
  assigned: number;       // juz handed out
  done: number;           // juz fully read
  pagesRead: number;
  totalPages: number;
  unassigned: number[];
  startedAt: string | null;
  completedAt: string | null; // when the 30th juz was finished
}

export function khatmSummaries(assignments: Assignment[]): KhatmSummary[] {
  const khatms = Array.from(new Set(assignments.map((a) => a.khatm))).sort((a, b) => a - b);
  return khatms.map((k) => {
    const list = assignments.filter((a) => a.khatm === k);
    const assignedJuz = new Set(list.map((a) => a.juz));
    const doneList = list.filter((a) => a.done);
    const doneJuz = new Set(doneList.map((a) => a.juz));
    const complete = doneJuz.size === JUZ_COUNT;
    const totalPages = Array.from({ length: JUZ_COUNT }, (_, i) => juzPages(i + 1).length).reduce((s, n) => s + n, 0);
    return {
      khatm: k,
      assigned: assignedJuz.size,
      done: doneJuz.size,
      pagesRead: list.reduce((s, a) => s + a.completedPages.length, 0),
      totalPages,
      unassigned: Array.from({ length: JUZ_COUNT }, (_, i) => i + 1).filter((j) => !assignedJuz.has(j)),
      startedAt: list.map((a) => a.createdAt).sort()[0] || null,
      completedAt: complete ? doneList.map((a) => a.doneAt || "").sort().pop() || null : null,
    };
  });
}

// Pages read by uid in this assignment (handles juz transferred between members)
export function pagesReadBy(a: Assignment, uid: string): number {
  const handedOver = (a.previousHolders || []).reduce((s, h) => s + h.pagesRead, 0);
  const own = a.uid === uid ? Math.max(0, a.completedPages.length - handedOver) : 0;
  const earlier = (a.previousHolders || []).filter((h) => h.uid === uid).reduce((s, h) => s + h.pagesRead, 0);
  return own + earlier;
}

export interface MemberKhatmShare {
  khatm: number;
  juz: number[];      // juz this member holds in that khatm
  juzDone: number;
  pagesRead: number;
}

export interface MemberStats {
  uid: string;
  pagesRead: number;
  juzDone: { khatm: number; juz: number; doneAt: string | null }[];
  // A personal khatm = the member alone has finished every juz 1..30 once (across khatms)
  personalKhatms: number;
  missingForNextPersonalKhatm: number[];
  open: number;
  perKhatm: MemberKhatmShare[];
}

export function memberStats(assignments: Assignment[], uid: string): MemberStats {
  const involved = assignments.filter((a) => a.uid === uid || (a.previousHolders || []).some((h) => h.uid === uid));
  const finished = assignments.filter((a) => a.uid === uid && a.done);
  const counts = new Map<number, number>();
  finished.forEach((a) => counts.set(a.juz, (counts.get(a.juz) || 0) + 1));
  const personalKhatms = Math.min(...Array.from({ length: JUZ_COUNT }, (_, i) => counts.get(i + 1) || 0));
  const missing = Array.from({ length: JUZ_COUNT }, (_, i) => i + 1).filter((j) => (counts.get(j) || 0) <= personalKhatms);

  const khatms = Array.from(new Set(involved.map((a) => a.khatm))).sort((a, b) => a - b);
  return {
    uid,
    pagesRead: involved.reduce((s, a) => s + pagesReadBy(a, uid), 0),
    juzDone: finished
      .map((a) => ({ khatm: a.khatm, juz: a.juz, doneAt: a.doneAt }))
      .sort((x, y) => (x.doneAt || "").localeCompare(y.doneAt || "")),
    personalKhatms,
    missingForNextPersonalKhatm: missing,
    open: assignments.filter((a) => a.uid === uid && !a.done).length,
    perKhatm: khatms.map((k) => {
      const mine = involved.filter((a) => a.khatm === k);
      return {
        khatm: k,
        juz: mine.filter((a) => a.uid === uid).map((a) => a.juz).sort((x, y) => x - y),
        juzDone: mine.filter((a) => a.uid === uid && a.done).length,
        pagesRead: mine.reduce((s, a) => s + pagesReadBy(a, uid), 0),
      };
    }),
  };
}

// Pages read per ISO week start (Monday), for the activity chart
export function pagesPerWeek(assignments: Assignment[], weeks: number, now: Date = new Date()): { weekStart: string; pages: number }[] {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 7 * (weeks - 1 - i));
    return { start: d.getTime(), weekStart: d.toISOString().slice(0, 10), pages: 0 };
  });
  const first = buckets[0].start;
  assignments.forEach((a) => {
    Object.values(a.completedAt || {}).forEach((iso) => {
      const t = new Date(iso).getTime();
      if (Number.isNaN(t) || t < first) return;
      const idx = Math.min(weeks - 1, Math.floor((t - first) / (7 * 24 * 3600 * 1000)));
      buckets[idx].pages += 1;
    });
  });
  return buckets.map(({ weekStart, pages }) => ({ weekStart, pages }));
}
