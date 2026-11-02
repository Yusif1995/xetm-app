"use client";
// One manager <-> member conversation as a messenger: day separators, bubbles grouped by sender,
// the time and read ticks inside each bubble, and a composer docked below.
// Used by the member (/mesajlar), the group creator (inbox, admin panel) and the app owner (read-only).
//   ✓  saved and delivered to the other side's thread
//   ✓✓ (blue) the other side has opened the thread since
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { formatGregorianAz } from "@/lib/dates";
import { MAX_THREAD_MESSAGE_LENGTH, type ThreadSide } from "@/lib/threads";

export interface ThreadBubble {
  id: string;
  from: ThreadSide;
  text: string;
  sentAt: string;
  sender?: string;      // shown above a run of messages
  senderLabel?: string; // stored "Yusif · Admin"; shown when the view asks for labels
}

// What the other side has seen: their unread flag and when they last opened the thread
export interface ReadReceipt {
  unread: boolean;
  readAt?: string;
}

interface Props {
  messages: ThreadBubble[];
  mySide: ThreadSide;          // whose messages sit on the right
  emptyText: string;
  receipt?: ReadReceipt;       // omitted: no ticks (read-only views)
  labels?: boolean;            // show who wrote each run (bulk conversations)
  locked?: string;             // shown instead of the composer, e.g. only the leader answers
  onSend?: (text: string) => Promise<void>;
  placeholder?: string;
}

type Status = "sending" | "failed" | "sent" | "read";
interface Pending { key: number; text: string; at: number; failed: boolean; sent: boolean }

const GROUP_GAP_MS = 5 * 60 * 1000;
const author = (m: ThreadBubble) => m.sender ?? m.senderLabel ?? "";
const bakuDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Baku" });
const bakuTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Asia/Baku", hour: "2-digit", minute: "2-digit" });

function dayLabel(day: string): string {
  const today = bakuDay(new Date().toISOString());
  const yesterday = bakuDay(new Date(Date.now() - 86400000).toISOString());
  if (day === today) return "Bu gün";
  if (day === yesterday) return "Dünən";
  const d = new Date(`${day}T12:00:00Z`);
  return formatGregorianAz(d, d.getUTCFullYear() !== new Date().getUTCFullYear());
}

