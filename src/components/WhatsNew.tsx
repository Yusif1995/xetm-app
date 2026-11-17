"use client";

// "Yeniliklər": after an update, full-screen slides about what changed, once per device.
// The newest release in RELEASES is shown until the member closes it; its id is then kept in
// localStorage, so the next release (a new id) shows again.
import { useEffect, useRef, useState } from "react";
import { RELEASES, type ReleaseArt } from "@/lib/releases";
import { LINE_HEIGHT, LINE_TOP, PAGE_IMAGE } from "@/lib/sajdah";
import "./whatsNew.css";

const SEEN_KEY = "xetm-seen-release";

// Where ayahs 17-24 sit on page 3 (as in public/meal/3.json): [line, from, to]
const PAGE3: [number, [number, number, number][]][] = [
  [17, [[1, 0, 1], [2, 0.2, 1]]], [18, [[2, 0, 0.2], [3, 0.585, 1]]], [19, [[3, 0, 0.585], [4, 0, 1], [5, 0.353, 1]]],
  [20, [[5, 0, 0.353], [6, 0, 1], [7, 0, 1], [8, 0.614, 1]]], [21, [[8, 0, 0.614], [9, 0.113, 1]]],
  [22, [[9, 0, 0.113], [10, 0, 1], [11, 0, 1], [12, 0.686, 1]]], [23, [[12, 0, 0.686], [13, 0, 1], [14, 0.613, 1]]],
  [24, [[14, 0, 0.613], [15, 0.011, 1]]],
];

function Zones({ lit }: { lit?: number }) {
  const { width: W, height: H } = PAGE_IMAGE;
  return (
    <div className="wn-zones">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {PAGE3.map(([a, parts]) => parts.map(([line, from, to], i) => (
          <rect
            key={`${a}-${i}`}
            className={`wn-z${a}`}
            x={from * W}
            y={(LINE_TOP + (line - 1) * LINE_HEIGHT) * H}
            width={(to - from) * W}
            height={LINE_HEIGHT * H}
            rx={10}
            fill={lit === a ? "#E2B85C" : "transparent"}
            fillOpacity={lit === a ? 0.42 : 1}
          />
        )))}
      </svg>
    </div>
  );
}

// A value that steps every `ms` through 0..n-1 while the slide is shown
function useStep(n: number, ms: number) {
  const [k, setK] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setK((v) => (v + 1) % n), ms);
    return () => clearInterval(t);
  }, [n, ms]);
  return k;
}

const CheckSvg = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
);

function ListenArt() {
  const k = useStep(8, 900);
  const a = 17 + k;
  return (
    <div className="wn-mini">
      <div className="wn-pg" />
      <Zones lit={a} />
      <div className="wn-player"><span className="pp" /><span>Ayə {a}</span><span className="tr"><i style={{ width: `${((k + 1) / 8) * 100}%` }} /></span></div>
    </div>
  );
}

function NextJuzArt() {
  const k = useStep(21, 280);
  const r = k / 20;
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div
        className="absolute left-1/2 top-1/2 aspect-square rounded-full -translate-x-1/2 -translate-y-1/2 transition-[width] duration-500"
        style={{ width: `${r * 170}%`, background: "radial-gradient(circle, #2FBF71 0%, rgba(47,191,113,0.6) 45%, rgba(47,191,113,0) 72%)" }}
      />
      <div className="relative text-center text-[#073B22] transition-[opacity,filter] duration-500" style={{ opacity: r * r, filter: `blur(${((1 - r) * 5).toFixed(1)}px)` }}>
        <div className="font-display text-[44px] leading-tight">Cüz 5</div>
        <div className="text-[13px] font-bold">2-ci xətm · 20 səhifə</div>
      </div>
      <div className="absolute right-3.5 top-3.5 bg-white rounded-full px-3 py-0.5 text-[13px] font-extrabold tabular-nums">{Math.round(r * 100)}%</div>
    </div>
  );
}

// Each feature acted out on the real page, in the reader's colours
function Art({ art }: { art: ReleaseArt }) {
  switch (art) {
    case "meal":
      return (
        <div className="wn-mini wn-meal" aria-hidden="true">
          <div className="wn-pg" />
          <div className="wn-cards">
            <div className="wn-card"><span className="n">20</span><span>Şimşek nerdeyse gözlerini köreltecek. Önlerini aydınlattı mı ışığında yürürler...</span></div>
            <div className="wn-card"><span className="n">21</span><span>Ey insanlar! Hem sizi, hem de sizden önceki insanları yaratan Rabbinize ibadet ediniz...<br /><em>Açıqlama ▾</em></span></div>
            <div className="wn-card"><span className="n">22</span><span>O Rabbinize ki yeryüzünü size bir döşek, göğü de bir kubbe yaptı...<br /><em>Açıqlama ▾</em></span></div>
          </div>
          <div className="wn-chip"><span className="k1">Mushaf</span><span className="k2">Meal</span></div>
        </div>
      );
    case "listen":
      return <div aria-hidden="true"><ListenArt /></div>;
    case "hold":
      return (
        <div className="wn-mini wn-hold" aria-hidden="true">
          <div className="wn-pg" />
          <Zones />
          <div className="wn-finger" />
          <div className="wn-menu"><span>📖 Meal</span><span>▶ Dinlə</span></div>
          <div className="wn-sheet"><b>Əl-Bəqərə · 21</b>Ey insanlar! Hem sizi, hem de sizden önceki insanları yaratan Rabbinize ibadet ediniz. Böyle yapmakla her türlü zarardan korunmayı ümid edebilirsiniz.</div>
        </div>
      );
    case "toolbar":
      return (
        <div className="wn-mini" aria-hidden="true">
          <div className="wn-pg" />
          <div className="wn-tap" />
          <div className="wn-tb-top">✕ <span>Cüz 1 · səhifə 3</span><span className="ring" /></div>
          <div className="wn-tb-bot"><i /><i /><div className="wn-tb-mid"><CheckSvg /></div><i /><i /></div>
        </div>
      );
    case "nextJuz":
      return <div aria-hidden="true"><NextJuzArt /></div>;
    case "sideways":
      return (
        <div className="wn-mini wn-side" aria-hidden="true">
          <div className="wn-pg" />
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
          <Art key={i} art={slide.art} />
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
