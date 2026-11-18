"use client";

// Mushaf reader: one page of the Quran at a time, as in the printed mushaf. Opened from the
// member's juz on "Bu gün" / "Səhifələrim"; inside their juz each page has an "Oxudum" button
// that records it and moves on to the next unread page. /oxu?dua=1 shows the khatm dua, which
// the member who finishes juz 30 is invited to read.
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { isUserApprovedInGroup, markHelpPages, toggleAssignmentPages } from "@/lib/db";
import { helperPages, helpTasksOf, openAssignmentsOf, type Assignment } from "@/lib/khatm";
import { khatmLabel, surahForPage } from "@/lib/quran";
import { LINE_HEIGHT, LINE_TOP, PAGE_IMAGE, sajdahOnPage, type SajdahAyah } from "@/lib/sajdah";
import { useGroupAssignments } from "@/lib/useGroupData";
import { isAppOwner } from "@/lib/ownerApi";
import { IconClose, LoadingScreen } from "@/components/ui";
import { AyahMenu, AyahSheet, AyahZones, MealList, PlayerBar } from "@/components/MealView";
import { loadMealPage, useMealPage } from "@/lib/meal";
import { tracksFor, useAyahPlayer } from "@/lib/ayahAudio";

const TOTAL_PAGES = 604;
const DUA_PAGES = 3;
const SWIPE_PX = 50;

// Page images are cached for a year as immutable, so a new export must change the URL: bump this
const IMAGE_VERSION = 5;
const imagesOf = (page: number, dua: boolean) =>
  (dua ? [`dua-${page}`] : page === 1 ? ["1", "1b"] : [String(page)]).map((n) => `/mushaf/${n}.webp?v=${IMAGE_VERSION}`);

// Mushaf or meal: the reader always opens on the Arabic page; a switch to meal lasts while
// turning pages in this visit
type View = "mushaf" | "meal";

const clampInt = (v: string | null, max: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= max ? n : null;
};

