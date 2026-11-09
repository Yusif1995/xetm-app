// Group-level widgets shared by the "Bu gün", "Qrup", admin and analytics screens.
// Everything is computed from the juz assignment records (groups/{gid}/assignments).
"use client";
import { useEffect, useRef, useState } from "react";
import type { UserDoc } from "@/lib/db";
import { khatmLabel, ordinalAz } from "@/lib/quran";
import { formatIsoDateAz } from "@/lib/dates";
import { MAX_OPEN_ASSIGNMENTS, openAssignmentsOf, type Assignment } from "@/lib/khatm";
import { Avatar, Bar, Chip, button } from "./ui";

// Names: you see your own name; full names of others come from the group's profiles,
// which only the group owner can read. Everyone else sees nicknames.
export function participantName(
  user: UserDoc,
  viewer: { uid: string; name?: string } | null,
  fullNames: Record<string, string> = {}
): string {
  if (viewer && user.uid === viewer.uid) return viewer.name || user.nickname || "Sən";
  return fullNames[user.uid] || user.nickname || "İştirakçı";
}

export type GroupRole = "Owner" | "Admin" | "İştirakçı";

// How a member's role reads to the viewer: the group owner sees themselves as "Owner" and
// everyone else sees the owner as "Admin"; app admins (admins/{uid}) are "Admin" for all.
export function roleOf(uid: string, viewerUid: string | undefined, ownerUid: string | null | undefined, adminUids: string[]): GroupRole {
  if (ownerUid && uid === ownerUid) return viewerUid === ownerUid ? "Owner" : "Admin";
  if (adminUids.includes(uid)) return "Admin";
  return "İştirakçı";
}

export interface ShareStats {
  label: string;     // e.g. "Cüz 7 · 1-ci xətm"
  done: number;      // pages read in the open juz
  total: number;     // pages of the open juz
  ratio: number;
  open: number;      // unfinished juz count
  finished: number;  // finished juz count
  status: "done" | "progress" | "assigned" | "none" | "behind";
}

// What a member is reading right now (their unfinished juz) and how far they are
export function memberShare(assignments: Assignment[], uid: string): ShareStats {
  const open = openAssignmentsOf(assignments, uid);
  const finished = assignments.filter((a) => a.uid === uid && a.done).length;
  const done = open.reduce((s, a) => s + a.completedPages.length, 0);
  const total = open.reduce((s, a) => s + a.pages.length, 0);
  const label = open.length > 0
    ? open.map((a) => `Cüz ${a.juz} · ${khatmLabel(a.khatm)}`).join(", ")
    : finished > 0 ? `${finished} cüz bitirib` : "Təyin edilməyib";
  let status: ShareStats["status"] = "none";
  if (open.length >= MAX_OPEN_ASSIGNMENTS) status = "behind";
  else if (open.length > 0) status = done > 0 ? "progress" : "assigned";
  else if (finished > 0) status = "done";
  return { label, done, total, ratio: total > 0 ? done / total : finished > 0 ? 1 : 0, open: open.length, finished, status };
}

const STATUS_CHIP: Record<ShareStats["status"], { tone: "done" | "progress" | "neutral" | "pending"; text: string }> = {
  done: { tone: "done", text: "Tamamladı" },
  progress: { tone: "progress", text: "Davam edir" },
  assigned: { tone: "neutral", text: "Başlamayıb" },
  none: { tone: "neutral", text: "Təyin edilməyib" },
  behind: { tone: "pending", text: "Geri qalır" },
};

