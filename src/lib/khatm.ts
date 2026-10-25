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

export type ReaderState = "notStarted" | "reading" | "finished";

// Where a member stands in one khatm, judged by the juz they hold now (the unfinished ones), so a
// new distribution counts from zero: someone who finished their juz in an earlier distribution and
// was just given a new one is "not started" again until they read a page of it.
// - an unfinished juz with at least one page read -> reading
// - unfinished juz, none started, or no juz in this khatm at all -> notStarted
// - no unfinished juz and at least one finished -> finished
export function readerStateInKhatm(assignments: Assignment[], uid: string, khatm: number): ReaderState {
  const mine = assignments.filter((a) => a.uid === uid && a.khatm === khatm);
  const open = mine.filter((a) => !a.done);
  if (open.length > 0) return open.some((a) => a.completedPages.length > 0) ? "reading" : "notStarted";
  return mine.length > 0 ? "finished" : "notStarted";
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

// One juz per eligible member. Juz go out in order: the lowest free juz of the khatm that is still
// being handed out first, then juz 1, 2, ... of the next khatm when it runs out. Members are matched
// to those juz so that as many as possible get a juz number they have never had before, so the
// same people do not keep reading the same juz from khatm to khatm.
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

  // The juz handed out in this distribution, in reading order
  const start = openKhatmForAssignment(assignments);
  const slots: { khatm: number; juz: number }[] = [];
  let khatm = start.khatm;
  let pool = [...start.free].sort((a, b) => a - b);
  while (slots.length < eligibleUids.length) {
    if (pool.length === 0) {
      khatm += 1;
      pool = Array.from({ length: JUZ_COUNT }, (_, i) => i + 1);
    }
    slots.push({ khatm, juz: pool.shift()! });
  }

  // Maximum matching of slots to members who have never had that juz (augmenting paths).
  // Members are shuffled so ties are not always broken in favour of the same people.
  const members = shuffle(eligibleUids, rng);
  const isFresh = (uid: string, juz: number) => !(history.get(uid)?.has(juz));
  const memberOfSlot: (string | null)[] = slots.map(() => null);
  const slotOfMember = new Map<string, number>();

  const tryAssign = (slot: number, visited: Set<string>): boolean => {
    for (const uid of members) {
      if (visited.has(uid) || !isFresh(uid, slots[slot].juz)) continue;
      visited.add(uid);
      const taken = slotOfMember.get(uid);
      if (taken === undefined || tryAssign(taken, visited)) {
        memberOfSlot[slot] = uid;
        slotOfMember.set(uid, slot);
        return true;
      }
    }
    return false;
  };
  slots.forEach((_, slot) => tryAssign(slot, new Set()));

  // Juz nobody fresh could take go to the members still without one
  const leftover = members.filter((uid) => !slotOfMember.has(uid));
  slots.forEach((_, slot) => {
    if (memberOfSlot[slot] === null) memberOfSlot[slot] = leftover.shift()!;
  });

  return slots.map((s, slot) => ({ uid: memberOfSlot[slot]!, khatm: s.khatm, juz: s.juz }));
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