function Reader() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading, activeGroupId, activeGroup, isSuperAdmin } = useAuth();
  const approvedHere = !!user && (isSuperAdmin || isUserApprovedInGroup(user, activeGroupId, activeGroup));
  const { assignments, loaded } = useGroupAssignments(activeGroupId, approvedHere);
  // The app owner turns through the whole mushaf from any page; everyone else stays inside their juz
  const [owner, setOwner] = useState(false);
  useEffect(() => {
    let cancelled = false;
    isAppOwner().then((o) => { if (!cancelled) setOwner(o); });
    return () => { cancelled = true; };
  }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  // The page fills the screen; a tap shows or hides the bars around it
  const [chrome, setChrome] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const [view, setView] = useState<View>("mushaf");
  // TEMPORARY (owner only): a log of taps on the screen, to find why sideways taps on the bar
  // buttons hide the bars on iPhone. Remove once found.
  const [dbg, setDbg] = useState<string[]>([]);
  const log = useCallback((line: string) => setDbg((d) => [...d.slice(-9), line]), []);
  const chooseView = (v: View) => setView(v);
  // Holding an ayah on the mushaf opens its meal; the click that ends the hold must not toggle the bars
  const holding = useRef(false);
  const [sheet, setSheet] = useState<{ s: number; a: number } | null>(null);
  const [menu, setMenu] = useState<{ s: number; a: number; x: number; y: number; onMushaf: boolean } | null>(null);
  const player = useAyahPlayer();

  const duaPage = clampInt(params.get("dua"), DUA_PAGES);
  const isDua = duaPage !== null;
  const page = isDua ? duaPage : clampInt(params.get("s"), TOTAL_PAGES) ?? 1;
  const sajdah = isDua ? null : sajdahOnPage(page);
  const meal = useMealPage(isDua ? null : page);
  const stopPlayer = player.stop;
  useEffect(() => { setSheet(null); setMenu(null); stopPlayer(); }, [page, isDua, stopPlayer]);
  // The page is scrolled when it is wider than the screen is tall (sideways); a new page starts at its top
  const mainRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const barTouch = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [page, isDua]);
  // Phone or tablet sideways: while the bars are up, the page ends where they begin instead of
  // scrolling under them, so a tap on a bar button can never reach the page (iPhone handed such taps
  // to the page, which hid the bars). Upright the page fits the screen and stays full size.
  const [barSpace, setBarSpace] = useState({ top: 0, bottom: 0 });
  useEffect(() => {
    const sideways = window.matchMedia("(orientation: landscape) and (pointer: coarse)");
    const measure = () => {
      setBarSpace(chrome && sideways.matches
        ? { top: headerRef.current?.offsetHeight ?? 0, bottom: footerRef.current?.offsetHeight ?? 0 }
        : { top: 0, bottom: 0 });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (headerRef.current) ro.observe(headerRef.current);
    if (footerRef.current) ro.observe(footerRef.current);
    sideways.addEventListener("change", measure);
    return () => { ro.disconnect(); sideways.removeEventListener("change", measure); };
  }, [chrome]);
  const barsBeside = barSpace.top + barSpace.bottom > 0;
  useEffect(() => { log(`mount ${window.innerWidth}x${window.innerHeight}`); }, [log]);
  useEffect(() => { log(`chrome=${chrome}`); }, [chrome, log]);
  useEffect(() => { log(`view=${view}`); }, [view, log]);
  // Arriving on a page with an ayah of prostration shows a notice for a while
  const [sajdahNotice, setSajdahNotice] = useState(false);

  // The juz this page belongs to for this member: the one they can mark now (oldest unfinished),
  // else one they already finished (so the page still shows as theirs right after the last tap),
  // else a later one that is still waiting its turn.
  const mineWithPage = user && !isDua ? assignments.filter((a) => a.uid === user.uid && a.pages.includes(page)) : [];
  const current = user ? openAssignmentsOf(assignments, user.uid)[0] || null : null;
  const held: Assignment | null =
    mineWithPage.find((a) => a.id === current?.id)
    || [...mineWithPage].filter((a) => a.done).sort((a, b) => (b.doneAt || "").localeCompare(a.doneAt || ""))[0]
    || mineWithPage.find((a) => !a.done)
    || null;
  const canMark = !!held && held.id === current?.id;
  const queued = !!held && !held.done && !canMark;
  // Pages of a friend's juz I was given to read (when this page is not in a juz of my own)
  const help = !held && user && !isDua ? helpTasksOf(assignments, user.uid).find((t) => t.pages.includes(page)) || null : null;
  const juzPages = held ? [...held.pages].sort((a, b) => a - b) : help ? help.pages : [];
  const done = held?.completedPages || help?.assignment.completedPages || [];
  const isRead = (!!held || !!help) && done.includes(page);
  const juzDone = !!held && held.done;
  // In my own juz, pages a friend reads are theirs to mark
  const helped = held ? helperPages(held) : new Set<number>();
  const friendReads = !!held && helped.has(page) && !isRead;

  // Inside the member's juz or help pages (or the dua) the arrows stay within them; otherwise the whole mushaf
  const first = isDua ? 1 : juzPages.length && !owner ? juzPages[0] : 1;
  const last = isDua ? DUA_PAGES : juzPages.length && !owner ? juzPages[juzPages.length - 1] : TOTAL_PAGES;
  const next = page < last ? page + 1 : null;
  const prev = page > first ? page - 1 : null;

  const go = useCallback((p: number | null) => {
    if (p === null) return;
    setError(null);
    router.replace(isDua ? `/oxu?dua=${p}` : `/oxu?s=${p}`, { scroll: false });
  }, [router, isDua]);

  // Keyboard: in a mushaf the next page is on the left
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(next);
      if (e.key === "ArrowRight") go(prev);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, next, prev]);

  // Load the neighbouring pages ahead of time so turning is instant
  useEffect(() => {
    [next, prev].forEach((p) => {
      if (p === null) return;
      imagesOf(p, isDua).forEach((src) => {
        const img = new Image();
        img.src = src;
      });
      if (!isDua) loadMealPage(p).catch(() => { /* loaded again when the page opens */ });
    });
  }, [next, prev, isDua]);

  useEffect(() => {
    setSajdahNotice(!!sajdah);
    if (!sajdah) return;
    const t = setTimeout(() => setSajdahNotice(false), 12000);
    return () => clearTimeout(t);
  }, [sajdah]);

  if (loading || !user || (approvedHere && !loaded)) {
    return <LoadingScreen text="Quran açılır..." />;
  }

  const remaining = juzPages.filter((p) => !done.includes(p) && !helped.has(p));

  const markRead = async () => {
    if (busy) return;
    if (help) {
      setBusy(true);
      setError(null);
      try {
        await markHelpPages(activeGroupId, help.assignment.id, [page], true);
        const left = remaining.filter((p) => p !== page);
        setAnnounce(`Səhifə ${page} oxunmuş kimi qeyd olundu.`);
        const target = left.find((p) => p > page) ?? left[0];
        if (target !== undefined) {
          go(target);
          setChrome(false);
        }
      } catch (err) {
        setChrome(true);
        console.error("Error marking help page:", err);
        setError(`Səhifə ${page} qeyd olunmadı. İnterneti yoxla və yenidən cəhd et.`);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!held || !canMark || friendReads) return;
    setBusy(true);
    setError(null);
    try {
      await toggleAssignmentPages(activeGroupId, held.id, [page], true);
      const left = remaining.filter((p) => p !== page);
      setAnnounce(left.length === 0 ? `Cüz ${held.juz} tamamlandı.` : `Səhifə ${page} oxunmuş kimi qeyd olundu.`);
      // On to the next unread page of the juz (after this one first, then any skipped earlier),
      // shown clean; when the juz is finished the bars stay up with the closing message
      const target = left.find((p) => p > page) ?? left[0];
      if (target !== undefined) {
        go(target);
        setChrome(false);
      }
    } catch (err) {
      setChrome(true);
      console.error("Error marking page:", err);
      setError(`Səhifə ${page} qeyd olunmadı. İnterneti yoxla və yenidən cəhd et.`);
    } finally {
      setBusy(false);
    }
  };

  const unmark = async () => {
    if (busy) return;
    if (help) {
      setBusy(true);
      setError(null);
      try {
        await markHelpPages(activeGroupId, help.assignment.id, [page], false);
        setAnnounce(`Səhifə ${page} oxunmamış oldu.`);
      } catch (err) {
        console.error("Error unmarking help page:", err);
        setError(`Səhifə ${page} geri qaytarılmadı. Yenidən cəhd et.`);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!held || held.uid !== user.uid) return;
    // A page a friend read is theirs to take back
    if (held.readBy?.[String(page)]) return;
    setBusy(true);
    setError(null);
    try {
      await toggleAssignmentPages(activeGroupId, held.id, [page], false);
      setAnnounce(`Səhifə ${page} oxunmamış oldu.`);
    } catch (err) {
      console.error("Error unmarking page:", err);
      setError(`Səhifə ${page} geri qaytarılmadı. Yenidən cəhd et.`);
    } finally {
      setBusy(false);
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    swiped.current = false;
    touch.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy)) return;
    swiped.current = true;
    // Pages turn as in an Arabic book: pulling the page to the right goes forward
    go(dx > 0 ? next : prev);
  };
  // iPhone, sideways: the bars are drawn flush with the screen edges, but the phone hit-tests the
  // footer lower down (its layout box runs past the screen bottom), so a finger on the drawn Meal
  // button lands on the page. Taps are read by where they sit on the drawn bar instead: a point in
  // the bottom band (footer height) is moved onto the footer's layout box, the top band likewise.
  // Where layout and drawing agree this changes nothing.
  // undefined = not on a bar, null = on a bar but no button
  const barButtonAt = (x: number, y: number): HTMLElement | null | undefined => {
    const vh = window.innerHeight;
    for (const [bar, bottom] of [[headerRef.current, false], [footerRef.current, true]] as const) {
      if (!bar) continue;
      const r = bar.getBoundingClientRect();
      const inBand = bottom ? y >= vh - r.height : y <= r.height;
      if (!inBand || x < r.left || x > r.right) continue;
      const ly = bottom ? r.bottom - (vh - y) : r.top + y;
      return Array.from(bar.querySelectorAll<HTMLElement>("button, a")).find((el) => {
        const b = el.getBoundingClientRect();
        return x >= b.left && x <= b.right && ly >= b.top && ly <= b.bottom;
      }) ?? null;
    }
    return undefined;
  };
  const describe = (t: EventTarget | null) => {
    const el = t as HTMLElement | null;
    if (!el || !el.tagName) return "?";
    const zone = el.closest?.("header") ? "H" : el.closest?.("footer") ? "F" : el.closest?.("main") ? "M" : "-";
    return `${zone}:${el.tagName.toLowerCase()}${el.textContent ? `"${el.textContent.trim().slice(0, 8)}"` : ""}`;
  };
  const onRootTouchStart = (e: React.TouchEvent) => {
    if (owner) log(`ts ${describe(e.target)} ${Math.round(e.touches[0]?.clientX ?? -1)},${Math.round(e.touches[0]?.clientY ?? -1)} f=${Math.round(footerRef.current?.getBoundingClientRect().top ?? -1)}+${footerRef.current?.offsetHeight ?? -1} h=${window.innerHeight} sy=${Math.round(window.scrollY)} vv=${Math.round(window.visualViewport?.offsetTop ?? -1)}/${Math.round(window.visualViewport?.height ?? -1)} ch=${document.documentElement.clientHeight}`);
    barTouch.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  };
  const onRootTouchEnd = (e: React.TouchEvent) => {
    if (owner) log(`te ${describe(e.target)} ${Math.round(e.changedTouches[0]?.clientX ?? -1)},${Math.round(e.changedTouches[0]?.clientY ?? -1)} chrome=${chrome} bar=${(() => { const t = barButtonAt(e.changedTouches[0]?.clientX ?? 0, e.changedTouches[0]?.clientY ?? 0); return t === undefined ? "-" : t === null ? "none" : describe(t); })()}`);
    const start = barTouch.current;
    barTouch.current = null;
    if (!chrome || !start || e.changedTouches.length !== 1) return;
    const { clientX: x, clientY: y } = e.changedTouches[0];
    if (Math.abs(x - start.x) > 10 || Math.abs(y - start.y) > 10) return;
    const target = barButtonAt(x, y);
    if (target === undefined) return;
    // No click follows (so nothing toggles the bars); the button is pressed here instead
    e.preventDefault();
    e.stopPropagation();
    if (target && !(target as HTMLButtonElement).disabled) target.click();
    const swallow = (ev: MouseEvent) => { ev.stopPropagation(); ev.preventDefault(); };
    document.addEventListener("click", swallow, true);
    setTimeout(() => document.removeEventListener("click", swallow, true), 450);
  };
  const onPageClick = (e: React.MouseEvent) => {
    // A mouse or stray click on a visible bar never hides the bars
    if (chrome) {
      const target = barButtonAt(e.clientX, e.clientY);
      if (target !== undefined) {
        if (target && !(target as HTMLButtonElement).disabled) target.click();
        return;
      }
    }
    if (holding.current) {
      holding.current = false;
      return;
    }
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    setChrome((v) => !v);
  };

  const mineOrHelp = held || help?.assignment || null;
  const title = isDua ? "Xətm duası" : mineOrHelp ? `Cüz ${mineOrHelp.juz} · səhifə ${page}` : `Səhifə ${page}`;
  const subtitle = isDua
    ? "Quranı xətm edənin duası"
    : `${surahForPage(page)}${mineOrHelp ? ` · ${khatmLabel(mineOrHelp.khatm)}` : ""}${help ? " · kömək" : ""}`;
  const position = isDua ? `${page} / ${DUA_PAGES}` : mineOrHelp ? `${juzPages.indexOf(page) + 1} / ${juzPages.length}` : `${page} / ${TOTAL_PAGES}`;
  const finishedJuz30 = juzDone && held?.juz === 30;

  // The big round button in the middle of the bottom toolbar: what this page asks for now
  const midBase = "press w-[60px] h-[60px] rounded-full flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-extrabold -mt-6 shadow-[0_6px_16px_rgba(169,130,58,0.4)]";
  const gold = `${midBase} bg-gold text-[#2b1f05]`;
  const plain = `${midBase} bg-white text-forest border-2 border-leaflight`;
  const iconCheck = <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
  const iconHome = <svg aria-hidden="true" viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"><path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z" /></svg>;
  const iconNext = <svg aria-hidden="true" viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m15 5-7 7 7 7" /></svg>;
  let action;
  if (isDua) {
    action = next === null
      ? <Link href="/dashboard" className={gold}>{iconCheck}Amin</Link>
      : <button type="button" onClick={() => go(next)} className={gold}>{iconNext}Davam</button>;
  } else if (help) {
    action = isRead ? (
      <button type="button" onClick={unmark} disabled={busy} aria-label="Oxunub, geri al" className={plain}>{iconCheck}Oxunub</button>
    ) : (
      <button type="button" onClick={markRead} disabled={busy} aria-label={`Oxudum, səhifə ${page}`} className={gold}>{iconCheck}{busy ? "..." : "Oxudum"}</button>
    );
  } else if (!held) {
    action = <Link href="/dashboard" className={plain}>{iconHome}Panel</Link>;
  } else if (juzDone) {
    action = finishedJuz30
      ? <Link href="/oxu?dua=1" className={gold}>{iconCheck}Dua</Link>
      : <Link href="/dashboard" className={gold}>{iconHome}Panel</Link>;
  } else if (friendReads) {
    action = <div className={`${plain} opacity-80`} aria-label="Bu səhifəni dostun oxuyur">{iconCheck}Dostun</div>;
  } else if (queued) {
    action = <Link href="/readings" className={plain} aria-label="Bu cüz növbədədir">{iconHome}Növbədə</Link>;
  } else if (isRead) {
    action = <button type="button" onClick={unmark} disabled={busy} aria-label="Oxunub, geri al" className={plain}>{iconCheck}Oxunub</button>;
  } else {
    action = <button type="button" onClick={markRead} disabled={busy} aria-label={`Oxudum, səhifə ${page}`} className={gold}>{iconCheck}{busy ? "..." : "Oxudum"}</button>;
  }

  const info = isDua
    ? `Xətm duası | ${page}. səhifə`
    : `${page}. səhifə | ${Math.min(30, Math.floor((page - 1) / 20) + 1)}. cüz | ${surahForPage(page)}`;
  const showMeal = view === "meal" && !isDua;
  // Ayah areas on the page image (page 1 is two panels and has none)
  const zones = !isDua && page !== 1 && meal.data ? meal.data.ayahs : null;
  const closeSheet = () => setSheet(null);
  const playingAyah = player.current && !player.current.basmala ? player.current : null;
  const playPage = () => {
    if (!meal.data) return;
    player.play(tracksFor(meal.data.ayahs));
    setChrome(false);
  };
  const tool = "press min-h-[52px] flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-bold text-muted disabled:opacity-35";
  const bars = `transition-[transform,opacity] duration-200 motion-reduce:transition-none ${chrome ? "opacity-100 translate-y-0" : "opacity-0 pointer-events-none"}`;

  return (
    <div className="fixed inset-0 bg-[#FFF7E5] text-ink select-none [-webkit-touch-callout:none]" onTouchStartCapture={onRootTouchStart} onTouchEndCapture={onRootTouchEnd} onTouchCancelCapture={() => { if (owner) log("tcancel"); }} onClickCapture={(e) => { if (owner) log(`click ${describe(e.target)} ${Math.round(e.clientX)},${Math.round(e.clientY)}`); }}>
      <div role="status" aria-live="polite" className="sr-only">{announce}</div>

      {/* The page, edge to edge; tap toggles the bars, swipe turns the page */}
      <main
        ref={mainRef}
        className="absolute inset-0 overflow-y-auto overscroll-contain flex flex-col pt-[max(8px,env(safe-area-inset-top))] pb-[max(6px,env(safe-area-inset-bottom))]"
        style={barsBeside ? { top: barSpace.top, bottom: barSpace.bottom, paddingTop: 8, paddingBottom: 6 } : undefined}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={onPageClick}
      >
        {showMeal ? (
          <div className={`flex-1 transition-[padding] duration-200 motion-reduce:transition-none ${chrome && !barsBeside ? "pt-[76px] pb-[110px]" : "pt-2 pb-6"}`}>
            <MealList data={meal.data} failed={meal.failed} held={holding} selected={menu} playing={playingAyah} onHold={(s, a, x, y) => setMenu({ s, a, x, y, onMushaf: false })} />
          </div>
        ) : (<>
        {/* Page 1 is two ornamented panels (al-Fatiha and the opening of al-Baqara): shown one under
            the other at full width and scrolled; every other page fits the screen upright, and with the
            phone or tablet turned sideways it fills the width and scrolls */}
        <div className={`flex flex-col items-center gap-4 px-1.5 ${!isDua && page === 1 ? "shrink-0" : "flex-1 min-h-0 justify-center touch-land:flex-none touch-land:justify-start"}`}>
          {imagesOf(page, isDua).map((src) => {
            const img = (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt={isDua ? `Xətm duası, səhifə ${page}` : `Quran, səhifə ${page}`}
                className={`block w-full object-contain ${!isDua && page === 1 ? "h-auto max-w-[560px]" : "h-full min-h-0 touch-land:h-auto touch-land:max-w-[900px]"}`}
                draggable={false}
                style={{ WebkitTouchCallout: "none" }}
              />
            );
            return sajdah || zones ? (
              <div key={src} className="relative w-full h-full min-h-0 touch-land:h-auto touch-land:max-w-[900px]">
                {img}
                {sajdah && <SajdahMark sajdah={sajdah} />}
                {zones && <AyahZones ayahs={zones} selected={menu || sheet} playing={playingAyah} held={holding} onHold={(s, a, x, y) => setMenu({ s, a, x, y, onMushaf: true })} />}
              </div>
            ) : img;
          })}
        </div>
        <div className="shrink-0 pt-1 text-center text-[12px] font-semibold text-muted tabular-nums">
          {info}{isRead && <span className="text-donetext"> · oxunub ✓</span>}
        </div>
        </>)}
      </main>

      {sheet && meal.data && (
        <AyahSheet data={meal.data} s={sheet.s} a={sheet.a} onClose={closeSheet} onPlay={() => { player.play([sheet]); setSheet(null); }} />
      )}
      {menu && (
        <AyahMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          onMeal={menu.onMushaf && meal.data ? () => { setSheet({ s: menu.s, a: menu.a }); setMenu(null); } : undefined}
          onPlay={() => { player.play([{ s: menu.s, a: menu.a }]); setMenu(null); }}
        />
      )}

      {/* Ayah of prostration on this page: shown on arrival while the bars are hidden */}
      {sajdah && sajdahNotice && !chrome && (
        <div
          role="status"
          className="sajdah-notice absolute inset-x-3 bottom-[max(14px,env(safe-area-inset-bottom))] mx-auto max-w-md flex items-start gap-3 rounded-[16px] bg-tile text-white shadow-bar border border-leaf/60 px-4 py-3.5"
        >
          <span aria-hidden="true" className="font-quran text-[30px] leading-none text-gold pt-1">۩</span>
          <div className="flex-1 min-w-0">
            <div className="font-display text-[16px] text-gold">Tilavət səcdəsi</div>
            <p className="m-0 mt-0.5 text-[13px] leading-snug text-white/90">
              Bu səhifədə səcdə ayəsi var: {sajdah.surah}, {sajdah.ayah}. Ayə səhifədə qızılı rənglə seçilib. Onu oxuyan və ya dinləyən səcdə edir.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSajdahNotice(false)}
            aria-label="Bağla"
            className="press shrink-0 w-10 h-10 -mr-2 -mt-1.5 rounded-full flex items-center justify-center text-white/80 hover:bg-white/10"
          >
            <IconClose size={18} />
          </button>
        </div>
      )}

      {/* Top bar: close, where we are, how far the juz is read. Bars sit on their own layer (z-10):
          sideways the page scrolls, and iPhone Safari otherwise gives taps on them to the page */}
      <header ref={headerRef} className={`absolute z-10 inset-x-0 top-0 flex items-center gap-2.5 pl-[max(12px,env(safe-area-inset-left))] pr-[max(12px,env(safe-area-inset-right))] pt-[max(10px,env(safe-area-inset-top))] pb-2.5 bg-[rgba(255,253,246,0.94)] backdrop-blur border-b border-[#EFE7D2] ${bars} ${chrome ? "" : "-translate-y-full"}`}>
        <Link
          href="/dashboard"
          aria-label="Bağla"
          className="press w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-ink hover:bg-sand"
        >
          <IconClose size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="m-0 text-[15px] font-extrabold leading-tight truncate">{title}</h1>
          <div className="text-xs text-muted truncate">{subtitle}{isRead && <span className="text-donetext"> · oxunub ✓</span>}</div>
        </div>
        {held && juzPages.length > 0 ? (
          <div
            role="img"
            aria-label={`Cüzdə ${done.length} / ${juzPages.length} səhifə oxunub`}
            className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center"
            style={{ background: `conic-gradient(#0F5C45 0 ${(done.length / juzPages.length) * 100}%, #E7E8E0 0 100%)` }}
          >
            <span className="w-[35px] h-[35px] rounded-full bg-[#FFFDF6] flex items-center justify-center text-[10px] font-extrabold tabular-nums">
              {done.length}/{juzPages.length}
            </span>
          </div>
        ) : (
          <div className="shrink-0 text-[11px] text-muted tabular-nums">{position}</div>
        )}
      </header>

      {/* Bottom toolbar: next is on the left, as in the mushaf; the page's main step in the middle */}
      <footer ref={footerRef} className={`absolute z-10 inset-x-0 bottom-0 bg-[rgba(255,253,246,0.96)] backdrop-blur border-t border-[#EFE7D2] pl-[max(8px,env(safe-area-inset-left))] pr-[max(8px,env(safe-area-inset-right))] pt-2 pb-[max(10px,env(safe-area-inset-bottom))] flex flex-col gap-1.5 ${bars} ${chrome ? "" : "translate-y-full"}`}>
        {error && <p role="alert" className="m-0 px-2 text-[13px] font-semibold text-danger text-center">{error}</p>}
        {sajdah && (
          <p className="m-0 text-[13px] font-bold text-goldtext text-center">
            <span aria-hidden="true" className="font-quran text-[17px]">۩</span> Səcdə ayəsi: {sajdah.surah}, {sajdah.ayah}
          </p>
        )}
        {juzDone && (
          <p className="m-0 px-2 text-[14px] font-bold text-donetext text-center">
            {finishedJuz30 ? "Cüz 30 tamamlandı. Allah qəbul etsin. İndi xətm duasını oxuya bilərsən." : `Cüz ${held!.juz} tamamlandı. Allah qəbul etsin.`}
          </p>
        )}
        <div className="grid grid-cols-5 items-end max-w-[560px] w-full mx-auto">
          <button type="button" onClick={() => go(next)} disabled={next === null} aria-label="Növbəti səhifə" className={tool}>
            <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m15 5-7 7 7 7" /></svg>
            Növbəti
          </button>
          {isDua ? <span /> : (
            // Names the other view: "Meal" on the Arabic page, "Mushaf" on the meal
            <button type="button" onClick={() => chooseView(view === "meal" ? "mushaf" : "meal")} className={tool}>
              {view === "meal" ? (
                <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M12 6.5C10 5 7 4.5 3.5 5v13.5c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5zM12 6.5V20" /></svg>
              ) : (
                <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20" /></svg>
              )}
              {view === "meal" ? "Mushaf" : "Meal"}
            </button>
          )}
          <div className="flex justify-center">{action}</div>
          {isDua || !meal.data ? <span /> : (
            <button type="button" onClick={playPage} className={`${tool} ${player.current ? "!text-forest" : ""}`}>
              <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M7 4.5v15l12-7.5z" /></svg>
              Dinlə
            </button>
          )}
          <button type="button" onClick={() => go(prev)} disabled={prev === null} aria-label="Əvvəlki səhifə" className={tool}>
            <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 5 7 7-7 7" /></svg>
            Əvvəlki
          </button>
        </div>
      </footer>

      <PlayerBar player={player} raised={chrome} />

      {owner && dbg.length > 0 && (
        <pre className="fixed left-1 top-1 z-[200] pointer-events-none m-0 max-w-[70vw] whitespace-pre-wrap rounded bg-black/75 p-1.5 text-[9px] leading-tight text-white">{dbg.join(String.fromCharCode(10))}</pre>
      )}

    </div>
  );
}

// Tints the ayah of prostration on the page image. The SVG covers the same box as the image and
// scales the same way (contain, centred), so the marks stay on the lines at any screen size.
function SajdahMark({ sajdah }: { sajdah: SajdahAyah }) {
  const { width: W, height: H } = PAGE_IMAGE;
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      className="sajdah-mark absolute inset-0 w-full h-full pointer-events-none mix-blend-multiply"
    >
      {sajdah.parts.map(([line, from, to]) => {
        const y = (LINE_TOP + (line - 1) * LINE_HEIGHT) * H;
        return (
          <g key={line}>
            <rect x={from * W} y={y} width={(to - from) * W} height={LINE_HEIGHT * H} fill="#E8B04B" fillOpacity={0.4} />
            <rect x={from * W} y={y + LINE_HEIGHT * H - 4} width={(to - from) * W} height={3} fill="#A9823A" fillOpacity={0.7} />
          </g>
        );
      })}
    </svg>
  );
}

export default function ReaderPage() {
  return (
    <Suspense fallback={<LoadingScreen text="Quran açılır..." />}>
      <Reader />
    </Suspense>
  );
}
