"use client";

// The meal side of the reader: the list of ayah meals for a page, the areas laid over the mushaf
// image (hold an ayah for its menu), the small "Meal / Dinlə" menu, the sheet with one ayah's meal
// and the player bar for the recitation.
import { useEffect, useRef, useState } from "react";
import { surahName } from "@/lib/quran";
import { LINE_HEIGHT, LINE_TOP, PAGE_IMAGE } from "@/lib/sajdah";
import { mealFor, type MealAyah, type MealEntry, type MealPage } from "@/lib/meal";
import type { Player } from "@/lib/ayahAudio";
import { IconClose } from "@/components/ui";

const HOLD_MS = 450;
const MOVE_PX = 10;

type Key = { s: number; a: number } | null;
const same = (k: Key, s: number, a: number) => !!k && k.s === s && k.a === a;
const inEntry = (k: Key, m: MealEntry) => !!k && k.s === m.s && k.a >= m.a && k.a <= (m.to ?? m.a);

const ayahLabel = (m: MealEntry) => (m.to && m.to !== m.a ? `${m.a}–${m.to}` : String(m.a));

// Press and hold: calls back after HOLD_MS unless the finger moves (a scroll or a swipe) or lifts.
// `held` is set so the click that ends the hold can be ignored by the page.
function useHold(held: React.MutableRefObject<boolean>) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return (fire: (x: number, y: number) => void) => ({
    onPointerDown: (e: React.PointerEvent) => {
      held.current = false;
      const x = e.clientX, y = e.clientY;
      start.current = { x, y };
      cancel();
      timer.current = setTimeout(() => {
        held.current = true;
        if (navigator.vibrate) navigator.vibrate(15);
        fire(x, y);
      }, HOLD_MS);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (start.current && (Math.abs(e.clientX - start.current.x) > MOVE_PX || Math.abs(e.clientY - start.current.y) > MOVE_PX)) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });
}

function Explanation({ paragraphs, id }: { paragraphs: string[]; id: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="press self-start min-h-[36px] px-3 rounded-full bg-mint text-forest text-[13px] font-bold inline-flex items-center gap-1.5"
      >
        Açıqlama
        <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div id={id} className="rounded-xl bg-[#F6F1E3] px-3 py-2.5 text-[14px] leading-relaxed text-sidebartext flex flex-col gap-2 select-text" onClick={(e) => e.stopPropagation()}>
          {paragraphs.map((p, i) => <p key={i} className="m-0">{p}</p>)}
        </div>
      )}
    </>
  );
}

function MealText({ m }: { m: MealEntry }) {
  if (!m.m) return <p className="m-0 text-[14px] text-muted italic">Bu ayənin məalı mənbə kitabda yoxdur.</p>;
  return (
    <p className="m-0 text-[16px] leading-[1.65] text-ink">
      {m.m}
      {m.r && <span className="ml-1 text-[12px] text-sidebarmuted whitespace-nowrap">{m.r}</span>}
    </p>
  );
}

