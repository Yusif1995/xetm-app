"use client";

// Desktop dashboard pieces: the figure strip that rides over the night band, panel cards, donut and
// line charts, the section tabs under each page title and the Gemini button. Colours follow DESIGN.md:
// emerald = yours / pressable, lapis = finished data, saffron = under way, gold only draws.
import type { CSSProperties } from "react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

// ---------------------------------------------------------------------------------------------
// Figure strip: four figures side by side with hairline dividers, one white panel

export interface StripItem {
  label: string;
  value: ReactNode;
  unit?: string;
  note?: ReactNode;
}

export function StatStrip({ items }: { items: StripItem[] }) {
  // Phone: a 2×2 card; desktop: one row with dividers
  return (
    <section
      aria-label="Xülasə"
      className="grid grid-cols-2 md:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))] bg-white rounded-[18px] shadow-panel md:py-6"
      style={{ "--cols": items.length } as CSSProperties}
    >
      {items.map((s, i) => (
        <div
          key={s.label}
          className={`px-4 py-3.5 md:px-7 md:py-0 flex flex-col min-w-0 ${i % 2 === 1 ? "border-l border-line" : ""} ${i >= 2 ? "border-t md:border-t-0 border-line" : ""} ${i > 0 && i % 2 === 0 ? "md:border-l" : ""}`}
        >
          <div className="text-[12px] md:text-[14px] font-bold text-muted md:text-ink truncate">{s.label}</div>
          <div className="mt-2 mb-1.5 md:mt-3.5 md:mb-3 flex items-baseline gap-1 md:gap-1.5 leading-none">
            <span className="text-[24px] md:text-[32px] font-extrabold tabular-nums text-ink">{s.value}</span>
            {s.unit && <span className="text-[13px] md:text-[16px] font-bold text-muted">{s.unit}</span>}
          </div>
          {s.note && <div className="text-[11.5px] md:text-[13px] text-muted truncate">{s.note}</div>}
        </div>
      ))}
    </section>
  );
}

// Small coloured figure inside a strip note ("12 qalıb", "+2")
export function Up({ children, tone = "good" }: { children: ReactNode; tone?: "good" | "warn" | "bad" }) {
  const cls = tone === "good" ? "text-juzdone" : tone === "warn" ? "text-juzprogress" : "text-danger";
  return (
    <span className={`inline-flex items-center gap-1 font-extrabold ${cls}`}>
      {tone === "good" && (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 19V5M6 11l6-6 6 6" />
        </svg>
      )}
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------------------------
// Panel card with a title row (title left, a small control right)

export function Panel({
  id, title, sub, action, children, className = "",
}: { id?: string; title: ReactNode; sub?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`scroll-mt-28 bg-white rounded-[18px] shadow-panel p-4 md:p-6 flex flex-col gap-4 md:gap-5 min-w-0 ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="m-0 text-[18px] font-extrabold text-ink leading-tight">{title}</h2>
          {sub && <div className="mt-1.5 text-[13px] text-muted">{sub}</div>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Donut with a raised white centre and a legend underneath

export interface DonutPart {
  label: string;
  value: number;
  color: string;
}

export function Donut({ parts, center, caption }: { parts: DonutPart[]; center: ReactNode; caption: string }) {
  const r = 60;
  const C = 2 * Math.PI * r;
  const total = parts.reduce((s, p) => s + p.value, 0);
  const shown = parts.filter((p) => p.value > 0);
  const gap = shown.length > 1 ? 3 : 0;
  let offset = 0;
  return (
    <div className="flex flex-col gap-5">
      <div className="relative h-[190px] grid place-items-center">
        <svg viewBox="0 0 170 170" className="w-[170px] h-[170px] -rotate-90 drop-shadow-[0_10px_14px_rgba(24,34,53,0.12)]" aria-hidden="true">
          {total === 0 ? (
            <circle r={r} cx={85} cy={85} fill="none" stroke="#E7E8E0" strokeWidth={26} />
          ) : (
            shown.map((p) => {
              const len = (p.value / total) * C;
              const el = (
                <circle
                  key={p.label}
                  r={r} cx={85} cy={85} fill="none" stroke={p.color} strokeWidth={26}
                  strokeDasharray={`${Math.max(len - gap, 0.01)} ${C}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += len;
              return el;
            })
          )}
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="w-24 h-24 rounded-full bg-white shadow-[0_4px_18px_rgba(24,34,53,0.1)] flex flex-col items-center justify-center text-center">
            <span className="text-[26px] font-extrabold leading-none tabular-nums text-ink">{center}</span>
            <span className="mt-1 text-[12px] text-muted">{caption}</span>
          </div>
        </div>
      </div>
      <ul className="m-0 p-0 list-none flex flex-col gap-3">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2.5 text-[14px] text-muted">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
            <span className="truncate">{p.label}</span>
            <span className="ml-auto font-extrabold text-ink tabular-nums">{p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Smooth line chart, one or two series, the last day highlighted

export interface LineSeries {
  label: string;
  color: string;
  values: number[];
}

function smoothPath(pts: [number, number][]): string {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const cx = (x0 + x1) / 2;
    d += ` C${cx} ${y0} ${cx} ${y1} ${x1} ${y1}`;
  }
  return d;
}

