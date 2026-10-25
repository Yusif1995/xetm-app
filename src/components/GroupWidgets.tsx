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

const TILE_STYLE: Record<JuzTile["state"], string> = {
  done: "bg-juzdone border border-juzdone text-white",
  progress: "bg-juzprogress border border-juzprogress text-white ring-2 ring-juzprogress ring-offset-2 ring-offset-white",
  assigned: "bg-juzassigned border border-juzassignedline text-ink",
  empty: "bg-white border border-line text-muted",
};

// Tapping a juz opens a small card with who holds it, how far they are and the dates
export function JuzMap({ tiles, holderName }: { tiles: JuzTile[]; holderName?: (uid: string) => string }) {
  const [open, setOpen] = useState<JuzTile | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div className="grid grid-cols-5 md:grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2 md:gap-2.5">
        {tiles.map((j) => (
          <button
            key={j.juz}
            type="button"
            onClick={() => setOpen(j)}
            aria-label={`Cüz ${j.juz}: ${TILE_STATE_TEXT[j.state]}${j.holderUid && holderName ? `, ${holderName(j.holderUid)}` : ""}`}
            className={`press flex flex-col items-center justify-center gap-0.5 min-h-[64px] md:min-h-[92px] rounded-[12px] md:rounded-[14px] box-border p-2 text-center ${TILE_STYLE[j.state]}`}
          >
            <span className="text-[11px] font-semibold opacity-85">Cüz</span>
            <span className="font-extrabold text-xl md:text-[26px] leading-none">{j.juz}</span>
            <span className="text-[10px] md:text-xs font-semibold">
              {j.state === "empty" ? "Boş" : `${j.completed} / ${j.total}`}
            </span>
          </button>
        ))}
      </div>
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
                <h3 id="juz-pop-title" className="m-0 text-xl font-extrabold text-ink">Cüz {open.juz}</h3>
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
        <Legend className="bg-juzassigned border border-juzassignedline" label="Verilib" />
        <Legend className="bg-white border border-field" label="Verilməyib" />
      </div>
    </>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`w-3.5 h-3.5 rounded box-border ${className}`} />
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
