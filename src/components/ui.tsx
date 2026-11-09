// Shared UI primitives for the Xətm App design system (stroke icons, avatar, progress, chips).
import type { CSSProperties, InputHTMLAttributes, ReactNode } from "react";
import { SectionTabs, type SectionTab } from "./dash";

type IconProps = { size?: number; className?: string };

function Svg({ size = 20, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export const IconToday = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" /></Svg>
);
export const IconBook = (p: IconProps) => (
  <Svg {...p}><path d="M3 5.5C5.5 4.5 9 4.5 12 6.5c3-2 6.5-2 9-1V19c-2.5-1-6-1-9 1-3-2-6.5-2-9-1z" /><path d="M12 6.5V20" /></Svg>
);
export const IconGroup = (p: IconProps) => (
  <Svg {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5" /><path d="M16 4.8a3.5 3.5 0 010 6.4M18 14.8c1.8.7 3 2.4 3.5 5.2" /></Svg>
);
export const IconShield = (p: IconProps) => (
  <Svg {...p}><path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z" /><path d="M9 12l2 2 4-4" /></Svg>
);
export const IconLogout = (p: IconProps) => (
  <Svg {...p}><path d="M9 4H5v16h4" /><path d="M16 8l4 4-4 4M20 12H9" /></Svg>
);
export const IconBell = (p: IconProps) => (
  <Svg {...p}><path d="M6 17V11a6 6 0 0112 0v6l1.5 2h-15z" /><path d="M10 21h4" /></Svg>
);
export const IconMessage = (p: IconProps) => (
  <Svg {...p}><path d="M4 5.5A2.5 2.5 0 016.5 3h11A2.5 2.5 0 0120 5.5v9a2.5 2.5 0 01-2.5 2.5H10l-4.5 4v-4h0A1.5 1.5 0 014 15.5z" /><path d="M8 8.5h8M8 12h5" /></Svg>
);
export const IconChevronDown = (p: IconProps) => (
  <Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>
);
export const IconCheck = (p: IconProps) => (
  <Svg {...p}><path d="M5 12l5 5 9-10" /></Svg>
);
export const IconShare = (p: IconProps) => (
  <Svg {...p}><path d="M12 15V3M7.5 7.5L12 3l4.5 4.5" /><path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></Svg>
);
export const IconClose = (p: IconProps) => (
  <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>
);
export const IconSettings = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></Svg>
);
export const IconPlus = (p: IconProps) => (
  <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
);
export const IconLink = (p: IconProps) => (
  <Svg {...p}><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" /></Svg>
);
export const IconTrash = (p: IconProps) => (
  <Svg {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></Svg>
);
export const IconLayers = (p: IconProps) => (
  <Svg {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></Svg>
);
export const IconChart = (p: IconProps) => (
  <Svg {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Svg>
);
export const IconCalendar = (p: IconProps) => (
  <Svg {...p}><rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9.5h18M8 3v3M16 3v3" /></Svg>
);
export const IconSparkle = (p: IconProps) => (
  <Svg {...p}><path d="M12 3l1.9 5.8a2 2 0 001.3 1.3L21 12l-5.8 1.9a2 2 0 00-1.3 1.3L12 21l-1.9-5.8a2 2 0 00-1.3-1.3L3 12l5.8-1.9a2 2 0 001.3-1.3z" /></Svg>
);

// App logo: open book with crescent and star
export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle cx="20" cy="14" r="7.5" fill="#E2B85C" />
      <circle cx="23" cy="12.4" r="6.2" fill="#0A2C20" />
      <path d="M32 6.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z" fill="#E2B85C" />
      <path d="M7 26.5C12 25.2 18 26 23.25 29.2V40.5C18 37.6 12 36.8 7 38z" fill="#E2B85C" />
      <path d="M41 26.5C36 25.2 30 26 24.75 29.2V40.5C30 37.6 36 36.8 41 38z" fill="#E2B85C" />
      <path d="M11 30.2C14 29.8 17 30.3 19.5 31.4M11 33.8C14 33.4 17 33.9 19.5 35M37 30.2C34 29.8 31 30.3 28.5 31.4M37 33.8C34 33.4 31 33.9 28.5 35" stroke="#0A2C20" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function initialsOf(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function Avatar({ name, gold = false, size = 40 }: { name: string; gold?: boolean; size?: number }) {
  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
        gold ? "bg-progress text-progresstext" : "bg-sand text-ink"
      }`}
      style={{ width: size, height: size }}
    >
      {initialsOf(name)}
    </div>
  );
}

// Circular progress ring on a light card
export function ProgressRing({
  value,
  total,
  size = 148,
  caption,
}: { value: number; total: number; size?: number; caption?: string }) {
  const circumference = 2 * Math.PI * 52;
  const ratio = total > 0 ? Math.min(1, value / total) : 0;
  const big = size >= 120;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="52" fill="none" stroke="#E7E8E0" strokeWidth="10" />
        <circle
          cx="60" cy="60" r="52" fill="none" stroke="#23406B" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circumference.toFixed(2)}
          strokeDashoffset={(circumference * (1 - ratio)).toFixed(2)}
          transform="rotate(-90 60 60)"
          style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className={`font-extrabold leading-none text-ink tabular-nums ${big ? "text-[38px]" : "text-2xl"}`}>{value}</div>
        <div className={`text-muted ${big ? "text-[13px] mt-1" : "text-[11px] mt-0.5"}`}>{caption ?? `/ ${total} səhifə`}</div>
      </div>
    </div>
  );
}

// Horizontal progress bar on the light track. It fills from empty when it appears; a gold lozenge
// rides the end of the fill on bars of 8px and up (the leading edge of the reading).
export function Bar({
  ratio,
  color = "done",
  height = 8,
  dark = false,
  label,
}: { ratio: number; color?: "forest" | "accent" | "done" | "gold"; height?: number; dark?: boolean; label?: string }) {
  const fill = { forest: "bg-forest", accent: "bg-accent", done: "bg-done", gold: "bg-gold" }[color];
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  const marker = !dark && height >= 8 && pct > 0 && pct < 100;
  const lozenge = height + 4;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={`relative rounded-full ${dark ? "bg-[rgba(247,243,234,0.16)]" : "bg-track"}`}
      style={{ height, marginBlock: marker ? 2 : 0 }}
    >
      <div
        className={`bar-fill h-full rounded-full ${fill}`}
        style={{ width: `${pct}%`, minWidth: pct > 0 ? height : 0, transition: "width 0.6s cubic-bezier(0.22, 1, 0.36, 1)" }}
      />
      {marker && (
        <span
          aria-hidden="true"
          className="bar-lozenge absolute top-1/2 bg-leaf border-2 border-white rounded-[2px]"
          style={{ "--to": `${pct}%`, left: `${pct}%`, width: lozenge, height: lozenge, marginTop: -lozenge / 2, marginLeft: -lozenge / 2, transition: "left 0.6s cubic-bezier(0.22, 1, 0.36, 1)" } as CSSProperties}
        />
      )}
    </div>
  );
}

export type ChipTone = "done" | "progress" | "owner" | "pending" | "neutral" | "active";

export function Chip({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  const cls = {
    done: "bg-donebg text-donetext",
    progress: "bg-progress text-progresstext",
    owner: "bg-progress/60 text-goldtext",
    pending: "bg-progress text-progresstext",
    neutral: "bg-sand text-muted",
    active: "bg-mint text-forest",
  }[tone];
  return (
    <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-lg whitespace-nowrap ${cls}`}>
      {children}
    </span>
  );
}

// Page heading used at the top of every screen, on the night artwork band under the top bar: white
// inscriptional title, subtitle beneath. On the phone actions sit under the subtitle; on desktop
// they and the section tabs sit on the right
export function PageHeader({
  title, subtitle, actions, tabs, tight = false,
}: { title: string; subtitle?: ReactNode; actions?: ReactNode; tabs?: SectionTab[]; tight?: boolean }) {
  return (
    <>
      <header className="md:hidden relative -mx-4 px-4 pt-3 pb-1 flex flex-col gap-1">
        <div aria-hidden="true" className={`girih-tile-m absolute inset-x-0 -top-[88px] -z-10 pointer-events-none ${tight ? "-bottom-6" : "-bottom-[60px]"}`} />
        <h1 className="m-0 font-display font-normal text-[27px] leading-[1.25] pb-0.5 text-white">{title}</h1>
        {subtitle && <div className="text-[13px] text-nightmuted">{subtitle}</div>}
        {actions && <div className="mt-2.5 flex flex-wrap items-center gap-2.5">{actions}</div>}
      </header>
      <NightBandHeader title={title} subtitle={subtitle} actions={actions} tabs={tabs} tight={tight} />
    </>
  );
}

// Desktop page heading on the night band: title and subtitle on the left; actions and the section
// tabs (jump links to the parts of the page) on the right, along the bottom edge
export function NightBandHeader({
  title, subtitle, actions, tabs, tight = false,
}: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; tabs?: SectionTab[]; tight?: boolean }) {
  return (
    <header className="relative hidden md:flex min-h-[112px] items-end justify-between gap-8 pb-1">
      <NightBand tight={tight} />
      <div className="flex flex-col gap-2 min-w-0">
        <h1 className="m-0 font-display font-normal text-[40px] leading-[1.25] pb-1 text-white truncate">{title}</h1>
        {subtitle && <div className="text-[15px] text-nightmuted">{subtitle}</div>}
      </div>
      {(actions || tabs) && (
        <div className="flex flex-col items-end gap-3 shrink-0">
          {actions && <div className="flex flex-wrap items-center justify-end gap-2.5">{actions}</div>}
          {tabs && tabs.length > 0 && <SectionTabs tabs={tabs} />}
        </div>
      )}
    </header>
  );
}

// Full-width night tile band behind a desktop page heading. It starts right under the top navigation
// and runs 72px past the heading so the first panel rides over its lower edge; `tight` ends it where
// the content starts, for screens whose first element is plain text rather than a panel
export function NightBand({ tight = false }: { tight?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`girih-tile hidden md:block absolute -left-[100vw] -right-[100vw] -z-10 -top-9 pointer-events-none ${tight ? "-bottom-7" : "-bottom-[88px]"}`}
    />
  );
}