export function ParticipantRow({
  name,
  isSelf,
  isOwner,
  share,
  note,
  compact = false,
  role: roleProp,
}: {
  name: string;
  isSelf: boolean;
  isOwner: boolean;
  share: ShareStats;
  role?: GroupRole;
  note?: string; // replaces the "N cüz bitirib" line in the full row
  compact?: boolean;
}) {
  const chip = STATUS_CHIP[share.status];
  const barColor = share.status === "done" ? "done" : "accent";
  const role: GroupRole = roleProp ?? (isOwner ? "Owner" : "İştirakçı");
  const roleChip = role !== "İştirakçı" ? <Chip tone="owner">{role}</Chip> : null;

  if (compact) {
    return (
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-3">
          <Avatar name={name} gold={!isSelf} />
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold truncate">
              {name} {isSelf && <span className="font-medium text-muted">(sən)</span>}
            </div>
            <div className="text-[13px] text-muted truncate">
              {share.label}{share.total > 0 && ` · ${share.done} / ${share.total} səhifə`}
            </div>
          </div>
          <Chip tone={chip.tone}>{chip.text}</Chip>
        </div>
        <Bar ratio={share.ratio} color={barColor} label={`${name}: oxuduğu səhifələr`} />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-4 py-4 border-t border-sand">
      <div className="flex-[1_1_220px] flex items-center gap-3 min-w-0">
        <Avatar name={name} size={44} gold={!isSelf} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
            <span className="text-[15px] font-bold truncate">
              {name} {isSelf && <span className="font-medium text-muted">(sən)</span>}
            </span>
            {roleChip}
          </div>
          <div className="text-[13px] text-muted">{role} · {note ?? `${share.finished} cüz bitirib`}</div>
        </div>
      </div>
      <div className="flex-[1_1_140px] text-sm text-ink">{share.label}</div>
      <div className="flex-[2_1_200px] flex flex-col gap-1.5">
        <div className="flex justify-between text-[13px] text-muted">
          <span>{share.total > 0 ? `${share.done} / ${share.total} səhifə` : share.finished > 0 ? "Payı bitib" : "Pay yoxdur"}</span>
          {share.total > 0 && <span className="font-bold text-ink tabular-nums">{Math.round(share.ratio * 100)}%</span>}
        </div>
        <Bar ratio={share.ratio} color={barColor} label={`${name}: oxuduğu səhifələr`} />
      </div>
      <Chip tone={chip.tone}>{chip.text}</Chip>
    </div>
  );
}

export interface JuzTile {
  juz: number;
  khatm: number;
  state: "done" | "progress" | "assigned" | "empty";
  completed: number;
  total: number;
  holderUid: string | null;
  distribution: number | null;
  startDate: string;
  endDate: string;
  doneAt: string | null;
}

// The 30 juz of one khatm
export function khatmJuzTiles(assignments: Assignment[], khatm: number): JuzTile[] {
  return Array.from({ length: 30 }, (_, i) => {
    const juz = i + 1;
    const a = assignments.find((x) => x.khatm === khatm && x.juz === juz);
    if (!a) {
      return { juz, khatm, state: "empty", completed: 0, total: juz === 30 ? 24 : 20, holderUid: null, distribution: null, startDate: "", endDate: "", doneAt: null };
    }
    const state = a.done ? "done" : a.completedPages.length > 0 ? "progress" : "assigned";
    return {
      juz, khatm, state, completed: a.completedPages.length, total: a.pages.length, holderUid: a.uid,
      distribution: a.distribution, startDate: a.startDate, endDate: a.endDate, doneAt: a.doneAt,
    };
  });
}

const TILE_STATE_TEXT: Record<JuzTile["state"], string> = {
  done: "Tamamlanıb",
  progress: "Davam edir",
  assigned: "Verilib, başlanmayıb",
  empty: "Hələ verilməyib",
};

// One juz card for the whole app: the octagon tile of the 30-juz map. "late" is a juz finished after
// its end date; "locked" waits until the current juz is finished.
export type JuzBadgeState = JuzTile["state"] | "late" | "locked";

const TILE_STYLE: Record<JuzBadgeState, string> = {
  done: "bg-juzdone text-white",
  progress: "bg-juzprogress text-white",
  assigned: "bg-juzassigned text-progresstext",
  empty: "bg-track text-muted",
  late: "bg-progress text-progresstext",
  locked: "bg-sand text-muted",
};

export function JuzBadge({
  juz, state, sub, size = "md", selected, onClick, label, title, delay,
}: {
  juz: number;
  state: JuzBadgeState;
  sub?: string;
  size?: "md" | "sm";
  // Set only for pickers (admin: choose a free juz); the tile then reports pressed / not pressed
  selected?: boolean;
  onClick?: () => void;
  label?: string;
  title?: string;
  delay?: number;
}) {
  const box = size === "md"
    ? "aspect-square min-h-[60px] md:min-h-[88px] p-2"
    : "w-[68px] h-[68px] p-1.5";
  const cls = `octagon juz-tile flex flex-col items-center justify-center gap-0.5 box-border text-center ${box} ${
    selected ? "bg-forest text-white" : TILE_STYLE[state]
  } ${onClick ? "press" : ""}`;
  const body = (
    <>
      <span className={`${size === "md" ? "text-[11px]" : "text-[10px]"} font-semibold opacity-85`}>Cüz</span>
      <span className={`font-extrabold leading-none ${size === "md" ? "text-xl md:text-[26px]" : "text-[19px]"}`}>{juz}</span>
      {sub && <span className={`${size === "md" ? "text-[10px] md:text-xs" : "text-[10px]"} font-semibold leading-tight`}>{sub}</span>}
    </>
  );
  const style = delay !== undefined ? { animationDelay: `${delay}ms` } : undefined;
  return onClick ? (
    <button type="button" onClick={onClick} aria-label={label} aria-pressed={selected} title={title} className={cls} style={style}>
      {body}
    </button>
  ) : (
    <div role="img" aria-label={label || `Cüz ${juz}${sub ? `, ${sub}` : ""}`} title={title} className={cls} style={style}>
      {body}
    </div>
  );
}

// Tapping a juz opens a small card with who holds it, how far they are and the dates
// "Cüz 21–25" / "Cüz 3, 7, 12–14" for a list of juz numbers
function juzRangesLabel(juzs: number[]): string {
  const sorted = [...juzs].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(i === j ? `${sorted[i]}` : `${sorted[i]}–${sorted[j]}`);
    i = j;
  }
  return `Cüz ${parts.join(", ")}`;
}

