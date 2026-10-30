// Archive snapshots: finished khatms and distributions copied out of the live assignment records
// into groups/{gid}/archive, so they survive a reset of the assignments and carry everything the
// archive page and its PDF export need (names, juz, dates) without further lookups.
// Pure functions only, so they can be unit tested.
import { activeDistributions, khatmSummaries, pagesReadBy, type Assignment } from "./khatm.ts";
import { bakuDay } from "./analytics.ts";

export interface ArchivedJuz {
  juz: number;
  khatm: number;
  distribution: number;
  holderUid: string;
  holder: string;          // name at the time of archiving
  pages: number;
  startDate: string;
  endDate: string;
  doneAt: string | null;
  late: boolean;           // finished after the distribution's end date
  handedOverBy: string[];  // earlier holders when the juz was transferred
}

export interface ArchivedReader {
  uid: string;
  name: string;
  juz: number;   // juz finished as the final holder
  pages: number; // pages read, including part-read juz handed over to someone else
}

export interface KhatmArchive {
  kind: "khatm";
  id: string;
  khatm: number;
  startedAt: string;
  completedAt: string;
  pagesRead: number;
  juz: ArchivedJuz[];      // 1..30
  readers: ArchivedReader[];
}

export interface DistributionArchive {
  kind: "distribution";
  id: string;
  distribution: number;
  startDate: string;
  endDate: string;
  completedAt: string;     // when the last juz of the distribution was finished
  juz: ArchivedJuz[];      // in the order they were finished
  readers: ArchivedReader[];
}

export type ArchiveRecord = KhatmArchive | DistributionArchive;

// What is stored: the record plus the group name and when it was archived
export type ArchiveEntry = ArchiveRecord & { groupName: string; archivedAt: string };

const LATEST = Number.MAX_SAFE_INTEGER;

function archivedJuz(a: Assignment, nameOf: (uid: string) => string): ArchivedJuz {
  return {
    juz: a.juz,
    khatm: a.khatm,
    distribution: a.distribution,
    holderUid: a.uid,
    holder: nameOf(a.uid),
    pages: a.pages.length,
    startDate: a.startDate,
    endDate: a.endDate,
    doneAt: a.doneAt,
    late: !!(a.doneAt && a.endDate && bakuDay(a.doneAt) > a.endDate),
    handedOverBy: (a.previousHolders || []).map((h) => nameOf(h.uid)),
  };
}

function readersOf(list: Assignment[], nameOf: (uid: string) => string): ArchivedReader[] {
  const uids = new Set<string>();
  list.forEach((a) => {
    uids.add(a.uid);
    (a.previousHolders || []).forEach((h) => uids.add(h.uid));
  });
  return Array.from(uids)
    .map((uid) => ({
      uid,
      name: nameOf(uid),
      juz: list.filter((a) => a.uid === uid && a.done).length,
      pages: list.reduce((s, a) => s + pagesReadBy(a, uid), 0),
    }))
    .filter((r) => r.pages > 0 || r.juz > 0)
    .sort((a, b) => b.pages - a.pages || a.name.localeCompare(b.name, "az"));
}

const earliest = (values: string[]) => values.filter(Boolean).sort()[0] || "";
const latest = (values: (string | null)[]) => values.filter((v): v is string => !!v).sort().pop() || "";

// Ids stay unique across resets (khatm and distribution numbers start again from 1 after one)
const stamp = (iso: string) => (Date.parse(iso) || 0).toString(36);

// Every finished khatm (all 30 juz done) and every distribution with no unfinished juz left
export function buildArchive(assignments: Assignment[], nameOf: (uid: string) => string): ArchiveRecord[] {
  const records: ArchiveRecord[] = [];

  khatmSummaries(assignments)
    .filter((k) => k.completedAt)
    .forEach((k) => {
      const list = assignments.filter((a) => a.khatm === k.khatm).sort((a, b) => a.juz - b.juz);
      const startedAt = k.startedAt || earliest(list.map((a) => a.createdAt));
      records.push({
        kind: "khatm",
        id: `khatm-${k.khatm}-${stamp(startedAt)}`,
        khatm: k.khatm,
        startedAt,
        completedAt: k.completedAt!,
        pagesRead: k.pagesRead,
        juz: list.map((a) => archivedJuz(a, nameOf)),
        readers: readersOf(list, nameOf),
      });
    });

  const open = new Set(activeDistributions(assignments, LATEST));
  Array.from(new Set(assignments.map((a) => a.distribution)))
    .filter((d) => !open.has(d))
    .sort((a, b) => a - b)
    .forEach((d) => {
      const list = assignments
        .filter((a) => a.distribution === d)
        .sort((a, b) => (a.doneAt || "").localeCompare(b.doneAt || "") || a.juz - b.juz);
      records.push({
        kind: "distribution",
        id: `dist-${d}-${stamp(earliest(list.map((a) => a.createdAt)))}`,
        distribution: d,
        startDate: earliest(list.map((a) => a.startDate)),
        endDate: latest(list.map((a) => a.endDate)),
        completedAt: latest(list.map((a) => a.doneAt)),
        juz: list.map((a) => archivedJuz(a, nameOf)),
        readers: readersOf(list, nameOf),
      });
    });

  return records;
}