// Every meal on the page, in reading order, with a surah heading where a surah begins.
// Holding a card opens its menu; the card being recited is lit and kept in view.
export function MealList({
  data, failed, held, selected, playing, onHold,
}: {
  data: MealPage | null;
  failed: boolean;
  held: React.MutableRefObject<boolean>;
  selected: Key;
  playing: Key;
  onHold: (s: number, a: number, x: number, y: number) => void;
}) {
  const hold = useHold(held);
  const playingRef = useRef<HTMLElement | null>(null);
  const playingId = playing ? `${playing.s}:${playing.a}` : "";
  useEffect(() => {
    playingRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [playingId]);
  if (failed) return <p className="m-0 p-6 text-center text-[14px] text-muted">Meal yüklənmədi. İnterneti yoxla və səhifəni yenidən aç.</p>;
  if (!data) return <p className="m-0 p-6 text-center text-[14px] text-muted">Meal yüklənir...</p>;
  return (
    <div className="w-full max-w-[720px] mx-auto px-3 flex flex-col gap-2.5">
      {data.meal.map((m, i) => {
        const prev = data.meal[i - 1];
        const heading = !prev || prev.s !== m.s;
        const isPlaying = inEntry(playing, m);
        const isSelected = inEntry(selected, m);
        return (
          <div key={`${m.s}:${m.a}`} className="flex flex-col gap-2.5">
            {heading && (
              <div className="pt-1 text-center font-display text-[17px] text-goldtext">
                {surahName(m.s)}
              </div>
            )}
            <article
              ref={isPlaying ? (el) => { playingRef.current = el; } : undefined}
              {...hold((x, y) => onHold(m.s, m.a, x, y))}
              className={`rounded-2xl px-3.5 py-3 flex flex-col gap-2 border transition-colors motion-reduce:transition-none ${
                isPlaying ? "bg-[#FBF1D9] border-gold" : isSelected ? "bg-white border-[#2FBF71] shadow-[0_0_0_2px_rgba(47,191,113,0.3)]" : "bg-white border-[#EFE7D2]"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span className="shrink-0 min-w-[30px] h-[30px] px-1 rounded-full border-[1.5px] border-leaf text-goldtext text-[12px] font-extrabold flex items-center justify-center tabular-nums">
                  {ayahLabel(m)}
                </span>
                <div className="min-w-0 flex-1 flex flex-col gap-2 pt-0.5">
                  <MealText m={m} />
                  {m.e && m.e.length > 0 && <Explanation paragraphs={m.e} id={`exp-${m.s}-${m.a}`} />}
                </div>
              </div>
            </article>
          </div>
        );
      })}
      <p className="m-0 pt-1 text-center text-[11.5px] text-muted">Suat Yıldırım meali · qiraət: Səd əl-Ğamidi</p>
    </div>
  );
}

// Transparent areas over the page image, one per ayah. Holding one opens its menu; a plain tap
// passes through to the page (bars) and a swipe still turns it.
export function AyahZones({
  ayahs, selected, playing, onHold, held,
}: {
  ayahs: MealAyah[];
  selected: Key;
  playing: Key;
  onHold: (s: number, a: number, x: number, y: number) => void;
  held: React.MutableRefObject<boolean>;
}) {
  const { width: W, height: H } = PAGE_IMAGE;
  const hold = useHold(held);
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-0 w-full h-full"
      onContextMenu={(e) => e.preventDefault()}
    >
      {ayahs.map((ay) => {
        const lit = same(playing, ay.s, ay.a) ? { fill: "#E2B85C", op: 0.38 } : same(selected, ay.s, ay.a) ? { fill: "#2FBF71", op: 0.22 } : null;
        return (ay.z || []).map(([line, from, to], i) => (
          <rect
            key={`${ay.s}:${ay.a}:${i}`}
            x={from * W}
            y={(LINE_TOP + (line - 1) * LINE_HEIGHT) * H}
            width={(to - from) * W}
            height={LINE_HEIGHT * H}
            rx={10}
            fill={lit ? lit.fill : "transparent"}
            fillOpacity={lit ? lit.op : 1}
            style={{ pointerEvents: "all" }}
            {...hold((x, y) => onHold(ay.s, ay.a, x, y))}
          />
        ));
      })}
    </svg>
  );
}

// The small menu over a held ayah
export function AyahMenu({
  x, y, onMeal, onPlay, onClose,
}: {
  x: number;
  y: number;
  onMeal?: () => void;
  onPlay: () => void;
  onClose: () => void;
}) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    // The finger is still down when the menu opens; iPhone would carry on into selecting the
    // word under it ("Meal") with its Copy / Translate bar, so any selection is dropped
    const unselect = () => { const sel = document.getSelection(); if (sel && !sel.isCollapsed) sel.removeAllRanges(); };
    unselect();
    document.addEventListener("keydown", onKey);
    document.addEventListener("selectionchange", unselect);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("selectionchange", unselect); };
  }, [onClose]);
  const left = typeof window === "undefined" ? x : Math.min(Math.max(x, 100), window.innerWidth - 100);
  const top = Math.max(y - 64, 70);
  const item = "press min-h-[44px] px-4 rounded-[10px] text-[14px] font-extrabold text-white inline-flex items-center gap-2 hover:bg-white/10";
  return (
    <div className="absolute inset-0 z-20 select-none [-webkit-touch-callout:none]" onContextMenu={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div
        role="menu"
        onClick={(e) => e.stopPropagation()}
        style={{ left, top }}
        className="absolute -translate-x-1/2 flex items-stretch gap-1 p-1 rounded-[14px] bg-tile shadow-[0_8px_24px_rgba(10,20,30,0.3)]"
      >
        {onMeal && (
          <>
            <button ref={first} type="button" role="menuitem" onClick={onMeal} className={item}>
              <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20" /></svg>
              Meal
            </button>
            <span aria-hidden="true" className="w-px my-2 bg-white/20" />
          </>
        )}
        <button ref={onMeal ? undefined : first} type="button" role="menuitem" onClick={onPlay} className={item}>
          <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 4.5v15l12-7.5z" /></svg>
          Dinlə
        </button>
      </div>
    </div>
  );
}

// One ayah's meal over the page, from the bottom
export function AyahSheet({
  data, s, a, onClose, onPlay,
}: {
  data: MealPage;
  s: number;
  a: number;
  onClose: () => void;
  onPlay: () => void;
}) {
  const m = mealFor(data, s, a);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="absolute inset-0 z-20 flex items-end justify-center bg-[rgba(10,20,30,0.35)]"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ayah-sheet-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[720px] max-h-[75%] overflow-y-auto bg-white rounded-t-[22px] px-4 pt-2.5 pb-[max(18px,env(safe-area-inset-bottom))] flex flex-col gap-2.5 shadow-bar select-text"
      >
        <div aria-hidden="true" className="self-center w-[42px] h-[5px] rounded-full bg-line" />
        <div className="flex items-center gap-2.5">
          <h2 id="ayah-sheet-title" className="m-0 flex-1 font-display font-normal text-[19px] text-ink">
            {surahName(s)} · {m ? ayahLabel(m) : a}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Bağla"
            className="press shrink-0 w-10 h-10 rounded-full bg-sand flex items-center justify-center text-ink"
          >
            <IconClose size={18} />
          </button>
        </div>
        {m ? <MealText m={m} /> : <p className="m-0 text-[14px] text-muted">Bu ayənin məalı tapılmadı.</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onPlay} className="press min-h-[42px] px-4 rounded-xl bg-forest text-white text-[14px] font-extrabold inline-flex items-center gap-2">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M7 4.5v15l12-7.5z" /></svg>
            Ayəni dinlə
          </button>
        </div>
        {m?.e && m.e.length > 0 && <Explanation paragraphs={m.e} id={`sheet-exp-${m.s}-${m.a}`} />}
        <p className="m-0 text-[11.5px] text-muted">Suat Yıldırım meali</p>
      </div>
    </div>
  );
}

// The recitation player: play/pause, what is playing, how far along, close
export function PlayerBar({ player, raised }: { player: Player; raised: boolean }) {
  const t = player.current;
  if (!t) return null;
  const total = player.queue.filter((x) => !x.basmala).length;
  const done = player.queue.slice(0, player.index + 1).filter((x) => !x.basmala).length;
  const label = player.failed
    ? "Səs yüklənmədi. İnterneti yoxla."
    : t.basmala ? "Bəsmələ" : `${surahName(t.s)} · ayə ${t.a}`;
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`absolute inset-x-3 z-10 mx-auto max-w-[520px] flex items-center gap-3 rounded-2xl bg-tile text-white px-3 py-2.5 shadow-bar transition-[bottom] duration-200 motion-reduce:transition-none ${
        raised ? "bottom-[calc(max(10px,env(safe-area-inset-bottom))+88px)]" : "bottom-[max(12px,env(safe-area-inset-bottom))]"
      }`}
    >
      <button
        type="button"
        onClick={player.toggle}
        aria-label={player.playing ? "Dayandır" : "Davam et"}
        className="press shrink-0 w-11 h-11 rounded-full bg-gold text-[#3a2a08] flex items-center justify-center"
      >
        {player.playing ? (
          <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M7 4.5v15l12-7.5z" /></svg>
        )}
      </button>
      <div className="flex-1 min-w-0" aria-live="polite">
        <div className="text-[13.5px] font-bold truncate">{label}</div>
        <div className="mt-1.5 h-1 rounded-full bg-white/20 overflow-hidden" aria-hidden="true">
          <div className="h-full bg-gold transition-[width] duration-300" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
      </div>
      <span className="shrink-0 text-[12px] text-onforest tabular-nums">{done} / {total}</span>
      <button
        type="button"
        onClick={player.stop}
        aria-label="Bağla"
        className="press shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-onforest hover:bg-white/10"
      >
        <IconClose size={18} />
      </button>
    </div>
  );
}
