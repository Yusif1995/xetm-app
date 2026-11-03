"use client";

// Tezhip ornament: the mushaf-illumination pieces of the design system (title cartouche,
// mihrab card, ayah-marker page medallions, 8-point star). Gold leaf only ever draws lines here;
// it never fills a button or carries state.
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

// 8-point star (khatam) outline centred on 0,0: r = outer points, ri = inner corners
export function starPath(r: number, ri: number): string {
  let d = "";
  for (let k = 0; k < 16; k++) {
    const a = ((k * 22.5 - 90) * Math.PI) / 180;
    const rr = k % 2 ? ri : r;
    d += `${k ? "L" : "M"}${(Math.cos(a) * rr).toFixed(2)} ${(Math.sin(a) * rr).toFixed(2)}`;
  }
  return d + "Z";
}

export function StarMark({ size = 12, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="-6 -6 12 12" aria-hidden="true" className={className}>
      <path d={starPath(6, 3.6)} fill="currentColor" />
    </svg>
  );
}

// Page title set in a surah-header cartouche; its gold lines draw out when the screen opens
export function Cartouche({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const draw = (delay: number) =>
    reduce
      ? {}
      : { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { duration: 0.9, delay, ease: EASE } };
  return (
    <div className="relative mx-auto w-full max-w-[460px] h-[66px] grid place-items-center px-14">
      <svg viewBox="0 0 358 66" preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 w-full h-full overflow-visible">
        <path d="M34 33 54 6H304L324 33 304 60H54Z" className="fill-vellum" />
        <motion.path d="M34 33 54 6H304L324 33 304 60H54Z" fill="none" className="stroke-leaf" strokeWidth={1.1} vectorEffect="non-scaling-stroke" {...draw(0)} />
        <motion.path d="M42 33 58 11H300L316 33 300 55H58Z" fill="none" className="stroke-leaf" strokeWidth={1.1} vectorEffect="non-scaling-stroke" {...draw(0.1)} />
        <motion.path d="M0 33H22M336 33H358" fill="none" className="stroke-leaf" strokeWidth={1.1} vectorEffect="non-scaling-stroke" {...draw(0.3)} />
        <path d="M28 27 34 33 28 39 22 33ZM330 27 336 33 330 39 324 33Z" className="fill-leaf" />
      </svg>
      <motion.h1
        className="relative m-0 max-w-full truncate font-display font-normal text-[clamp(20px,6.6vw,30px)] md:text-[32px] leading-none tracking-[0.01em] text-ink"
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease: EASE }}
      >
        {children}
      </motion.h1>
    </div>
  );
}

// The one prominent card on a screen: vellum under a pointed mihrab arch, framed in a double gold line
export function MihrabCard({ children, className = "", ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLElement>) {
  const ref = useRef<HTMLElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const CAP = 28;
  const arch = (w: number, h: number, o: number, r: number) => {
    const c = w / 2;
    const apex = o * 1.5;
    const sh = CAP + o;
    const bottom = h + CAP - o;
    return `M${o} ${bottom - r}L${o} ${sh}C${w * 0.2} ${sh} ${c - 52} ${sh - 4} ${c - 17} ${apex + 9}L${c} ${apex}L${c + 17} ${apex + 9}C${c + 52} ${sh - 4} ${w * 0.8} ${sh} ${w - o} ${sh}L${w - o} ${bottom - r}Q${w - o} ${bottom} ${w - o - r} ${bottom}L${o + r} ${bottom}Q${o} ${bottom} ${o} ${bottom - r}Z`;
  };

  return (
    <section ref={ref} {...rest} className={`relative mt-7 rounded-b-hero bg-vellum shadow-card ${className}`}>
      {size && size.w > 0 && (
        <svg
          aria-hidden="true"
          className="absolute left-0 w-full pointer-events-none overflow-visible"
          style={{ top: -CAP, height: size.h + CAP }}
          viewBox={`0 0 ${size.w} ${size.h + CAP}`}
        >
          <path d={arch(size.w, size.h, 0, 20)} className="fill-vellum" style={{ filter: "drop-shadow(0 -2px 3px rgba(24,34,53,0.05))" }} />
          <motion.path
            d={arch(size.w, size.h, 8, 13)}
            fill="none"
            className="stroke-leaf"
            strokeWidth={1}
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, delay: 0.2, ease: EASE }}
          />
          <path d={arch(size.w, size.h, 12, 10)} fill="none" className="stroke-leaf" strokeWidth={0.8} opacity={0.4} />
        </svg>
      )}
      <div className="relative">{children}</div>
    </section>
  );
}

// A page of today's share as an ayah-marker medallion. Marked pages fill emerald and turn in.
export function PageMedal({
  page,
  state,
  href,
  index = 0,
  label,
}: {
  page: number;
  // "helped": a friend reads this page of your juz (dashed lapis ring)
  state: "done" | "next" | "open" | "helped";
  href: string;
  index?: number;
  label: string;
}) {
  const reduce = useReducedMotion();
  const star = state === "done"
    ? "fill-forest stroke-forest"
    : state === "next"
      ? "fill-mint stroke-forest"
      : state === "helped"
        ? "fill-donebg stroke-lapis"
        : "fill-white stroke-leaflight";
  return (
    <Link
      href={href}
      aria-label={label}
      className={`press relative h-14 grid place-items-center font-bold text-[14px] tabular-nums rounded-full ${
        state === "done" ? "text-white" : state === "next" ? "text-forest" : state === "helped" ? "text-lapis" : "text-muted"
      }`}
    >
      <motion.svg
        key={state}
        viewBox="-26 -26 52 52"
        aria-hidden="true"
        className="absolute w-[52px] h-[52px] overflow-visible"
        initial={reduce ? false : state === "done" ? { rotate: -45, scale: 0.85, opacity: 0 } : { scale: 0.7, opacity: 0 }}
        animate={{ rotate: 0, scale: 1, opacity: 1 }}
        transition={{ duration: 0.45, delay: Math.min(index, 20) * 0.02, ease: EASE }}
      >
        <circle r={24.5} fill="none" className={state === "done" ? "stroke-leaf" : "stroke-leaflight"} strokeWidth={0.8} />
        <path d={starPath(23, 19)} className={star} strokeWidth={state === "next" ? 1.8 : 1.2} strokeDasharray={state === "helped" ? "3 2.5" : undefined} />
      </motion.svg>
      <span className="relative">{page}</span>
    </Link>
  );
}

// Thin gold rule with a centred lozenge: separates figures (ayah and hadith) inside a card
export function OrnamentRule({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 12" aria-hidden="true" className={`block w-24 h-3 overflow-visible ${className}`}>
      <path d="M0 6h38M58 6h38" fill="none" className="stroke-leaf" strokeWidth={1} />
      <path d="M48 0 54 6 48 12 42 6Z" className="fill-leaf" />
    </svg>
  );
}