// byDistribution: the tiles are split under one heading per distribution round ("5-ci bölgü · Cüz 21–25"),
// juz not handed out yet come last
export function JuzMap({ tiles, holderName, byDistribution = false }: { tiles: JuzTile[]; holderName?: (uid: string) => string; byDistribution?: boolean }) {
  const [open, setOpen] = useState<JuzTile | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const rounds = Array.from(new Set(tiles.filter((t) => t.distribution !== null).map((t) => t.distribution as number))).sort((a, b) => a - b);
  const groups: { key: string; title: string; note?: string; tiles: JuzTile[] }[] = rounds.map((d) => {
    const list = tiles.filter((t) => t.distribution === d);
    const first = list.find((t) => t.startDate && t.endDate);
    return {
      key: `d${d}`,
      title: `${ordinalAz(d)} bölgü · ${juzRangesLabel(list.map((t) => t.juz))}`,
      note: first ? `${formatIsoDateAz(first.startDate)} – ${formatIsoDateAz(first.endDate)}` : undefined,
      tiles: list,
    };
  });
  const free = tiles.filter((t) => t.distribution === null);
  if (free.length > 0) groups.push({ key: "free", title: "Paylanmayıb", note: juzRangesLabel(free.map((t) => t.juz)), tiles: free });

  return (
    <>
      {(byDistribution ? groups : [{ key: "all", title: "", tiles }]).map((g) => (
        <div key={g.key} className={byDistribution ? "flex flex-col gap-2.5 [&+&]:pt-4 [&+&]:border-t [&+&]:border-sand" : "contents"}>
          {g.title && (
            <div className="flex flex-wrap items-baseline gap-x-2 text-[14px] font-bold text-ink">
              {g.title}
              <span className="text-[13px] font-semibold text-muted">{g.note}</span>
            </div>
          )}
          <div className="grid grid-cols-5 md:grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-1.5 md:gap-2.5">
            {g.tiles.map((j) => (
              <JuzBadge
                key={j.juz}
                juz={j.juz}
                state={j.state}
                sub={j.state === "empty" ? "Boş" : `${j.completed} / ${j.total}`}
                onClick={() => setOpen(j)}
                label={`Cüz ${j.juz}: ${TILE_STATE_TEXT[j.state]}${j.holderUid && holderName ? `, ${holderName(j.holderUid)}` : ""}`}
                delay={(j.juz - 1) * 22}
              />
            ))}
          </div>
        </div>
      ))}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center p-4" onClick={() => setOpen(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="juz-pop-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white border border-line rounded-hero shadow-bar p-5 flex flex-col gap-3.5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="juz-pop-title" className="m-0 font-display font-normal text-2xl text-ink">Cüz {open.juz}</h3>
                <div className="text-[13px] text-muted">
                  {khatmLabel(open.khatm)}{open.distribution ? ` · ${ordinalAz(open.distribution)} bölgü` : ""}
                </div>
              </div>
              <Chip tone={open.state === "done" ? "done" : open.state === "empty" ? "neutral" : "progress"}>{TILE_STATE_TEXT[open.state]}</Chip>
            </div>
            {open.holderUid ? (
              <>
                <div className="flex items-center gap-3">
                  <Avatar name={holderName ? holderName(open.holderUid) : "?"} gold />
                  <div className="min-w-0">
                    <div className="text-xs text-muted">Kimə düşüb</div>
                    <div className="text-[16px] font-bold text-ink truncate">{holderName ? holderName(open.holderUid) : "İştirakçı"}</div>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[13px] text-muted">
                    <span>{open.completed} / {open.total} səhifə oxunub</span>
                    <span className="font-bold text-ink tabular-nums">{Math.round((open.completed / open.total) * 100)}%</span>
                  </div>
                  <Bar ratio={open.completed / open.total} color={open.state === "done" ? "done" : "accent"} />
                </div>
                <div className="text-[13px] text-muted">
                  {open.startDate && open.endDate ? `Müddət: ${formatIsoDateAz(open.startDate)} – ${formatIsoDateAz(open.endDate)}` : ""}
                  {open.doneAt ? `${open.startDate ? " · " : ""}Bitib: ${formatIsoDateAz(open.doneAt.slice(0, 10))}` : ""}
                </div>
              </>
            ) : (
              <p className="m-0 text-sm text-muted">Bu cüz hələ heç kimə verilməyib.</p>
            )}
            <button ref={closeRef} type="button" onClick={() => setOpen(null)} className={button("outline", "md")}>Bağla</button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs md:text-[13px] text-muted">
        <Legend className="bg-juzdone" label="Tamamlanıb" />
        <Legend className="bg-juzprogress" label="Davam edir" />
        <Legend className="bg-juzassigned" label="Verilib" />
        <Legend className="bg-track" label="Verilməyib" />
      </div>
    </>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`octagon w-3.5 h-3.5 box-border ${className}`} />
      {label}
    </span>
  );
}

// Khatm selector chips (e.g. 1-ci xətm ✓, 2-ci xətm)
export function KhatmTabs({
  khatms,
  selected,
  completed,
  onSelect,
}: {
  khatms: number[];
  selected: number;
  completed: Set<number>;
  onSelect: (k: number) => void;
}) {
  if (khatms.length <= 1) return null;
  return (
    <div role="tablist" aria-label="Xətm" className="flex flex-wrap gap-1.5">
      {khatms.map((k) => (
        <button
          key={k}
          type="button"
          role="tab"
          aria-selected={selected === k}
          onClick={() => onSelect(k)}
          className={`min-h-[40px] px-3.5 rounded-xl text-sm font-semibold border transition-colors ${
            selected === k ? "bg-forest text-white border-forest" : "bg-white text-ink border-field hover:bg-sand"
          }`}
        >
          {khatmLabel(k)}{completed.has(k) ? " ✓" : ""}
        </button>
      ))}
    </div>
  );
}
