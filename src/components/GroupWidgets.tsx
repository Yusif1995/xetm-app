// Group-level widgets shared by the "Bu gün" and "Qrup" screens
import { getUserAssignment, type UserDoc } from "@/lib/db";
import { juzPageRange } from "@/lib/quran";
import { Avatar, Bar, Chip } from "./ui";

export interface ParticipantStats {
  assigned: number;
  completed: number;
  ratio: number;
  juzLabel: string;
  status: "done" | "progress" | "assigned" | "none";
}

export function participantStats(user: UserDoc, groupId: string): ParticipantStats {
  const a = getUserAssignment(user, groupId);
  const assignedPages = a.assignedPages || [];
  const assigned = assignedPages.length;
  const completed = (a.completedPages || []).filter((p) => assignedPages.includes(p)).length;
  const juzs = a.assignedJuzs && a.assignedJuzs.length > 0 ? a.assignedJuzs : a.assignedJuz ? [a.assignedJuz] : [];
  const juzLabel = juzs.length > 0
    ? `Cüz ${juzs.join(", ")}`
    : assigned > 0 ? `${assigned} səhifə` : "Təyin edilməyib";
  const status = assigned === 0 ? "none" : completed >= assigned ? "done" : completed > 0 ? "progress" : "assigned";
  return { assigned, completed, ratio: assigned > 0 ? completed / assigned : 0, juzLabel, status };
}

const STATUS_CHIP: Record<ParticipantStats["status"], { tone: "done" | "progress" | "neutral"; text: string }> = {
  done: { tone: "done", text: "Tamamladı" },
  progress: { tone: "progress", text: "Davam edir" },
  assigned: { tone: "neutral", text: "Başlamayıb" },
  none: { tone: "neutral", text: "Təyin edilməyib" },
};

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

export function ParticipantRow({
  user,
  groupId,
  name,
  isSelf,
  isOwner,
  compact = false,
}: {
  user: UserDoc;
  groupId: string;
  name: string;
  isSelf: boolean;
  isOwner: boolean;
  compact?: boolean;
}) {
  const s = participantStats(user, groupId);
  const chip = STATUS_CHIP[s.status];
  const barColor = s.status === "done" ? "done" : "accent";
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
            <div className="text-[13px] text-muted">
              {s.juzLabel}{s.assigned > 0 && ` · ${s.completed} / ${s.assigned} səhifə`}
            </div>
          </div>
          <Chip tone={chip.tone}>{chip.text}</Chip>
        </div>
        <Bar ratio={s.ratio} color={barColor} />
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
          <div className="text-[13px] text-muted">{role}</div>
        </div>
      </div>
      <div className="flex-[1_1_100px] text-sm text-ink">{s.juzLabel}</div>
      <div className="flex-[2_1_200px] flex flex-col gap-1.5">
        <div className="flex justify-between text-[13px] text-muted">
          <span>{s.completed} / {s.assigned} səhifə</span>
          <span className="font-bold text-ink">{Math.round(s.ratio * 100)}%</span>
        </div>
        <Bar ratio={s.ratio} color={barColor} />
      </div>
      <Chip tone={chip.tone}>{chip.text}</Chip>
    </div>
  );
}

export interface JuzTileState {
  juz: number;
  state: "done" | "progress" | "assigned" | "unfinished" | "empty";
  completed: number;
  total: number;
}

// Status of each of the 30 juz across the given (approved) group members
export function computeJuzStates(users: UserDoc[], groupId: string): JuzTileState[] {
  return Array.from({ length: 30 }, (_, idx) => {
    const juz = idx + 1;
    const { start, end } = juzPageRange(juz);
    const total = end - start + 1;
    const holders = users.filter((u) => {
      const a = getUserAssignment(u, groupId);
      return (a.assignedJuzs || []).includes(juz) || a.assignedJuz === juz;
    });

    const done = new Set<number>();
    holders.forEach((u) => {
      (getUserAssignment(u, groupId).completedPages || []).forEach((p) => {
        if (p >= start && p <= end) done.add(p);
      });
    });

    // Previous round left pages of this juz unread
    const unfinishedPrev = users.some((u) => {
      const a = getUserAssignment(u, groupId);
      const prevCompleted = a.previousCompletedPages || [];
      return (a.previousAssignedPages || []).some((p) => p >= start && p <= end && !prevCompleted.includes(p));
    });

    let state: JuzTileState["state"] = "empty";
    if (holders.length > 0) {
      state = done.size >= total ? "done" : done.size > 0 ? "progress" : "assigned";
    }
    if (state !== "done" && unfinishedPrev) state = "unfinished";
    return { juz, state, completed: done.size, total };
  });
}

const TILE_STYLE: Record<JuzTileState["state"], string> = {
  done: "bg-done border border-done text-cream",
  progress: "bg-progress border border-accent text-forest",
  assigned: "bg-white border border-[#A9A08A] text-forest",
  unfinished: "bg-[#FBEAE5] border border-dangerline text-danger",
  empty: "bg-[#F3EEDF] border border-dashed border-[#BDB59F] text-[#6A6553]",
};

export function JuzMap({ states }: { states: JuzTileState[] }) {
  return (
    <>
      <div className="grid grid-cols-5 md:grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2 md:gap-2.5">
        {states.map((j) => (
          <div
            key={j.juz}
            className={`flex flex-col items-center justify-center gap-0.5 min-h-[64px] md:min-h-[92px] rounded-[12px] md:rounded-[14px] box-border p-2 text-center ${TILE_STYLE[j.state]}`}
          >
            <div className="text-[11px] font-semibold opacity-85">Cüz</div>
            <div className="font-display font-bold text-xl md:text-[26px] leading-none">{j.juz}</div>
            <div className="text-[10px] md:text-xs font-semibold">
              {j.state === "empty" ? "Boş" : j.state === "unfinished" && j.completed === 0 ? "Yarımçıq" : `${j.completed} / ${j.total}`}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs md:text-[13px] text-muted">
        <Legend className="bg-done" label="Tamamlanıb" />
        <Legend className="bg-progress border border-accent" label="Davam edir" />
        <Legend className="bg-white border border-[#A9A08A]" label="Təyin edilib" />
        <Legend className="bg-[#FBEAE5] border border-dangerline" label="Əvvəlki yarımçıq" />
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
