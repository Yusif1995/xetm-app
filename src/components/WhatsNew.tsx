"use client";

// "Yeniliklər": after an update, full-screen slides about what changed, once per device.
// The newest release in RELEASES is shown until the member closes it; its id is then kept in
// localStorage, so the next release (a new id) shows again.
import { useEffect, useRef, useState } from "react";
import { RELEASES, type ReleaseArt } from "@/lib/releases";

const SEEN_KEY = "xetm-seen-release";

function Lines({ n = 7 }: { n?: number }) {
  return (
    <div className="absolute inset-x-[12%] top-[10%] bottom-[26%] flex flex-col justify-between" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => <i key={i} className="block h-1.5 rounded-sm bg-[#3a2f1c] opacity-50" />)}
    </div>
  );
}

// Simple drawings of each feature, in the reader's colours
function Art({ art }: { art: ReleaseArt }) {
  switch (art) {
    case "meal":
      return (
        <div className="absolute inset-x-[10%] top-[12%] bottom-[18%] bg-white border border-[#EFE7D2] rounded-2xl p-[9%] flex flex-col gap-[5%]" aria-hidden="true">
          {[1, 2, 3, 4].map((i) => <i key={i} className="block h-1.5 rounded-sm bg-ink opacity-45" />)}
          <em className="block w-[38%] h-[18px] rounded-full bg-mint" />
          {[5, 6].map((i) => <i key={i} className="block h-1.5 rounded-sm bg-ink opacity-45" />)}
        </div>
      );
    case "listen":
      return (
        <>
          <Lines />
          <div className="absolute inset-x-[10%] top-[30%] h-[11%] rounded-md bg-[rgba(226,184,92,0.55)]" aria-hidden="true" />
          <div className="absolute inset-x-[6%] bottom-[6%] h-[12%] rounded-xl bg-tile flex items-center gap-2 px-2.5" aria-hidden="true">
            <span className="w-6 h-6 rounded-full bg-gold" />
            <span className="flex-1 h-[5px] rounded bg-white/25 overflow-hidden"><i className="block h-full w-[45%] bg-gold" /></span>
          </div>
        </>
      );
    case "hold":
      return (
        <>
          <Lines />
          <div className="absolute inset-x-[10%] top-[38%] h-[11%] rounded-md bg-[rgba(47,191,113,0.3)]" aria-hidden="true" />
          <div className="absolute left-1/2 top-[18%] -translate-x-1/2 bg-tile rounded-[10px] px-2 py-1.5 flex gap-1.5" aria-hidden="true">
            <i className="block w-11 h-3.5 rounded bg-white/75" />
            <i className="block w-11 h-3.5 rounded bg-white/75" />
          </div>
        </>
      );
    case "toolbar":
      return (
        <>
          <Lines n={6} />
          <div className="absolute inset-x-0 bottom-0 h-[20%] bg-[#FFFDF6] border-t border-[#EFE7D2] grid grid-cols-5 items-center" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => i === 2
              ? <span key={i} className="mx-auto -mt-8 w-12 h-12 rounded-full bg-gold shadow-[0_6px_16px_rgba(169,130,58,0.4)]" />
              : <span key={i} className="mx-auto w-5 h-5 rounded-md bg-muted/40" />)}
          </div>
        </>
      );
    case "nextJuz":
      return (
        <>
          <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 50%, #2FBF71 0%, rgba(47,191,113,0.55) 30%, rgba(47,191,113,0) 60%)" }} aria-hidden="true" />
          <div className="absolute inset-0 flex items-center justify-center font-display text-[44px] text-[#073B22]" aria-hidden="true">Cüz 5</div>
        </>
      );
    case "sideways":
      return (
        <div className="absolute inset-x-[10%] top-[26%] bottom-[26%] border-2 border-ink rounded-md bg-[#FFFDF6]" aria-hidden="true">
          <div className="absolute inset-x-[8%] inset-y-[18%] flex flex-col justify-between">
            {[1, 2, 3, 4, 5].map((i) => <i key={i} className="block h-1 rounded-sm bg-[#3a2f1c] opacity-50" />)}
          </div>
        </div>
      );
  }
}

export default function WhatsNew() {
  const release = RELEASES[0];
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const startX = useRef<number | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!release) return;
    let seen: string | null = null;
    try { seen = localStorage.getItem(SEEN_KEY); } catch { /* storage blocked: show it */ }
    if (seen !== release.id) setOpen(true);
  }, [release]);

  useEffect(() => { if (open) nextRef.current?.focus(); }, [open]);

  if (!open || !release) return null;
  const slides = release.slides;
  const slide = slides[i];
  const last = i === slides.length - 1;

  const close = () => {
    try { localStorage.setItem(SEEN_KEY, release.id); } catch { /* shows again next time */ }
    setOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="whats-new-title"
      className="fixed inset-0 z-[100] bg-[#FCFBF6] text-ink flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      onKeyDown={(e) => {
        if (e.key === "Escape") close();
        if (e.key === "ArrowRight" && i > 0) setI(i - 1);
        if (e.key === "ArrowLeft" && !last) setI(i + 1);
      }}
    >
      <div className="w-full max-w-[520px] mx-auto flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4">
          <span className="text-[12px] font-extrabold tracking-[0.06em] uppercase text-goldtext">Yeniliklər · {release.date}</span>
          <button type="button" onClick={close} className="press min-h-[44px] px-2 text-[14px] font-bold text-muted">Keç</button>
        </div>
        <div
          className="relative mx-5 mt-3 flex-1 min-h-[180px] rounded-3xl bg-[#FFF7E5] border border-[#EFE7D2] overflow-hidden touch-pan-y"
          onPointerDown={(e) => { startX.current = e.clientX; }}
          onPointerUp={(e) => {
            if (startX.current === null) return;
            const dx = e.clientX - startX.current;
            startX.current = null;
            if (dx < -40 && !last) setI(i + 1);
            if (dx > 40 && i > 0) setI(i - 1);
          }}
        >
          <Art art={slide.art} />
        </div>
        <div className="px-6 pt-5 pb-2 min-h-[150px] flex flex-col gap-1.5" aria-live="polite">
          <h2 id="whats-new-title" className="m-0 font-display font-normal text-[26px] leading-tight">{slide.title}</h2>
          <p className="m-0 text-[15px] leading-relaxed text-muted">{slide.text}</p>
        </div>
        <div className="flex items-center gap-3 px-5 pb-5 pt-2">
          <div className="flex-1 flex gap-1.5">
            {slides.map((s, k) => (
              <button
                key={s.title}
                type="button"
                aria-label={`${k + 1}-ci yenilik: ${s.title}`}
                aria-current={k === i}
                onClick={() => setI(k)}
                className={`h-2 rounded-full transition-[width] motion-reduce:transition-none ${k === i ? "w-6 bg-forest" : "w-2 bg-line"}`}
              />
            ))}
          </div>
          <button
            ref={nextRef}
            type="button"
            onClick={() => (last ? close() : setI(i + 1))}
            className="press min-h-[48px] px-6 rounded-[14px] bg-forest text-white text-[15px] font-extrabold"
          >
            {last ? "Başla" : "Növbəti"}
          </button>
        </div>
      </div>
    </div>
  );
}
