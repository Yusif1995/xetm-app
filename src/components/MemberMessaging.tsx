"use client";
// Admin panel dialogs for talking to members: one member's conversation, and one text sent to
// many members at once (each copy lands in that member's own thread).
import { useEffect, useMemo, useState } from "react";
import { markThreadRead, sendGroupMessage } from "@/lib/db";
import { useThreadMessages } from "@/lib/useGroupData";
import { MAX_THREAD_MESSAGE_LENGTH, type ThreadSummary } from "@/lib/threads";
import ThreadView from "./ThreadView";
import { IconClose, btn, inputCls } from "./ui";

function Dialog({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-line rounded-hero shadow-bar p-6 w-full max-w-lg max-h-[92vh] overflow-y-auto flex flex-col gap-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1 min-w-0">
            <h3 className="m-0 font-bold text-2xl text-ink">{title}</h3>
            {subtitle && <div className="text-sm text-muted truncate">{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Bağla" className="press shrink-0 w-11 h-11 -mr-2 -mt-2 rounded-full flex items-center justify-center text-muted hover:bg-sand">
            <IconClose size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// The group creator sees the whole conversation; an app admin who did not create the group can
// write but not read it (replies are for the group creator and the app owner only)
export function ThreadDialog({
  groupId, groupName, memberUid, memberName, canRead, summary, onClose,
}: {
  groupId: string;
  groupName: string;
  memberUid: string;
  memberName: string;
  canRead: boolean;
  summary?: ThreadSummary;
  onClose: () => void;
}) {
  const { messages, loaded } = useThreadMessages(groupId, memberUid, canRead);

  useEffect(() => {
    if (!canRead || !summary?.managerUnread) return;
    markThreadRead(groupId, memberUid, "manager").catch((err) => console.error("Error marking thread read:", err));
  }, [canRead, summary?.managerUnread, groupId, memberUid]);

  const [sentNote, setSentNote] = useState<string | null>(null);
  const send = async (text: string) => {
    await sendGroupMessage(groupId, [memberUid], text);
    if (!canRead) setSentNote("Mesaj göndərildi. Cavabları qrup rəhbəri görür.");
  };

  return (
    <Dialog title="Mesajlar" subtitle={`${memberName} · ${groupName}`} onClose={onClose}>
      {canRead ? (
        loaded ? (
          <ThreadView
            messages={messages}
            mySide="manager"
            managerLabel="Sən"
            memberLabel={memberName}
            emptyText="Hələ yazışma yoxdur. İlk mesajı yaz."
            placeholder="Məs. Cüzünü cümə gününə qədər bitirməyə çalış"
            onSend={send}
          />
        ) : (
          <p className="m-0 text-sm text-muted">Yüklənir...</p>
        )
      ) : (
        <>
          <p className="m-0 text-[13px] text-muted">
            Bu qrupu sən yaratmamısan: mesaj göndərə bilərsən, amma yazışmanı və cavabları yalnız qrup rəhbəri görür.
          </p>
          {sentNote && <div className="text-sm font-semibold text-forest">{sentNote}</div>}
          <ThreadView messages={[]} mySide="manager" emptyText="" placeholder="Mesajını yaz" onSend={send} />
        </>
      )}
      <div className="text-xs text-muted">İştirakçı mesajı &quot;Bu gün&quot; ekranında görəcək və telefonuna bildiriş gələcək.</div>
    </Dialog>
  );
}

export interface BroadcastMember {
  uid: string;
  name: string;
  openJuz: number; // unfinished juz the member holds now
}

type Preset = "all" | "open" | "none";

export function BroadcastDialog({ groupId, groupName, members, onClose }: {
  groupId: string;
  groupName: string;
  members: BroadcastMember[];
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(members.map((m) => m.uid)));
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const sorted = useMemo(() => [...members].sort((a, b) => a.name.localeCompare(b.name, "az")), [members]);
  const pick = (p: Preset) => setSelected(new Set(
    p === "all" ? members.map((m) => m.uid) : p === "open" ? members.filter((m) => m.openJuz > 0).map((m) => m.uid) : []
  ));
  const toggle = (uid: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(uid)) next.delete(uid); else next.add(uid);
    return next;
  });

  const submit = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await sendGroupMessage(groupId, Array.from(selected), text.trim());
      setDone(`${res.sent} iştirakçıya göndərildi. Hər kəs mesajı öz yazışmasında görür, bir-birinin mesajını görmür.`);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mesaj göndərilmədi.");
    } finally {
      setSending(false);
    }
  };

  const presetBtn = "press min-h-[36px] px-3 rounded-full text-[13px] font-bold border border-line hover:bg-sand";

  return (
    <Dialog title="Toplu mesaj" subtitle={groupName} onClose={onClose}>
      {done ? (
        <>
          <p className="m-0 text-[15px] text-ink">{done}</p>
          <div className="flex flex-wrap gap-2.5">
            <button type="button" onClick={() => setDone(null)} className={btn.outline}>Yeni mesaj</button>
            <button type="button" onClick={onClose} className={btn.primary}>Bağla</button>
          </div>
        </>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-ink">Kimə · {selected.size} / {members.length}</span>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => pick("all")} className={presetBtn}>Hamısı</button>
                <button type="button" onClick={() => pick("open")} className={presetBtn}>Cüzü bitməyənlər</button>
                <button type="button" onClick={() => pick("none")} className={presetBtn}>Heç biri</button>
              </div>
            </div>
            <div className="max-h-[32vh] overflow-y-auto border border-line rounded-2xl divide-y divide-sand">
              {sorted.length === 0 ? (
                <p className="m-0 text-sm text-muted p-4">Qrupda mesaj göndəriləcək iştirakçı yoxdur.</p>
              ) : sorted.map((m) => (
                <label key={m.uid} className="flex items-center gap-3 px-4 min-h-[48px] text-[15px] cursor-pointer hover:bg-cream">
                  <input type="checkbox" checked={selected.has(m.uid)} onChange={() => toggle(m.uid)} className="w-5 h-5 accent-forest" />
                  <span className="flex-1 min-w-0 truncate font-semibold text-ink">{m.name}</span>
                  {m.openJuz > 0 && <span className="text-xs text-muted shrink-0">{m.openJuz} cüz açıq</span>}
                </label>
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-2 text-sm font-semibold text-ink">
            Mesaj
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              maxLength={MAX_THREAD_MESSAGE_LENGTH}
              placeholder="Məs. Bu həftə cüzlərimizi cümə gününə qədər bitirək"
              className={`${inputCls} py-3 resize-y`}
            />
          </label>
          <div className="text-xs text-muted">Hər iştirakçı mesajı ayrıca alır və yalnız qrup rəhbərinə cavab yaza bilər. Başqalarının mesajını görmür.</div>
          {error && <div className="text-sm font-semibold text-danger">{error}</div>}
          <div className="flex flex-wrap gap-2.5">
            <button type="submit" disabled={sending || !text.trim() || selected.size === 0} className={`${btn.primary} flex-1`}>
              {sending ? "Göndərilir..." : `${selected.size} nəfərə göndər`}
            </button>
            <button type="button" disabled={sending} onClick={onClose} className={btn.outline}>Ləğv et</button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
