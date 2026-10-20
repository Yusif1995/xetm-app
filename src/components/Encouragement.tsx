"use client";
// A short ayah, hadith or kind word about reading and steadiness, shown for a few seconds
// after the member marks pages as read ("Bu gün" and "Səhifələrim").
import { useCallback, useEffect, useRef, useState } from "react";
import { pickEncouragement, type Encouragement } from "@/lib/dailyContent";
import { IconClose } from "./ui";

const SHOW_MS = 5000;

const KIND_LABEL: Record<Encouragement["kind"], string> = {
  ayah: "Ayə",
  hadith: "Hədis",
  word: "Allah qəbul etsin",
};

export function useEncouragement() {
  const [item, setItem] = useState<Encouragement | null>(null);
  const [round, setRound] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const close = useCallback(() => {
    stop();
    setItem(null);
  }, []);

  const show = useCallback(() => {
    stop();
    setItem((prev) => pickEncouragement(prev?.translation));
    setRound((r) => r + 1);
    timer.current = setTimeout(() => setItem(null), SHOW_MS);
  }, []);

  useEffect(() => stop, []);

  // Esc closes it like any other transient message
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [item, close]);

  const node = item ? <EncouragementCard key={round} item={item} onClose={close} onNext={show} /> : null;
  return { show, node };
}

function EncouragementCard({ item, onClose, onNext }: { item: Encouragement; onClose: () => void; onNext: () => void }) {
  return (
    <div className="fixed inset-x-3 bottom-[92px] md:bottom-8 md:left-auto md:right-8 md:w-[440px] z-50 pointer-events-none">
      <section
        role="status"
        aria-live="polite"
        aria-label="Təşviq"
        className="rise-in pointer-events-auto relative overflow-hidden bg-white border border-line rounded-card shadow-bar p-5 pr-12 flex flex-col gap-2.5"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Bağla"
          className="press absolute top-3 right-3 w-9 h-9 rounded-full text-muted hover:bg-sand flex items-center justify-center"
        >
          <IconClose size={18} />
        </button>
        <div className="text-[13px] font-bold text-goldtext">{KIND_LABEL[item.kind]}</div>
        {item.text && (
          <p dir="rtl" lang="ar" className="m-0 font-amiri text-[22px] leading-[1.8] text-ink text-right">
            {item.text}
          </p>
        )}
        <p className="m-0 text-[16px] leading-relaxed font-semibold text-ink">{item.translation}</p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {item.source ? <span className="text-[13px] text-muted">{item.source}</span> : <span />}
          <button
            type="button"
            onClick={onNext}
            className="press min-h-[36px] px-3 -mr-1 rounded-xl text-[13px] font-bold text-forest hover:bg-mint"
          >
            Başqa söz
          </button>
        </div>
        <span
          aria-hidden="true"
          className="countdown absolute left-0 bottom-0 h-1 w-full bg-done/60"
          style={{ animationDuration: `${SHOW_MS}ms` }}
        />
      </section>
    </div>
  );
}
