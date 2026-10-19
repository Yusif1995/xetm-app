// Group-level widgets shared by the "Bu gün", "Qrup", admin and analytics screens.
// Everything is computed from the juz assignment records (groups/{gid}/assignments).
import type { UserDoc } from "@/lib/db";
import { khatmLabel } from "@/lib/quran";
import { MAX_OPEN_ASSIGNMENTS, openAssignmentsOf, type Assignment } from "@/lib/khatm";
import { Avatar, Bar, Chip } from "./ui";

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
}: {
  name: string;
  isSelf: boolean;
  isOwner: boolean;
  share: ShareStats;
  note?: string; // replaces the "N cüz bitirib" line in the full row
  compact?: boolean;
}) {
  const chip = STATUS_CHIP[share.status];
  const barColor = share.status === "done" ? "done" : "accent";
  const role = isOwner ? "Qrup sahibi" : "İştirakçı";

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
          <div className="text-[15px] font-bold truncate">
            {name} {isSelf && <span className="font-medium text-muted">(sən)</span>}
          </div>
          <div className="text-[13px] text-muted">{role} · {note ?? `${share.finished} cüz bitirib`}</div>
        </div>
      </div>
      <div className="flex-[1_1_140px] text-sm text-ink">{share.label}</div>
      <div className="flex-[2_1_200px] flex flex-col gap-1.5">
        <div className="flex justify-between text-[13px] text-muted">
          <span>{share.done} / {share.total} səhifə</span>
          <span className="font-bold text-ink">{Math.round(share.ratio * 100)}%</span>
        </div>
        <Bar ratio={share.ratio} color={barColor} label={`${name}: oxuduğu səhifələr`} />
      </div>
      <Chip tone={chip.tone}>{chip.text}</Chip>
    </div>
  );
}

export interface JuzTile {
  juz: number;
  state: "done" | "progress" | "assigned" | "empty";
  completed: number;
  total: number;
  holderUid: string | null;
}

// The 30 juz of one khatm
export function khatmJuzTiles(assignments: Assignment[], khatm: number): JuzTile[] {
  return Array.from({ length: 30 }, (_, i) => {
    const juz = i + 1;
    const a = assignments.find((x) => x.khatm === khatm && x.juz === juz);
    if (!a) return { juz, state: "empty", completed: 0, total: juz === 30 ? 24 : 20, holderUid: null };
    const state = a.done ? "done" : a.completedPages.length > 0 ? "progress" : "assigned";
    return { juz, state, completed: a.completedPages.length, total: a.pages.length, holderUid: a.uid };
  });
}

const TILE_STYLE: Record<JuzTile["state"], string> = {
  done: "bg-done border border-done text-cream",
  progress: "bg-progress border border-accent text-forest",
  assigned: "bg-white border border-[#A9A08A] text-forest",
  empty: "bg-[#F3EEDF] border border-dashed border-[#BDB59F] text-[#6A6553]",
};

export function JuzMap({ tiles, holderName }: { tiles: JuzTile[]; holderName?: (uid: string) => string }) {
  return (
    <>
      <div className="grid grid-cols-5 md:grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2 md:gap-2.5">
        {tiles.map((j) => (
          <div
            key={j.juz}
            title={j.holderUid && holderName ? holderName(j.holderUid) : undefined}
            className={`flex flex-col items-center justify-center gap-0.5 min-h-[64px] md:min-h-[92px] rounded-[12px] md:rounded-[14px] box-border p-2 text-center ${TILE_STYLE[j.state]}`}
          >
            <div className="text-[11px] font-semibold opacity-85">Cüz</div>
            <div className="font-display font-bold text-xl md:text-[26px] leading-none">{j.juz}</div>
            <div className="text-[10px] md:text-xs font-semibold">
              {j.state === "empty" ? "Boş" : `${j.completed} / ${j.total}`}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs md:text-[13px] text-muted">
        <Legend className="bg-done" label="Tamamlanıb" />
        <Legend className="bg-progress border border-accent" label="Davam edir" />
        <Legend className="bg-white border border-[#A9A08A]" label="Təyin edilib" />
        <Legend className="bg-[#F3EEDF] border border-dashed border-[#BDB59F]" label="Təyin edilməyib" />
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
            selected === k ? "bg-forest text-cream border-forest" : "bg-white text-forest border-field hover:bg-sand"
          }`}
        >
          {khatmLabel(k)}{completed.has(k) ? " ✓" : ""}
        </button>
      ))}
    </div>
  );
}
