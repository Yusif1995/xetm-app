"use client";
// One manager <-> member conversation as chat bubbles, with an optional reply box.
// Used by the member (/mesajlar), the group creator (admin panel) and the app owner (read-only).
import { useEffect, useRef, useState } from "react";
import { relativeTimeAz } from "@/lib/dates";
import { MAX_THREAD_MESSAGE_LENGTH, type ThreadSide } from "@/lib/threads";
import { btn, inputCls } from "./ui";

export interface ThreadBubble {
  id: string;
  from: ThreadSide;
  text: string;
  sentAt: string;
  sender?: string; // shown above manager messages when several managers write
}

interface Props {
  messages: ThreadBubble[];
  mySide: ThreadSide;          // whose messages sit on the right
  emptyText: string;
  managerLabel?: string;       // caption for the manager side, e.g. "Qrup rəhbəri"
  memberLabel?: string;
  onSend?: (text: string) => Promise<void>;
  placeholder?: string;
}

export default function ThreadView({ messages, mySide, emptyText, managerLabel = "Qrup rəhbəri", memberLabel = "İştirakçı", onSend, placeholder }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const submit = async () => {
    if (!onSend || !text.trim()) return;
    setSending(true);
    setError(null);
    try {
      await onSend(text.trim());
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Göndərilmədi. İnterneti yoxla və yenidən cəhd et.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 min-h-0">
      <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[55vh] pr-1" role="log" aria-live="polite">
        {messages.length === 0 ? (
          emptyText && <p className="m-0 text-sm text-muted py-6 text-center">{emptyText}</p>
        ) : messages.map((m) => {
          const mine = m.from === mySide;
          const label = m.from === "manager" ? (m.sender || managerLabel) : memberLabel;
          return (
            <div key={m.id} className={`flex flex-col gap-1 max-w-[85%] ${mine ? "self-end items-end" : "self-start items-start"}`}>
              <div className="text-[11px] font-semibold text-muted px-1">
                {label} · {relativeTimeAz(new Date(m.sentAt).getTime())}
              </div>
              <div
                className={`rounded-card px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-line break-words ${
                  mine ? "bg-forest text-white" : "bg-sand text-ink"
                }`}
              >
                {m.text}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {onSend && (
        <form
          onSubmit={(e) => { e.preventDefault(); submit(); }}
          className="flex flex-col gap-2 border-t border-line pt-3"
        >
          <label className="sr-only" htmlFor="thread-reply">Mesaj</label>
          <textarea
            id="thread-reply"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={MAX_THREAD_MESSAGE_LENGTH}
            placeholder={placeholder}
            className={`${inputCls} py-3 resize-y`}
          />
          {error && <div className="text-sm font-semibold text-danger">{error}</div>}
          <button type="submit" disabled={sending || !text.trim()} className={btn.primary}>
            {sending ? "Göndərilir..." : "Göndər"}
          </button>
        </form>
      )}
    </div>
  );
}