export default function ThreadView({ messages, mySide, emptyText, receipt, labels = false, locked, onSend, placeholder }: Props) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const keyRef = useRef(0);

  // A pending message disappears once the saved copy arrives from Firestore
  const shownPending = pending.filter((p) => !messages.some(
    (m) => m.from === mySide && m.text === p.text && Date.parse(m.sentAt) >= p.at - 60000
  ));

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, shownPending.length]);

  // The composer grows with its text up to five lines
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [text]);

  const deliver = async (p: Pending) => {
    try {
      await onSend!(p.text);
      setPending((list) => list.map((x) => (x.key === p.key ? { ...x, sent: true } : x)));
    } catch {
      setPending((list) => list.map((x) => (x.key === p.key ? { ...x, failed: true } : x)));
    }
  };

  const submit = () => {
    const value = text.trim();
    if (!onSend || !value) return;
    const p = { key: ++keyRef.current, text: value, at: Date.now(), failed: false, sent: false };
    setPending((list) => [...list, p]);
    setText("");
    deliver(p);
  };

  const retry = (p: Pending) => {
    setPending((list) => list.map((x) => (x.key === p.key ? { ...x, failed: false } : x)));
    deliver(p);
  };

  // My message is read once the other side opened the thread after it, or answered it
  const statusOf = (m: ThreadBubble, index: number): Status | null => {
    if (!receipt || m.from !== mySide) return null;
    const answered = messages.slice(index + 1).some((x) => x.from !== mySide);
    const seen = !receipt.unread || (!!receipt.readAt && receipt.readAt >= m.sentAt);
    return answered || seen ? "read" : "sent";
  };

  const rows: { key: string; bubble: ThreadBubble; status: Status | null; pending?: Pending }[] = [
    ...messages.map((m, i) => ({ key: m.id, bubble: m, status: statusOf(m, i) })),
    ...shownPending.map((p) => ({
      key: `p${p.key}`,
      bubble: { id: `p${p.key}`, from: mySide, text: p.text, sentAt: new Date(p.at).toISOString() },
      status: (p.failed ? "failed" : p.sent ? "sent" : "sending") as Status,
      pending: p,
    })),
  ];

  return (
    <div className="flex flex-col gap-2.5 min-h-0">
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        className="flex flex-col overflow-y-auto overscroll-contain max-h-[58vh] min-h-[240px] bg-cream border border-line rounded-[16px] px-2.5 md:px-4 py-4"
      >
        {rows.length === 0 ? (
          emptyText && <p className="m-auto max-w-[30ch] text-sm text-muted text-center leading-relaxed">{emptyText}</p>
        ) : rows.map((row, i) => {
          const m = row.bubble;
          const prev = rows[i - 1]?.bubble;
          const next = rows[i + 1]?.bubble;
          const day = bakuDay(m.sentAt);
          const newDay = !prev || bakuDay(prev.sentAt) !== day;
          const joinsPrev = !newDay && prev!.from === m.from && author(prev!) === author(m) && Date.parse(m.sentAt) - Date.parse(prev!.sentAt) < GROUP_GAP_MS;
          const joinsNext = !!next && bakuDay(next.sentAt) === day && next.from === m.from && author(next) === author(m) && Date.parse(next.sentAt) - Date.parse(m.sentAt) < GROUP_GAP_MS;
          const mine = m.from === mySide;
          const who = m.sender ?? (labels ? m.senderLabel : undefined);
          return (
            <div key={row.key} className="flex flex-col">
              {newDay && (
                <div className={`self-center ${i === 0 ? "mb-3" : "my-4"} px-3 py-1 rounded-full bg-white border border-line text-[12px] font-bold text-muted`}>
                  {dayLabel(day)}
                </div>
              )}
              {who && !joinsPrev && (
                <div className={`text-[12px] font-bold text-goldtext px-3 mt-2 -mb-1 ${mine ? "self-end" : "self-start"}`}>{who}</div>
              )}
              <div
                className={`relative max-w-[82%] px-3.5 pt-2 pb-1.5 text-[15px] leading-snug whitespace-pre-line break-words rounded-[18px] ${
                  joinsPrev ? "mt-0.5" : "mt-2"
                } ${
                  mine
                    ? `self-end bg-forest text-white ${joinsNext ? "" : "rounded-br-[6px]"} ${row.status === "failed" ? "opacity-70" : ""}`
                    : `self-start bg-white text-ink border border-line ${joinsNext ? "" : "rounded-bl-[6px]"}`
                }`}
              >
                {m.text}
                <span className={`float-right inline-flex items-center gap-1 ml-3 mt-1.5 -mb-0.5 text-[11px] tabular-nums ${mine ? "text-white/70" : "text-muted"}`}>
                  {bakuTime(m.sentAt)}
                  {row.status && <Tick status={row.status} />}
                </span>
              </div>
              {row.status === "failed" && row.pending && (
                <button
                  type="button"
                  onClick={() => retry(row.pending!)}
                  className="self-end mt-1 px-1 text-[12px] font-bold text-danger"
                >
                  Göndərilmədi. Yenidən cəhd et
                </button>
              )}
            </div>
          );
        })}
      </div>

      {locked && (
        <div className="flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-[16px] border border-dashed border-field bg-sand text-[13px] text-muted text-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" className="shrink-0">
            <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" />
          </svg>
          {locked}
        </div>
      )}
      {onSend && !locked && (
        <form
          onSubmit={(e) => { e.preventDefault(); submit(); }}
          className="flex items-end gap-2"
        >
          <label className="sr-only" htmlFor="thread-reply">Mesaj</label>
          <textarea
            id="thread-reply"
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={1}
            maxLength={MAX_THREAD_MESSAGE_LENGTH}
            placeholder={placeholder || "Mesaj yaz"}
            className="flex-1 min-w-0 min-h-[44px] max-h-[132px] resize-none rounded-[22px] border border-field bg-cream px-4 py-[10px] text-[16px] leading-snug text-ink placeholder:text-muted/70 focus:outline-none focus:border-forest focus:bg-white"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            aria-label="Göndər"
            className="press shrink-0 w-11 h-11 rounded-full grid place-items-center bg-forest text-white disabled:bg-track disabled:text-muted transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4.5 12 3 4.5 21 12 3 19.5Z" /><path d="M4.5 12H11" />
            </svg>
          </button>
        </form>
      )}
    </div>
  );
}

function Tick({ status }: { status: Status }) {
  if (status === "sending") {
    return (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-label="Göndərilir" role="img">
        <circle cx="8" cy="8" r="6" /><path d="M8 4.8V8l2 1.4" />
      </svg>
    );
  }
  if (status === "failed") {
    return (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-label="Göndərilmədi" role="img">
        <circle cx="8" cy="8" r="6" /><path d="M8 4.8v3.6M8 11h0" />
      </svg>
    );
  }
  const read = status === "read";
  return (
    <svg
      width="17"
      height="12"
      viewBox="0 0 18 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label={read ? "Oxundu" : "Çatdı"}
      role="img"
      className={read ? "text-sky-300" : ""}
    >
      <path d={read ? "M1.5 6.5 4.5 9.5 10.5 2.5" : "M3.5 6.5 6.5 9.5 12.5 2.5"} />
      {read && <path d="M8 9.2 8.3 9.5 14.3 2.5" />}
    </svg>
  );
}
