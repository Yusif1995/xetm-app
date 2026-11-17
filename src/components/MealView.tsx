"use client";

// The meal side of the reader: the list of ayah meals for a page, the tap areas laid over the
// mushaf image (hold an ayah to open its meal) and the sheet that shows one ayah's meal.
import { useEffect, useRef, useState } from "react";
import { surahName } from "@/lib/quran";
import { LINE_HEIGHT, LINE_TOP, PAGE_IMAGE } from "@/lib/sajdah";
import { mealFor, type MealAyah, type MealEntry, type MealPage } from "@/lib/meal";
import { IconClose } from "@/components/ui";

const HOLD_MS = 450;
const MOVE_PX = 10;

const ayahLabel = (m: MealEntry) => (m.to && m.to !== m.a ? `${m.a}–${m.to}` : String(m.a));

function Explanation({ paragraphs, id }: { paragraphs: string[]; id: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
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
    <p className="m-0 text-[16px] leading-[1.65] text-ink select-text">
      {m.m}
      {m.r && <span className="ml-1 text-[12px] text-sidebarmuted whitespace-nowrap">{m.r}</span>}
    </p>
  );
}

// Every meal on the page, in reading order, with a surah heading where a surah begins
export function MealList({ data, failed }: { data: MealPage | null; failed: boolean }) {
  if (failed) return <p className="m-0 p-6 text-center text-[14px] text-muted">Meal yüklənmədi. İnterneti yoxla və səhifəni yenidən aç.</p>;
  if (!data) return <p className="m-0 p-6 text-center text-[14px] text-muted">Meal yüklənir...</p>;
  return (
    <div className="w-full max-w-[720px] mx-auto px-3 flex flex-col gap-2.5">
      {data.meal.map((m, i) => {
        const prev = data.meal[i - 1];
        const heading = !prev || prev.s !== m.s;
        return (
          <div key={`${m.s}:${m.a}`} className="flex flex-col gap-2.5">
            {heading && (
              <div className="pt-1 text-center font-display text-[17px] text-goldtext">
                {surahName(m.s)}
              </div>
            )}
            <article className="bg-white border border-[#EFE7D2] rounded-2xl px-3.5 py-3 flex flex-col gap-2">
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
      <p className="m-0 pt-1 text-center text-[11.5px] text-muted">Suat Yıldırım meali</p>
    </div>
  );
}

// Transparent areas over the page image, one per ayah. Holding one opens that ayah; a plain tap
// passes through to the page (bars) and a swipe still turns it. `held` tells the page to ignore
// the click that ends a hold.
export function AyahZones({
  ayahs, selected, onHold, held,
}: {
  ayahs: MealAyah[];
  selected: { s: number; a: number } | null;
  onHold: (s: number, a: number) => void;
  held: React.MutableRefObject<boolean>;
}) {
  const { width: W, height: H } = PAGE_IMAGE;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-0 w-full h-full"
      onContextMenu={(e) => e.preventDefault()}
    >
      {ayahs.map((ay) => {
        const on = !!selected && selected.s === ay.s && selected.a === ay.a;
        return (ay.z || []).map(([line, from, to], i) => (
          <rect
            key={`${ay.s}:${ay.a}:${i}`}
            x={from * W}
            y={(LINE_TOP + (line - 1) * LINE_HEIGHT) * H}
            width={(to - from) * W}
            height={LINE_HEIGHT * H}
            rx={10}
            fill={on ? "#2FBF71" : "transparent"}
            fillOpacity={on ? 0.22 : 1}
            style={{ pointerEvents: "all" }}
            onPointerDown={(e) => {
              held.current = false;
              start.current = { x: e.clientX, y: e.clientY };
              cancel();
              timer.current = setTimeout(() => {
                held.current = true;
                if (navigator.vibrate) navigator.vibrate(15);
                onHold(ay.s, ay.a);
              }, HOLD_MS);
            }}
            onPointerMove={(e) => {
              if (start.current && (Math.abs(e.clientX - start.current.x) > MOVE_PX || Math.abs(e.clientY - start.current.y) > MOVE_PX)) cancel();
            }}
            onPointerUp={cancel}
            onPointerCancel={cancel}
            onPointerLeave={cancel}
          />
        ));
      })}
    </svg>
  );
}

// One ayah's meal over the page, from the bottom
export function AyahSheet({ data, s, a, onClose }: { data: MealPage; s: number; a: number; onClose: () => void }) {
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
        className="w-full max-w-[720px] max-h-[75%] overflow-y-auto bg-white rounded-t-[22px] px-4 pt-2.5 pb-[max(18px,env(safe-area-inset-bottom))] flex flex-col gap-2.5 shadow-bar"
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
        {m?.e && m.e.length > 0 && <Explanation paragraphs={m.e} id={`sheet-exp-${m.s}-${m.a}`} />}
        <p className="m-0 text-[11.5px] text-muted">Suat Yıldırım meali</p>
      </div>
    </div>
  );
}