export function Card({ children, className = "", danger = false, id }: { children: ReactNode; className?: string; danger?: boolean; id?: string }) {
  return (
    <section
      id={id}
      className={`bg-white border rounded-card shadow-card p-[18px] md:p-6 flex flex-col gap-3.5 ${
        danger ? "border-dangerline" : "border-line"
      } ${className}`}
    >
      {children}
    </section>
  );
}

export function LoadingScreen({ text = "Yüklənir..." }: { text?: string }) {
  return (
    <div className="flex-1 flex flex-col justify-center items-center bg-cream text-forest min-h-screen gap-4">
      <svg className="animate-spin h-10 w-10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <p className="text-sm font-semibold text-muted">{text}</p>
    </div>
  );
}

// Button styles shared across screens: a color variant plus a size.
// Variants never set height, padding or font size, so sizes can be combined without conflicts.
const VARIANT = {
  primary: "bg-forest text-white font-bold hover:bg-forestpress",
  gold: "bg-forest text-white font-bold hover:bg-forestpress",
  outline: "border border-field bg-white text-ink font-bold hover:bg-sand",
  outlineStrong: "border border-ink/80 bg-white text-ink font-bold hover:bg-sand",
  ghostDark: "bg-sand text-ink font-bold hover:bg-track",
  danger: "border border-dangerline bg-white text-danger font-bold hover:bg-[#FBEFEB]",
};
const SIZE = {
  sm: "min-h-[40px] px-3 text-sm",
  md: "min-h-[48px] px-6 text-[15px]",
  lg: "min-h-[52px] px-6 text-base",
};
// Disabled actions lose the action colour entirely, so a colour on screen always means "you can press this"
const BASE = "press rounded-btn inline-flex items-center justify-center gap-2.5 disabled:bg-track disabled:text-muted disabled:border-transparent disabled:cursor-not-allowed";

export function button(variant: keyof typeof VARIANT, size: keyof typeof SIZE = "md"): string {
  return `${BASE} ${VARIANT[variant]} ${SIZE[size]}`;
}

export const btn = {
  primary: button("primary"),
  gold: button("gold", "lg"),
  outline: button("outline"),
  ghostDark: button("ghostDark", "lg"),
  danger: button("danger"),
};

export const inputCls =
  "min-h-[48px] w-full box-border px-3.5 rounded-[14px] border border-field bg-white text-base text-ink placeholder:text-[#9A8E84] focus:outline-none focus:border-forest focus:ring-2 focus:ring-forest/15";

// Date field with a calendar icon. iOS Safari gives native date inputs an intrinsic width and
// centred text; the date-input class (globals.css) resets that so the field fits its column.
export function DateInput({ className = "", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <div className="relative w-full min-w-0">
      <IconCalendar size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none z-10" />
      <input
        type="date"
        {...props}
        className={`date-input min-h-[48px] w-full box-border pl-10 pr-3.5 rounded-[14px] border border-field bg-white text-base text-ink placeholder:text-[#9A8E84] focus:outline-none focus:border-forest focus:ring-2 focus:ring-forest/15 ${className}`}
      />
    </div>
  );
}
