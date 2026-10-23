"use client";

// Mushaf reader: one page of the Quran at a time, as in the printed mushaf. Opened from the
// member's juz on "Bu gün" / "Səhifələrim"; inside their juz each page has an "Oxudum" button
// that records it and moves on to the next unread page.
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { isUserApprovedInGroup, toggleAssignmentPages } from "@/lib/db";
import { openAssignmentsOf } from "@/lib/khatm";
import { khatmLabel, surahForPage } from "@/lib/quran";
import { useGroupAssignments } from "@/lib/useGroupData";
import { useEncouragement } from "@/components/Encouragement";
import { IconCheck, IconClose, LoadingScreen, btn, button } from "@/components/ui";

const TOTAL_PAGES = 604;
const SWIPE_PX = 50;

const imagesOf = (page: number) => (page === 1 ? ["/mushaf/1.webp", "/mushaf/1b.webp"] : [`/mushaf/${page}.webp`]);

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

  const requested = Number(params.get("s"));
  const page = Number.isInteger(requested) && requested >= 1 && requested <= TOTAL_PAGES ? requested : 1;

  // The juz the member can mark now (the oldest unfinished one) and whether this page is in it
  const current = user ? openAssignmentsOf(assignments, user.uid)[0] || null : null;
  const juzPages = current ? [...current.pages].sort((a, b) => a - b) : [];
  const inMyJuz = juzPages.includes(page);
  const done = current?.completedPages || [];
  const isRead = inMyJuz && done.includes(page);

  // Inside the member's juz the arrows stay within it; otherwise the whole mushaf
  const first = inMyJuz ? juzPages[0] : 1;
  const last = inMyJuz ? juzPages[juzPages.length - 1] : TOTAL_PAGES;
  const next = page < last ? page + 1 : null;
  const prev = page > first ? page - 1 : null;

  const go = useCallback((p: number | null) => {
    if (p === null) return;
    setError(null);
    router.replace(`/oxu?s=${p}`, { scroll: false });
  }, [router]);

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
      imagesOf(p).forEach((src) => {
        const img = new Image();
        img.src = src;
      });
    });
  }, [next, prev]);

  if (loading || !user || (approvedHere && !loaded)) {
    return <LoadingScreen text="Quran açılır..." />;
  }

  const juzDone = !!current && juzPages.every((p) => done.includes(p));
  const remaining = juzPages.filter((p) => !done.includes(p));

  const markRead = async () => {
    if (!current || !inMyJuz || busy) return;
    setBusy(true);
    setError(null);
    try {
      await toggleAssignmentPages(activeGroupId, current.id, [page], true);
      encouragement.show();
      const left = remaining.filter((p) => p !== page);
      setAnnounce(left.length === 0 ? `Cüz ${current.juz} tamamlandı.` : `Səhifə ${page} oxunmuş kimi qeyd olundu.`);
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
    if (!current || !inMyJuz || busy) return;
    setBusy(true);
    setError(null);
    try {
      await toggleAssignmentPages(activeGroupId, current.id, [page], false);
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

  const position = inMyJuz ? `${juzPages.indexOf(page) + 1} / ${juzPages.length}` : `${page} / ${TOTAL_PAGES}`;

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
          <h1 className="m-0 text-[15px] md:text-base font-extrabold truncate">
            {inMyJuz && current ? `Cüz ${current.juz} · səhifə ${page}` : `Səhifə ${page}`}
          </h1>
          <div className="text-xs text-muted truncate">
            {surahForPage(page)}{inMyJuz && current ? ` · ${khatmLabel(current.khatm)}` : ""}
          </div>
        </div>
        <div className="shrink-0 text-right">
          {inMyJuz && (
            <div className={`text-xs font-bold px-2.5 py-1 rounded-full ${isRead ? "bg-donebg text-donetext" : "bg-sand text-muted"}`}>
              {isRead ? "Oxunub" : "Oxunmayıb"}
            </div>
          )}
          <div className="text-[11px] text-muted mt-0.5 tabular-nums">{position}</div>
        </div>
      </header>

      {inMyJuz && (
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
        {imagesOf(page).map((src) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt={`Quran, səhifə ${page}`}
            className={`block w-auto max-w-full object-contain select-none ${page === 1 ? "" : "max-h-full"}`}
            draggable={false}
          />
        ))}
      </main>

      {/* Bottom bar: next is on the left, as in the mushaf */}
      <footer className="shrink-0 bg-white border-t border-line px-3 md:px-5 pt-2.5 pb-[max(12px,env(safe-area-inset-bottom))] flex flex-col gap-2">
        {error && <p role="alert" className="m-0 text-[13px] font-semibold text-danger text-center">{error}</p>}
        {inMyJuz && juzDone && (
          <p className="m-0 text-[14px] font-bold text-donetext text-center">Cüz {current!.juz} tamamlandı. Allah qəbul etsin.</p>
        )}
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => go(next)} disabled={next === null} aria-label="Növbəti səhifə" className={`${button("outline", "lg")} shrink-0 px-4`}>
            ‹ <span className="hidden sm:inline">Növbəti</span>
          </button>
          <div className="flex-1 min-w-0">
            {!inMyJuz ? (
              <Link href="/dashboard" className={`${button("outline", "lg")} w-full`}>Panelə qayıt</Link>
            ) : juzDone ? (
              <Link href="/dashboard" className={`${btn.gold} w-full`}>Panelə qayıt</Link>
            ) : isRead ? (
              <button type="button" onClick={unmark} disabled={busy} className={`${button("outline", "lg")} w-full`}>
                <IconCheck size={18} /> Oxunub · geri al
              </button>
            ) : (
              <button type="button" onClick={markRead} disabled={busy} className={`${btn.gold} w-full`}>
                {busy ? "Qeyd edilir..." : `Oxudum · səhifə ${page}`}
              </button>
            )}
          </div>
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