export function LineChart({ series, labels }: { series: LineSeries[]; labels: string[] }) {
  const W = 520, H = 230, L = 34, B = 26, T = 10;
  const top = Math.max(4, ...series.flatMap((s) => s.values));
  const step = Math.ceil(top / 4);
  const max = step * 4;
  const n = labels.length;
  const X = (i: number) => L + (n > 1 ? (i * (W - L - 12)) / (n - 1) : 0);
  const Y = (v: number) => T + (H - T - B) * (1 - v / max);
  const last = n - 1;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-4 text-[13px] font-bold text-muted">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`${series.map((s) => `${s.label}: ${s.values.join(", ")}`).join("; ")}`}>
        {[0, 1, 2, 3, 4].map((k) => (
          <g key={k}>
            <line x1={L} x2={W} y1={Y(k * step)} y2={Y(k * step)} stroke="#EEEFE9" />
            <text x={0} y={Y(k * step) + 4} fontSize={12} fill="#5E6675" fontWeight={700}>{k * step}</text>
          </g>
        ))}
        <rect x={X(last) - 14} y={T} width={28} height={H - T - B} rx={8} fill="#F1F2EC" />
        {series.map((s) => (
          <path key={s.label} d={smoothPath(s.values.map((v, i) => [X(i), Y(v)]))} fill="none" stroke={s.color} strokeWidth={2.4} strokeLinecap="round" />
        ))}
        {series[0] && (
          <circle cx={X(last)} cy={Y(series[0].values[last] || 0)} r={5} fill={series[0].color} stroke="#fff" strokeWidth={2} />
        )}
        {labels.map((l, i) => (
          <text key={i} x={X(i)} y={H - 4} fontSize={12} fill="#5E6675" fontWeight={700} textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"}>{l}</text>
        ))}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Section tabs under the page title (desktop): jump to a section of the page; the one in view is gold

export interface SectionTab {
  id: string;
  label: string;
}

export function SectionTabs({ tabs }: { tabs: SectionTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);

  useEffect(() => {
    const els = tabs.map((t) => document.getElementById(t.id)).filter((e): e is HTMLElement => !!e);
    if (els.length === 0) return;
    const onScroll = () => {
      // The last section whose top has passed the line under the sticky navigation
      let current = els[0].id;
      for (const el of els) {
        if (el.getBoundingClientRect().top <= 160) current = el.id;
      }
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) current = els[els.length - 1].id;
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [tabs]);

  return (
    <nav aria-label="Səhifənin bölmələri" className="flex flex-wrap justify-end gap-x-7 gap-y-1">
      {tabs.map((t) => (
        <a
          key={t.id}
          href={`#${t.id}`}
          onClick={(e) => {
            const el = document.getElementById(t.id);
            if (!el) return;
            e.preventDefault();
            el.scrollIntoView({ behavior: "smooth", block: "start" });
            setActive(t.id);
            history.replaceState(null, "", `#${t.id}`);
          }}
          aria-current={active === t.id ? "true" : undefined}
          className={`press min-h-[44px] inline-flex items-center text-[14px] font-semibold transition-colors ${
            active === t.id ? "text-gold" : "text-white/85 hover:text-white"
          }`}
        >
          {t.label}
        </a>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------------------------------------
// Floating Gemini button (bottom right, desktop): opens the app's AI helper panel (/admin/ai)

export function GeminiFab() {
  return (
    <Link
      href="/admin/ai"
      aria-label="AI köməkçi"
      title="AI köməkçi"
      className="press grid fixed right-4 md:right-8 bottom-[calc(env(safe-area-inset-bottom)+100px)] md:bottom-8 z-40 w-[54px] h-[54px] md:w-[58px] md:h-[58px] rounded-full bg-white place-items-center shadow-[0_14px_30px_-8px_rgba(24,34,53,0.35)] hover:scale-105 transition-transform"
    >
      <svg width="30" height="30" viewBox="0 0 28 28" aria-hidden="true">
        <defs>
          <linearGradient id="gemini-g" x1="4" y1="24" x2="24" y2="4" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#1C7DFF" />
            <stop offset="0.52" stopColor="#1C69FF" />
            <stop offset="1" stopColor="#F0DCD6" />
          </linearGradient>
        </defs>
        <path
          d="M14 28C14 26.06 13.63 24.24 12.88 22.54 12.15 20.84 11.15 19.36 9.89 18.11 8.64 16.85 7.16 15.85 5.46 15.12 3.76 14.37 1.94 14 0 14 1.94 14 3.76 13.64 5.46 12.91 7.16 12.16 8.64 11.15 9.89 9.89 11.15 8.64 12.15 7.16 12.88 5.46 13.63 3.76 14 1.94 14 0 14 1.94 14.36 3.76 15.09 5.46 15.84 7.16 16.85 8.64 18.11 9.89 19.36 11.15 20.84 12.16 22.54 12.91 24.24 13.64 26.06 14 28 14 26.06 14 24.24 14.37 22.54 15.12 20.84 15.85 19.36 16.85 18.11 18.11 16.85 19.36 15.84 20.84 15.09 22.54 14.36 24.24 14 26.06 14 28Z"
          fill="url(#gemini-g)"
        />
      </svg>
    </Link>
  );
}
