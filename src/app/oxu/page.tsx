"use client";

// Mushaf reader: one page of the Quran at a time, as in the printed mushaf. Opened from the
// member's juz on "Bu gün" / "Səhifələrim"; inside their juz each page has an "Oxudum" button
// that records it and moves on to the next unread page. /oxu?dua=1 shows the khatm dua, which
// the member who finishes juz 30 is invited to read.
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { isUserApprovedInGroup, toggleAssignmentPages } from "@/lib/db";
import { openAssignmentsOf, type Assignment } from "@/lib/khatm";
import { khatmLabel, surahForPage } from "@/lib/quran";
import { useGroupAssignments } from "@/lib/useGroupData";
import { useEncouragement } from "@/components/Encouragement";
import { IconCheck, IconClose, LoadingScreen, btn, button } from "@/components/ui";

const TOTAL_PAGES = 604;
const DUA_PAGES = 4;
const SWIPE_PX = 50;

const imagesOf = (page: number, dua: boolean) =>
  dua ? [`/mushaf/dua-${page}.webp`] : page === 1 ? ["/mushaf/1.webp", "/mushaf/1b.webp"] : [`/mushaf/${page}.webp`];

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
  const encouragement = useEncouragement();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const touchX = useRef<number | null>(null);

  const duaPage = clampInt(params.get("dua"), DUA_PAGES);
  const isDua = duaPage !== null;
  const page = isDua ? duaPage : clampInt(params.get("s"), TOTAL_PAGES) ?? 1;

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
  const juzPages = held ? [...held.pages].sort((a, b) => a - b) : [];
  const done = held?.completedPages || [];
  const isRead = !!held && done.includes(page);
  const juzDone = !!held && held.done;

  // Inside the member's juz (or the dua) the arrows stay within it; otherwise the whole mushaf
  const first = isDua ? 1 : held ? juzPages[0] : 1;
  const last = isDua ? DUA_PAGES : held ? juzPages[juzPages.length - 1] : TOTAL_PAGES;
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
    });
  }, [next, prev, isDua]);

  if (loading || !user || (approvedHere && !loaded)) {
    return <LoadingScreen text="Quran açılır..." />;
  }

  const remaining = juzPages.filter((p) => !done.includes(p));

  const markRead = async () => {
    if (!held || !canMark || busy) return;
    setBusy(true);
    setError(null);
    try {
      await toggleAssignmentPages(activeGroupId, held.id, [page], true);
      encouragement.show();
      const left = remaining.filter((p) => p !== page);
      setAnnounce(left.length === 0 ? `Cüz ${held.juz} tamamlandı.` : `Səhifə ${page} oxunmuş kimi qeyd olundu.`);
      // On to the next unread page of the juz (after this one first, then any skipped earlier)
      const target = left.find((p) => p > page) ?? left[0];
      if (target !== undefined) go(target);
    } catch (err) {
      console.error("Error marking page:", err);
      setError(`Səhifə ${page} qeyd olunmadı. İnterneti yoxla və yenidən cəhd et.`);
    } finally {
      setBusy(false);
    }
  };

  const unmark = async () => {
    if (!held || busy || held.uid !== user.uid) return;
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
    touchX.current = e.touches.length === 1 ? e.touches[0].clientX : null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    // Pages turn as in an Arabic book: pulling the page to the right goes forward
    if (dx > SWIPE_PX) go(next);
    else if (dx < -SWIPE_PX) go(prev);
  };

  const title = isDua ? "Xətm duası" : held ? `Cüz ${held.juz} · səhifə ${page}` : `Səhifə ${page}`;
  const subtitle = isDua ? "Quranı xətm edənin duası" : `${surahForPage(page)}${held ? ` · ${khatmLabel(held.khatm)}` : ""}`;
  const position = isDua ? `${page} / ${DUA_PAGES}` : held ? `${juzPages.indexOf(page) + 1} / ${juzPages.length}` : `${page} / ${TOTAL_PAGES}`;
  const finishedJuz30 = juzDone && held?.juz === 30;

  let action;
  if (isDua) {
    action = next === null
      ? <Link href="/dashboard" className={`${btn.gold} w-full`}>Amin · panelə qayıt</Link>
      : <button type="button" onClick={() => go(next)} className={`${btn.gold} w-full`}>Davam et</button>;
  } else if (!held) {
    action = <Link href="/dashboard" className={`${button("outline", "lg")} w-full`}>Panelə qayıt</Link>;
  } else if (juzDone) {
    action = finishedJuz30
      ? <Link href="/oxu?dua=1" className={`${btn.gold} w-full`}>Xətm duasını oxu</Link>
      : <Link href="/dashboard" className={`${btn.gold} w-full`}>Panelə qayıt</Link>;
  } else if (queued) {
    action = <Link href="/readings" className={`${button("outline", "lg")} w-full`}>Bu cüz növbədədir</Link>;
  } else if (isRead) {
    action = (
      <button type="button" onClick={unmark} disabled={busy} className={`${button("outline", "lg")} w-full`}>
        <IconCheck size={18} /> Oxunub · geri al
      </button>
    );
  } else {
    action = (
      <button type="button" onClick={markRead} disabled={busy} className={`${btn.gold} w-full`}>
        {busy ? "Qeyd edilir..." : `Oxudum · səhifə ${page}`}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-cream text-ink">
      <div role="status" aria-live="polite" className="sr-only">{announce}</div>

      {/* Top bar */}
      <header className="shrink-0 flex items-center gap-3 px-3 md:px-5 pt-[max(10px,env(safe-area-inset-top))] pb-2.5 bg-white border-b border-line">
        <Link
          href="/dashboard"
          aria-label="Bağla"
          className="press w-11 h-11 shrink-0 rounded-full border border-line bg-white flex items-center justify-center hover:bg-sand"
        >
          <IconClose size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="m-0 text-[15px] md:text-base font-extrabold truncate">{title}</h1>
          <div className="text-xs text-muted truncate">{subtitle}</div>
        </div>
        <div className="shrink-0 text-right">
          {held && (
            <div className={`text-xs font-bold px-2.5 py-1 rounded-full ${isRead ? "bg-donebg text-donetext" : "bg-sand text-muted"}`}>
              {isRead ? "Oxunub" : "Oxunmayıb"}
            </div>
          )}
          <div className="text-[11px] text-muted mt-0.5 tabular-nums">{position}</div>
        </div>
      </header>

      {held && (
        <div className="shrink-0 h-1.5 bg-track" aria-hidden="true">
          <div className="h-full bg-juzdone transition-[width] duration-500" style={{ width: `${(done.length / juzPages.length) * 100}%` }} />
        </div>
      )}

      {/* The page */}
      <main
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col items-center gap-3 px-2 py-2"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {imagesOf(page, isDua).map((src) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt={isDua ? `Xətm duası, səhifə ${page}` : `Quran, səhifə ${page}`}
            className={`block w-auto max-w-full object-contain select-none ${!isDua && page === 1 ? "" : "max-h-full"}`}
            draggable={false}
          />
        ))}
      </main>

      {/* Bottom bar: next is on the left, as in the mushaf */}
      <footer className="shrink-0 bg-white border-t border-line px-3 md:px-5 pt-2.5 pb-[max(12px,env(safe-area-inset-bottom))] flex flex-col gap-2">
        {error && <p role="alert" className="m-0 text-[13px] font-semibold text-danger text-center">{error}</p>}
        {juzDone && (
          <p className="m-0 text-[14px] font-bold text-donetext text-center">
            {finishedJuz30 ? "Cüz 30 tamamlandı. Allah qəbul etsin. İndi xətm duasını oxuya bilərsən." : `Cüz ${held!.juz} tamamlandı. Allah qəbul etsin.`}
          </p>
        )}
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => go(next)} disabled={next === null} aria-label="Növbəti səhifə" className={`${button("outline", "lg")} shrink-0 px-4`}>
            ‹ <span className="hidden sm:inline">Növbəti</span>
          </button>
          <div className="flex-1 min-w-0">{action}</div>
          <button type="button" onClick={() => go(prev)} disabled={prev === null} aria-label="Əvvəlki səhifə" className={`${button("outline", "lg")} shrink-0 px-4`}>
            <span className="hidden sm:inline">Əvvəlki</span> ›
          </button>
        </div>
      </footer>

      {encouragement.node}
    </div>
  );
}

export default function ReaderPage() {
  return (
    <Suspense fallback={<LoadingScreen text="Quran açılır..." />}>
      <Reader />
    </Suspense>
  );
}
