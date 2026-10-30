// How an archive record reads, shared by the archive page and its PDF export so both say the same
// thing: a title, a few summary lines and tables (columns sized as fractions of the width).
import type { ArchiveEntry, ArchivedJuz } from "./archive.ts";
import { bakuDay, dayDiff } from "./analytics.ts";
import { khatmLabel, ordinalAz } from "./quran.ts";
import { formatIsoDateAz } from "./dates.ts";

export interface ArchiveColumn {
  label: string;
  width: number;          // share of the table width, the shares of a table add up to 1
  align?: "left" | "right";
}

export interface ArchiveTable {
  title: string;
  columns: ArchiveColumn[];
  rows: string[][];
}

const day = (iso: string | null) => (iso ? formatIsoDateAz(bakuDay(iso)) : "—");

export function entryTitle(e: ArchiveEntry): string {
  return e.kind === "khatm" ? khatmLabel(e.khatm) : `${ordinalAz(e.distribution)} bölgü`;
}

// When the record finished, used to sort the archive newest first
export function entryFinishedAt(e: ArchiveEntry): string {
  return e.completedAt || e.archivedAt;
}

export function entrySummary(e: ArchiveEntry): string[] {
  const readers = `${e.readers.length} oxuyan`;
  if (e.kind === "khatm") {
    const start = bakuDay(e.startedAt);
    const end = bakuDay(e.completedAt);
    return [
      `${formatIsoDateAz(start)} – ${formatIsoDateAz(end)} · ${dayDiff(start, end) + 1} gün`,
      `30 cüz · ${e.pagesRead} səhifə · ${readers}`,
    ];
  }
  const late = e.juz.filter((j) => j.late).length;
  return [
    `Müddət: ${formatIsoDateAz(e.startDate)} – ${formatIsoDateAz(e.endDate)} · son cüz ${day(e.completedAt)} bitib`,
    `${e.juz.length} cüz · ${readers}${late ? ` · ${late} cüz gecikib` : " · hamısı vaxtında"}`,
  ];
}

function note(j: ArchivedJuz): string {
  const parts: string[] = [];
  if (j.late) parts.push("gecikib");
  if (j.handedOverBy.length) parts.push(`ötürülüb: ${j.handedOverBy.join(", ")}`);
  return parts.join(" · ");
}

export function entryTables(e: ArchiveEntry): ArchiveTable[] {
  const readers: ArchiveTable = {
    title: "Oxuyanlar",
    columns: [
      { label: "Ad", width: 0.6 },
      { label: "Bitirdiyi cüz", width: 0.2, align: "right" },
      { label: "Səhifə", width: 0.2, align: "right" },
    ],
    rows: e.readers.map((r) => [r.name, String(r.juz), String(r.pages)]),
  };

  if (e.kind === "khatm") {
    return [
      {
        title: "Cüzlər",
        columns: [
          { label: "Cüz", width: 0.09, align: "right" },
          { label: "Oxuyan", width: 0.34 },
          { label: "Bölgü", width: 0.13 },
          { label: "Bitib", width: 0.16 },
          { label: "Qeyd", width: 0.28 },
        ],
        rows: e.juz.map((j) => [String(j.juz), j.holder, ordinalAz(j.distribution), day(j.doneAt), note(j)]),
      },
      readers,
    ];
  }

  return [
    {
      title: "Cüzlər (bitmə ardıcıllığı ilə)",
      columns: [
        { label: "Oxuyan", width: 0.34 },
        { label: "Cüz", width: 0.09, align: "right" },
        { label: "Xətm", width: 0.17 },
        { label: "Bitib", width: 0.16 },
        { label: "Qeyd", width: 0.24 },
      ],
      rows: e.juz.map((j) => [j.holder, String(j.juz), khatmLabel(j.khatm), day(j.doneAt), note(j)]),
    },
    readers,
  ];
}
