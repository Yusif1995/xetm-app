"use client";
// A short ayah, hadith or kind word about reading and steadiness, shown for a few seconds
// after the member marks pages as read ("Bu gün" and "Səhifələrim"). Tapping it keeps it open;
// it can be shared to a WhatsApp status as an image.
import { useCallback, useEffect, useRef, useState } from "react";
import { pickEncouragement, type Encouragement } from "@/lib/dailyContent";
import { renderShareImage, shareImage } from "@/lib/shareCard";
import { IconClose, IconShare } from "./ui";

const SHOW_MS = 5000;

const KIND_LABEL: Record<Encouragement["kind"], string> = {
  ayah: "Ayə",
  hadith: "Hədis",
  word: "Allah qəbul etsin",
};

export function useEncouragement() {
  const [item, setItem] = useState<Encouragement | null>(null);
  const [round, setRound] = useState(0);
  const [pinned, setPinned] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const close = useCallback(() => {
    stop();
    setItem(null);
    setPinned(false);
  }, []);

  const show = useCallback(() => {
    stop();
    setPinned(false);
    setItem((prev) => pickEncouragement(prev?.translation));
    setRound((r) => r + 1);
    timer.current = setTimeout(() => setItem(null), SHOW_MS);
  }, []);

  // Keep it open to read (or to share) until the member closes it
  const pin = useCallback(() => {
    stop();
    setPinned(true);
  }, []);

  // Another word; a card the member kept open stays open
  const next = useCallback(() => {
    if (!pinned) {
      show();
      return;
    }
    setItem((prev) => pickEncouragement(prev?.translation));
    setRound((r) => r + 1);
  }, [pinned, show]);

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

  const node = item
    ? <EncouragementCard key={round} item={item} pinned={pinned} onPin={pin} onClose={close} onNext={next} />
    : null;
  return { show, node };
}

function EncouragementCard({
  item,
  pinned,
  onPin,
  onClose,
  onNext,
}: {
  item: Encouragement;
  pinned: boolean;
  onPin: () => void;
  onClose: () => void;
  onNext: () => void;
}) {
  // The image is prepared as soon as the card appears, so the share sheet opens straight
  // from the tap (iPhone only allows it right after a tap)
  const image = useRef<Promise<Blob> | null>(null);
  const [shareState, setShareState] = useState<"idle" | "busy" | "downloaded" | "error">("idle");

  useEffect(() => {
    const p = renderShareImage(item);
    p.catch(() => undefined);
    image.current = p;
  }, [item]);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    onPin();
    setShareState("busy");
    try {
      const blob = await (image.current || renderShareImage(item));
      const result = await shareImage(blob);
      setShareState(result === "downloaded" ? "downloaded" : "idle");
    } catch (err) {
      console.error("Share failed:", err);
      setShareState("error");
    }
  };

  const stopAnd = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div className="fixed-layer fixed inset-x-3 bottom-[92px] md:bottom-8 md:left-auto md:right-8 md:w-[440px] z-50 pointer-events-none">
      <section
        role="status"
        aria-live="polite"
        aria-label="Təşviq"
        onClick={pinned ? undefined : onPin}
        className={`rise-in pointer-events-auto relative overflow-hidden bg-white border rounded-card shadow-bar p-5 pr-12 flex flex-col gap-2.5 ${
          pinned ? "border-forest/30" : "border-line cursor-pointer"
        }`}
      >
        <button
          type="button"
          onClick={stopAnd(onClose)}
          aria-label="Bağla"
          className="press absolute top-3 right-3 w-9 h-9 rounded-full text-muted hover:bg-sand flex items-center justify-center"
        >
          <IconClose size={18} />
        </button>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span className="text-[13px] font-bold text-goldtext">{KIND_LABEL[item.kind]}</span>
          {pinned ? (
            <span className="text-[12px] font-semibold text-donetext">Saxlanıldı, bağlayana qədər açıq qalacaq</span>
          ) : (
            <button
              type="button"
              onClick={stopAnd(onPin)}
              className="text-[12px] font-semibold text-muted underline-offset-4 hover:underline"
            >
              Oxumaq üçün toxun, saxlanılsın
            </button>
          )}
        </div>
        {item.text && (
          <p dir="rtl" lang="ar" className="m-0 font-amiri text-[22px] leading-[1.8] text-ink text-right">
            {item.text}
          </p>
        )}
        <p className="m-0 text-[16px] leading-relaxed font-semibold text-ink">{item.translation}</p>
        {item.source && <span className="text-[13px] text-muted">{item.source}</span>}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleShare}
            disabled={shareState === "busy"}
            className="press min-h-[40px] px-3.5 rounded-xl bg-forest text-white text-[13px] font-bold inline-flex items-center gap-2 hover:bg-forestpress disabled:bg-track disabled:text-muted"
          >
            <IconShare size={16} />
            {shareState === "busy" ? "Hazırlanır..." : "WhatsApp statusu"}
          </button>
          <button
            type="button"
            onClick={stopAnd(onNext)}
            className="press min-h-[40px] px-3 rounded-xl text-[13px] font-bold text-forest hover:bg-mint"
          >
            Başqa söz
          </button>
        </div>
        {shareState === "downloaded" && (
          <p className="m-0 text-[12px] text-muted">Şəkil yükləndi. WhatsApp-da Status → Şəkil ilə paylaşa bilərsən.</p>
        )}
        {shareState === "error" && (
          <p role="alert" className="m-0 text-[12px] font-semibold text-danger">Paylaşmaq alınmadı. Yenidən cəhd et.</p>
        )}
        {!pinned && (
          <span
            aria-hidden="true"
            className="countdown absolute left-0 bottom-0 h-1 w-full bg-done/60"
            style={{ animationDuration: `${SHOW_MS}ms` }}
          />
        )}
      </section>
    </div>
  );
}
