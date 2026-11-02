"use client";

// Motion between the main screens. Every screen mounts its own AppLayout, so the screen we came from
// is remembered in sessionStorage: content slides in from the side we are travelling towards, a faint
// gold star opens and fades in the middle, and the tab bar's pill glides over from the previous tab.
import { animate, useReducedMotion } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { starPath } from "./ornament";

const KEY = "xetm:lastNav";
const EASE = [0.22, 1, 0.36, 1] as const;

// The screen we arrived from (read once per screen), and remember this one for the next screen
export function useNavFrom(current: string): string | null {
  const [from] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try { return sessionStorage.getItem(KEY); } catch { return null; }
  });
  useEffect(() => {
    try { sessionStorage.setItem(KEY, current); } catch { /* private mode */ }
  }, [current]);
  return from;
}

export function PageTransition({ from, current, order, children }: { from: string | null; current: string; order: string[]; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const veil = useRef<SVGSVGElement>(null);
  const reduce = useReducedMotion();

  useLayoutEffect(() => {
    const a = from ? order.indexOf(from) : -1;
    const b = order.indexOf(current);
    if (reduce || a < 0 || b < 0 || a === b || !ref.current) return;
    const dir = b > a ? 1 : -1;
    animate(ref.current, { opacity: [0, 1], x: [24 * dir, 0] }, { duration: 0.5, ease: EASE });
    if (veil.current) {
      animate(veil.current, { opacity: [0.5, 0], scale: [0.6, 1.6], rotate: [0, 45] }, { duration: 0.7, ease: "easeOut" });
    }
    // Runs once per screen: from and order are fixed for its lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <svg
        ref={veil}
        aria-hidden="true"
        viewBox="-60 -60 120 120"
        className="fixed left-1/2 top-1/2 -ml-[60px] -mt-[60px] w-[120px] h-[120px] pointer-events-none z-30 opacity-0"
      >
        <path d={starPath(56, 42)} fill="none" stroke="#A9823A" strokeWidth={1.2} />
      </svg>
      <div ref={ref}>{children}</div>
    </>
  );
}

// Mint pill behind the active tab's icon; glides over from the tab we came from
export function TabPill({ items, current, from }: { items: string[]; current: string; from: string | null }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const index = items.indexOf(current);
  const pct = (i: number) => `${(i / items.length) * 100}%`;

  useLayoutEffect(() => {
    const a = from ? items.indexOf(from) : -1;
    if (reduce || !ref.current || a < 0 || index < 0 || a === index) return;
    animate(ref.current, { left: [pct(a), pct(index)] }, { duration: 0.45, ease: EASE });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (index < 0) return null;
  return (
    <span
      ref={ref}
      aria-hidden="true"
      className="absolute top-2.5 h-9 grid place-items-center pointer-events-none"
      style={{ left: pct(index), width: `${100 / items.length}%` }}
    >
      <span className="w-16 h-9 rounded-full bg-mint" />
    </span>
  );
}
