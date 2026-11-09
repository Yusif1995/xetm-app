"use client";

import { useAuth } from "@/lib/auth";
import {
  toggleAssignmentPages,
  type AppSettings,
  getGroupDoc,
  joinGroup,
  type GroupDoc,
  isUserApprovedInGroup,
  markMemberMessageRead
} from "@/lib/db";
import { useGroupAssignments, useMyGroupMessage, useThreadSummary } from "@/lib/useGroupData";
import { helperPages, helpTasksOf, memberStats, openAssignmentsOf } from "@/lib/khatm";
import { SectionTabs } from "@/components/dash";
import { useCallback, useEffect, useState, useRef, Suspense } from "react";
import Link from "next/link";
import AppLayout from "@/components/AppLayout";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { useSearchParams } from "next/navigation";
import { khatmLabel, pageRangesLabel, surahForPage } from "@/lib/quran";
import { formatGregorianAz, formatHijriAz, formatIsoDateAz, relativeTimeAz } from "@/lib/dates";
import { bakuDateKey, dailyContent, type DailyItem } from "@/lib/dailyContent";
import { useEncouragement } from "@/components/Encouragement";
import { IconBell, IconCalendar, IconCheck, LoadingScreen, NightBand, btn, button } from "@/components/ui";
import { OrnamentRule, PageMedal } from "@/components/ornament";

const CHUNK_SIZE = 5;
const UNDO_MS = 6000;

// Last write that failed, kept so the member can retry it from the today card
type FailedWrite = { message: string; retry: () => Promise<void> };
type Undo = { assignmentId: string; pages: number[]; label: string };

function DashboardContent() {
  const { user, loading, activeGroupId, setActiveGroupId, activeGroup, isSuperAdmin, previewAsMember } = useAuth();
  const [isMarking, setIsMarking] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [groupCreatedBy, setGroupCreatedBy] = useState<string | null>(null);
  const [markingMessage, setMarkingMessage] = useState(false);
  const [failedWrite, setFailedWrite] = useState<FailedWrite | null>(null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inviteDialogRef = useRef<HTMLDivElement>(null);
  const ownerMessage = useMyGroupMessage(activeGroupId, user?.uid);
  const thread = useThreadSummary(activeGroupId, user?.uid);
  const approvedHere = !!user && (isSuperAdmin || isUserApprovedInGroup(user, activeGroupId, activeGroup));
  const { assignments, loaded: assignmentsLoaded } = useGroupAssignments(activeGroupId, approvedHere);
  const encouragement = useEncouragement();

  useEffect(() => () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, []);

  const searchParams = useSearchParams();
  const [inviteGroup, setInviteGroup] = useState<GroupDoc | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const inviteGroupId = searchParams.get("invite");
  useEffect(() => {
    if (user && inviteGroupId && inviteGroupId !== (user.groupId || "default")) {
      // Already a member: just switch to that group instead of re-joining
      if ((user.groupIds || []).includes(inviteGroupId)) {
        setActiveGroupId(inviteGroupId);
        window.history.replaceState({}, "", "/dashboard");
        return;
      }
      getGroupDoc(inviteGroupId).then((group) => {
        if (group) {
          setInviteGroup(group);
          setShowInviteModal(true);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, inviteGroupId]);

  const handleJoinGroup = async () => {
    if (!user || !inviteGroup) return;
    setJoinError(null);
    try {
      await joinGroup(user, inviteGroup.id);
      setActiveGroupId(inviteGroup.id);
      setShowInviteModal(false);
      window.history.replaceState({}, "", "/dashboard");
      window.location.reload();
    } catch (err) {
      console.error("Error joining group:", err);
      setJoinError("Qrupa qoşulmaq alınmadı. İnterneti yoxla və yenidən cəhd et.");
    }
  };

  const handleCancelInvite = useCallback(() => {
    setShowInviteModal(false);
    setJoinError(null);
    window.history.replaceState({}, "", "/dashboard");
  }, []);

  // Invite dialog: focus the first action, keep Tab inside, close on Esc
  useEffect(() => {
    if (!showInviteModal) return;
    const dialog = inviteDialogRef.current;
    dialog?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCancelInvite();
        return;
      }
      if (e.key !== "Tab" || !dialog) return;
      const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>("button"));
      if (buttons.length === 0) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showInviteModal, handleCancelInvite]);

  // Group settings: owner, and an ayah/hadith the owner saved for today (if any)
  useEffect(() => {
    if (!activeGroupId) return;
    const settingsRef = activeGroupId === "default"
      ? doc(db, "settings", "config")
      : doc(db, "groups", activeGroupId);

    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGroupCreatedBy(activeGroupId !== "default" ? data.createdBy || null : null);
        setSettings({
          currentAyah: data.currentAyah || "",
          currentHadith: data.currentHadith || "",
          dailyDate: data.dailyDate || "",
        } as AppSettings);
      }
    }, (err) => {
      console.error("Error in real-time settings listener:", err);
    });

    return () => unsubSettings();
  }, [activeGroupId]);

  if (loading || !user) {
    return <LoadingScreen />;
  }

  const viewerIsOwner = !previewAsMember && !!groupCreatedBy && groupCreatedBy === user.uid;

  // Juz the member still has to read, oldest first. Only the oldest one can be marked;
  // the others wait until it is finished.
  const myOpen = openAssignmentsOf(assignments, user.uid);
  const current = myOpen[0] || null;
  const sortedPages = current ? [...current.pages].sort((a, b) => a - b) : [];
  const completedPages = current?.completedPages || [];
  // Pages a friend was given to read: not the holder's to mark, though the juz stays theirs
  const helped = current ? helperPages(current) : new Set<number>();
  const helpedUnread = sortedPages.filter((p) => helped.has(p) && !completedPages.includes(p));
  const ownPages = sortedPages.filter((p) => !helped.has(p));

  // Next 5-page chunk to mark
  const chunks: number[][] = [];
  for (let i = 0; i < ownPages.length; i += CHUNK_SIZE) {
    chunks.push(ownPages.slice(i, i + CHUNK_SIZE));
  }
  const activeChunk = chunks.find(chunk => !chunk.every(page => completedPages.includes(page))) || [];
  const nextPage = ownPages.find((p) => !completedPages.includes(p));
  const remaining = ownPages.filter((p) => !completedPages.includes(p)).length;
  // Juz where I help a friend, with the pages I was given
  const helpTasks = helpTasksOf(assignments, user.uid);

  const mine = memberStats(assignments, user.uid);

  const targetTitle = current
    ? `Cüz ${current.juz} · Səhifə ${pageRangesLabel(sortedPages)}`
    : mine.juzDone.length > 0 ? "Hamısı oxunub" : "Hələ cüz təyin edilməyib";

  let remainingText = "Qrup sahibi cüzləri bölüşdürən kimi oxuyacağın cüz burada görünəcək.";
  if (current) {
    const helpNote = helpedUnread.length > 0 ? ` ${helpedUnread.length} səhifəni dostun oxuyur, cüz sənin adına yazılacaq.` : "";
    remainingText = remaining > 0 && nextPage
      ? `${khatmLabel(current.khatm)} · qalıb ${remaining} səhifə. Növbəti: səhifə ${nextPage}, ${surahForPage(nextPage)}.${helpNote}`
      : helpedUnread.length > 0
        ? `Öz səhifələrini bitirdin.${helpNote}`
        : "Bu cüzü bitirdin. Allah qəbul etsin.";
  } else if (mine.juzDone.length > 0) {
    remainingText = "Sənə verilən bütün cüzləri bitirdin. Növbəti bölgüdə yeni cüz alacaqsan.";
  }

  // Reading period of the juz, and whether today (Baku) is its last day
  const todayKey = bakuDateKey(new Date());
  const isLastDay = !!current && remaining > 0 && current.endDate === todayKey;
  const isOverdue = !!current && remaining > 0 && !!current.endDate && current.endDate < todayKey;

  const rangeLabel = (pages: number[]) =>
    `${pages[0]}${pages.length > 1 ? `–${pages[pages.length - 1]}` : ""}`;

  const clearUndo = () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = null;
    setUndo(null);
  };

  // Writes go through here so a failure is shown in the today card with a retry, never only logged
  const runWrite = async (write: () => Promise<void>, failMessage: string) => {
    setFailedWrite(null);
    try {
      await write();
      return true;
    } catch (err) {
      console.error(failMessage, err);
      setFailedWrite({ message: failMessage, retry: write });
      setAnnouncement(failMessage);
      return false;
    }
  };

  const handleMarkAsComplete = async () => {
    if (!current || activeChunk.length === 0 || isMarking) return;
    const assignmentId = current.id;
    const pages = activeChunk.filter((p) => !completedPages.includes(p));
    const label = rangeLabel(activeChunk);
    setIsMarking(true);
    clearUndo();
    const ok = await runWrite(
      () => toggleAssignmentPages(activeGroupId, assignmentId, activeChunk, true),
      `Səhifə ${label} qeyd olunmadı. İnterneti yoxla və yenidən cəhd et.`
    );
    setIsMarking(false);
    if (ok && pages.length > 0) {
      setAnnouncement(`Səhifə ${label} oxunmuş kimi qeyd olundu.`);
      setUndo({ assignmentId, pages, label });
      undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
      encouragement.show();
    }
  };

  // Whole juz read in one sitting: mark every remaining page with one tap (undo stays available)
  const handleMarkJuz = async () => {
    if (!current || remaining === 0 || isMarking) return;
    const assignmentId = current.id;
    const pages = ownPages.filter((p) => !completedPages.includes(p));
    const label = `Cüz ${current.juz}`;
    setIsMarking(true);
    clearUndo();
    const ok = await runWrite(
      () => toggleAssignmentPages(activeGroupId, assignmentId, pages, true),
      `${label} qeyd olunmadı. İnterneti yoxla və yenidən cəhd et.`
    );
    setIsMarking(false);
    if (ok) {
      setAnnouncement(`${label} bütöv oxunmuş kimi qeyd olundu.`);
      setUndo({ assignmentId, pages, label: `${pages[0]}–${pages[pages.length - 1]}` });
      undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
      encouragement.show();
    }
  };

  const handleUndo = async () => {
    if (!undo) return;
    const { assignmentId, pages, label } = undo;
    clearUndo();
    const ok = await runWrite(
      () => toggleAssignmentPages(activeGroupId, assignmentId, pages, false),
      `Səhifə ${label} geri qaytarılmadı. Yenidən cəhd et.`
    );
    if (ok) setAnnouncement(`Səhifə ${label} yenidən oxunmamış oldu.`);
  };

  const handleRetry = async () => {
    if (!failedWrite) return;
    const { retry, message } = failedWrite;
    const ok = await runWrite(retry, message);
    if (ok) setAnnouncement("Yadda saxlanıldı.");
  };

  const now = new Date();
  const hijri = formatHijriAz(now);
  const gregorian = formatGregorianAz(now);
  const displayName = user.name || user.nickname || "";
  const firstName = user.firstName || displayName.split(" ")[0];

  // Whoever finishes juz 30 is invited to read the khatm dua for two weeks afterwards
  const finishedJuz30 = assignments.find((a) =>
    a.uid === user.uid && a.juz === 30 && a.done && !!a.doneAt
    && Date.now() - new Date(a.doneAt).getTime() < 14 * 24 * 60 * 60 * 1000
  );

  // Unread message from the group owner
  const showOwnerMessage = !!ownerMessage?.text && !ownerMessage.read;

  // Join requests waiting for the owner's approval
  const pendingRequests = viewerIsOwner
    ? Object.values(activeGroup?.members || {}).filter((s) => s === "pending").length
    : 0;

  const handleMessageRead = async () => {
    setMarkingMessage(true);
    try {
      await markMemberMessageRead(user.uid, activeGroupId);
    } catch (err) {
      console.error("Error marking message as read:", err);
      setNotice("Mesaj oxunmuş kimi qeyd olunmadı. Yenidən cəhd et.");
    } finally {
      setMarkingMessage(false);
    }
  };

  // Today's ayah and hadith change every day by themselves; a text the group owner saved
  // for today (from the AI panel) takes their place for that day only.
  const auto = dailyContent(now);
  const savedForToday = settings?.dailyDate === bakuDateKey(now);
  const ownerAyah = savedForToday ? settings?.currentAyah || "" : "";
  const ownerHadith = savedForToday ? settings?.currentHadith || "" : "";

  const pageGrid = (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-x-1 gap-y-1.5">
        {sortedPages.map((p, i) => {
          const isDone = completedPages.includes(p);
          const isNext = p === nextPage;
          const isHelped = !isDone && helped.has(p);
          return (
            <PageMedal
              key={p}
              page={p}
              index={i}
              href={`/oxu?s=${p}`}
              state={isDone ? "done" : isNext ? "next" : isHelped ? "helped" : "open"}
              label={`Səhifə ${p}${isDone ? ", oxunub" : isNext ? ", növbəti" : isHelped ? ", dostun oxuyur" : ", gözləyir"}. Quranda aç`}
            />
          );
        })}
      </div>
      <p className="m-0 text-[13px] text-muted text-center">
        Səhifəyə toxun, Quranda açılsın. Yaşıl ulduzlar oxunub{helpedUnread.length > 0 ? ", qırıq xətli göy ulduzları dostun oxuyur" : ""}.
      </p>
    </div>
  );


  // Pieces of the today card shared by the phone (mihrab) card and the desktop panel
  const alertsNode = (
    <>
              {isLastDay && (
                <div role="alert" className="flex items-center gap-3 rounded-btn bg-[#FBEFEB] border border-dangerline px-4 py-3 text-danger">
                  <IconBell size={22} className="shrink-0" />
                  <div className="flex flex-col">
                    <strong className="text-[15px] md:text-base font-extrabold">Bu gün son gündür</strong>
                    <span className="text-[13px]">Cüzü bu gün bitir: {remaining} səhifə qalıb.</span>
                  </div>
                </div>
              )}
              {isOverdue && (
                <div role="alert" className="rounded-btn bg-[#FBEFEB] border border-dangerline px-4 py-3 text-[14px] font-semibold text-danger">
                  Müddət {formatIsoDateAz(current!.endDate)} tarixində bitib. Qalan {remaining} səhifəni tez bitir.
                </div>
              )}
    </>
  );
  const actionsNode = (
current && (
                <div className="flex flex-wrap justify-center gap-3">
                  {activeChunk.length > 0 ? (
                    <>
                      {nextPage && (
                        <Link href={`/oxu?s=${nextPage}`} className={`${btn.gold} w-full sm:w-auto sm:min-w-[260px]`}>
                          Quranda oxu · səhifə {nextPage}
                        </Link>
                      )}
                      <button type="button" onClick={handleMarkAsComplete} disabled={isMarking} className={`${button("outline", "lg")} w-full sm:w-auto`}>
                        {isMarking ? "Qeyd edilir..." : `Oxudum: səhifə ${rangeLabel(activeChunk)}`}
                      </button>
                      <button type="button" onClick={handleMarkJuz} disabled={isMarking} className={`${button("outline", "lg")} w-full sm:w-auto`}>
                        <IconCheck size={20} />
                        {helped.size > 0 ? "Öz səhifələrimi bütöv oxudum" : "Cüzü bütöv oxudum"}
                      </button>
                    </>
                  ) : (
                    <div className="min-h-[52px] px-5 rounded-btn bg-donebg text-donetext font-bold text-base flex items-center gap-2.5">
                      <IconCheck size={20} />
                      {helpedUnread.length > 0 ? `Sənin səhifələrin bitdi · ${helpedUnread.length} səhifəni dostun oxuyur` : "Tamamlandı. Allah qəbul etsin"}
                    </div>
                  )}
                  <div className="hidden md:block"><Link href="/readings" className={btn.ghostDark}>Səhifələrimə bax</Link></div>
                </div>
              )
  );
  const statusNode = (
    <>
              {undo && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] md:text-sm text-muted">
                  <span>Səhifə {undo.label} qeyd olundu.</span>
                  <button
                    type="button"
                    onClick={handleUndo}
                    className="press min-h-[40px] px-3 -mx-1 rounded-xl font-bold text-forest hover:bg-mint"
                  >
                    Geri al
                  </button>
                </div>
              )}
              {failedWrite && (
                <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-btn bg-[#FBEFEB] border border-dangerline px-3.5 py-2.5 text-[13px] md:text-sm text-danger">
                  <span className="flex-[1_1_200px]">{failedWrite.message}</span>
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="press min-h-[40px] px-3 rounded-xl font-bold text-danger bg-white border border-dangerline"
                  >
                    Yenidən cəhd et
                  </button>
                </div>
              )}
              {myOpen.length > 1 && (
                <Link href="/readings" className="text-[13px] font-bold text-forest">
                  Növbədə daha {myOpen.length - 1} cüz var — bu cüzü bitirəndə açılacaq
                </Link>
              )}
    </>
  );

  const dashTabs = [
    { id: "sehifeler", label: "Bu günün səhifələri" },
    { id: "ayah", label: "Günün ayəsi və hədisi" },
  ];

  const greeting = firstName ? `Xoş gördük, ${firstName}` : "Xoş gördük";

  return (
    <AppLayout activeTab="dashboard">
      <div className="max-w-[880px] md:max-w-none flex flex-col gap-5 md:gap-7">
        <div role="status" aria-live="polite" className="sr-only">{announcement}</div>

        <header className="relative -mx-4 md:mx-0 px-4 md:px-0 pt-3 md:pt-0 pb-1 flex flex-col gap-1 md:flex-row md:items-end md:justify-between md:gap-6 md:min-h-[112px]">
          <div aria-hidden="true" className="girih-tile-m md:hidden absolute inset-x-0 -top-6 -bottom-[60px] -z-10 pointer-events-none" />
          <NightBand />
          {/* The greeting on the night artwork band, the date beneath it */}
          <div className="flex flex-col gap-1 md:gap-2 min-w-0">
            <h1 className="m-0 font-display font-normal text-[27px] md:text-[40px] leading-[1.25] pb-0.5 md:pb-1 text-white truncate">{greeting}</h1>
            <div className="text-[13px] md:text-[15px] text-nightmuted truncate">{gregorian}{hijri && `, ${hijri}`}</div>
          </div>
          <div className="hidden md:block"><SectionTabs tabs={dashTabs} /></div>
        </header>


        {notice && (
          <div className="flex items-start justify-between gap-3 rounded-[20px] bg-white border border-line shadow-card px-4 py-3 text-sm text-ink">
            <p className="m-0 leading-relaxed">{notice}</p>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="press shrink-0 min-h-[36px] px-3 -my-1 rounded-xl font-bold text-forest hover:bg-mint"
            >
              Bağla
            </button>
          </div>
        )}

        {thread?.memberUnread && thread.lastFrom === "manager" && (
          <section
            aria-label="Qrup rəhbərindən yeni mesaj"
            className="bg-vellum border-l-[3px] border-leaf rounded-r-card rounded-l-md shadow-card p-5 md:p-6 flex flex-wrap items-start justify-between gap-4"
          >
            <div className="flex gap-3.5 min-w-0 flex-[1_1_260px]">
              <div className="w-11 h-11 rounded-full bg-progress text-goldtext flex items-center justify-center shrink-0">
                <IconBell size={22} />
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <div className="text-[13px] font-bold text-goldtext">
                  Qrup rəhbərindən mesaj{activeGroup?.name ? ` · ${activeGroup.name}` : ""} · {relativeTimeAz(new Date(thread.lastAt).getTime())}
                </div>
                <p className="m-0 text-[15px] leading-relaxed text-ink whitespace-pre-line break-words line-clamp-4">{thread.lastText}</p>
              </div>
            </div>
            <Link href="/mesajlar" className={`${btn.outline} bg-white w-full md:w-auto`}>Aç və cavab yaz</Link>
          </section>
        )}

        {showOwnerMessage && ownerMessage && (
          <section
            aria-label="Qrup sahibindən mesaj"
            className="bg-vellum border-l-[3px] border-leaf rounded-r-card rounded-l-md shadow-card p-5 md:p-6 flex flex-wrap items-start justify-between gap-4"
          >
            <div className="flex gap-3.5 min-w-0 flex-[1_1_260px]">
              <div className="w-11 h-11 rounded-full bg-progress text-goldtext flex items-center justify-center shrink-0">
                <IconBell size={22} />
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <div className="text-[13px] font-bold text-goldtext">
                  Qrup sahibindən mesaj{activeGroup?.name ? ` · ${activeGroup.name}` : ""} · {relativeTimeAz(new Date(ownerMessage.sentAt).getTime())}
                </div>
                <p className="m-0 text-[15px] leading-relaxed text-ink whitespace-pre-line break-words">{ownerMessage.text}</p>
              </div>
            </div>
            <button type="button" onClick={handleMessageRead} disabled={markingMessage} className={`${btn.outline} bg-white w-full md:w-auto`}>
              {markingMessage ? "Qeyd edilir..." : "Mesajı oxudum"}
            </button>
          </section>
        )}

        {finishedJuz30 && (
          <section
            aria-label="Xətm duası"
            className="bg-donebg rounded-card p-5 md:p-6 flex flex-wrap items-center justify-between gap-4"
          >
            <div className="flex flex-col gap-1 min-w-0 flex-[1_1_240px]">
              <div className="text-[13px] font-bold text-donetext">{khatmLabel(finishedJuz30.khatm)} · Cüz 30</div>
              <p className="m-0 text-[15px] leading-relaxed text-ink">
                Quranın son cüzünü sən oxudun. Allah qəbul etsin. Xətm duasını oxuya bilərsən.
              </p>
            </div>
            <Link href="/oxu?dua=1" className={`${btn.gold} w-full md:w-auto`}>Xətm duasını oxu</Link>
          </section>
        )}

        {pendingRequests > 0 && (
          <section
            aria-label="Qoşulma istəkləri"
            className="bg-white border border-line rounded-card shadow-card p-4 md:p-5 flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0 flex-[1_1_220px]">
              <div className="w-11 h-11 rounded-full bg-progress text-goldtext flex items-center justify-center shrink-0">
                <IconBell size={22} />
              </div>
              <p className="m-0 text-[15px] leading-snug text-ink">
                <strong className="font-bold">{pendingRequests} nəfər</strong> “{activeGroup?.name || "qrup"}” qrupuna qoşulmaq istəyir.
              </p>
            </div>
            <Link href="/admin" className={`${btn.primary} w-full sm:w-auto`}>Təsdiq et</Link>
          </section>
        )}

        {/* Today's reading */}
        {!assignmentsLoaded && approvedHere ? (
          <section
            aria-label="Bugünkü hədəfin yüklənir"
            aria-busy="true"
            className="bg-white border border-line rounded-hero shadow-card p-[22px] md:p-8 flex flex-col gap-4"
          >
            <div className="h-8 md:h-9 w-3/4 max-w-sm rounded-lg bg-track animate-pulse" />
            <div className="h-4 w-1/2 max-w-xs rounded bg-track animate-pulse" />
            <div className="h-[52px] w-full sm:w-64 rounded-btn bg-track animate-pulse" />
          </section>
        ) : (
          <>

          {/* Today's pages: the next-page tile and the title, then the stars and the actions */}
          <section id="sehifeler" aria-labelledby="hedef-md" className="scroll-mt-28 flex bg-white rounded-[18px] shadow-panel p-4 md:p-7 flex-col gap-4 md:gap-5">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 md:gap-6">
              <div className="flex items-center gap-3.5 md:gap-6 min-w-0">
              {current && nextPage && (
                <Link
                  href={`/oxu?s=${nextPage}`}
                  aria-label={`Növbəti səhifə ${nextPage}, ${surahForPage(nextPage)}. Quranda aç`}
                  className="press shrink-0 w-[88px] h-[88px] md:w-[112px] md:h-[112px] rounded-[16px] md:rounded-[18px] bg-donebg flex flex-col items-center justify-center hover:bg-[#D9E1EC]"
                >
                  <span className="text-[11px] md:text-[12px] font-bold text-donetext"><span className="md:hidden">Növbəti</span><span className="hidden md:inline">Növbəti səhifə</span></span>
                  <span className="font-extrabold text-[34px] md:text-[46px] leading-none tabular-nums text-ink">{nextPage}</span>
                  <span className="mt-1 text-[11px] md:text-[12px] font-semibold text-muted max-w-[80px] md:max-w-[100px] truncate">{surahForPage(nextPage)}</span>
                </Link>
              )}
              <div className="min-w-0">
                <h2 id="hedef-md" className="m-0 text-[17px] md:text-[20px] font-extrabold text-ink leading-tight">{current ? "Bu günün səhifələri" : targetTitle}</h2>
                <div className="mt-1 md:mt-1.5 text-[13px] md:text-[14px] text-muted leading-relaxed">{current ? `${targetTitle} · ${remainingText}` : remainingText}</div>
              </div>
              </div>
              {current?.startDate && current.endDate && (
                <div className="flex gap-2 shrink-0">
                  <span className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-[10px] bg-cream text-[13px] font-semibold text-ink">
                    <IconCalendar size={15} className="text-muted" />
                    {formatIsoDateAz(current.startDate)} – {formatIsoDateAz(current.endDate)}
                  </span>
                </div>
              )}
            </div>
            {alertsNode}
            {current && pageGrid}
            {actionsNode}
            {statusNode}
          </section>
          </>
        )}

        {/* Pages I read for a friend: their juz, my reward for the pages */}
        {helpTasks.map(({ assignment: a, pages }) => {
          const left = pages.filter((p) => !a.completedPages.includes(p));
          return (
            <section key={a.id} aria-label={`Kömək: Cüz ${a.juz}`} className="bg-white border border-line rounded-card shadow-card p-5 md:p-6 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-lapis">Kömək</div>
                  <h2 className="m-0 font-display font-normal text-[22px] leading-tight text-ink">Cüz {a.juz} · {khatmLabel(a.khatm)}</h2>
                </div>
                <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${left.length ? "bg-donebg text-lapis" : "bg-mint text-forest"}`}>
                  {left.length ? `qalıb ${left.length}` : "bitirdin"}
                </span>
              </div>
              <p className="m-0 text-[14px] leading-relaxed text-muted">
                Dostunun cüzündən bu səhifələri sən oxuyursan. Cüz onun adına yazılacaq, oxuduğun səhifələr sənin hesabına düşür.
              </p>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-x-1 gap-y-1.5">
                {pages.map((p, i) => {
                  const isDone = a.completedPages.includes(p);
                  const isNext = p === left[0];
                  return (
                    <PageMedal
                      key={p}
                      page={p}
                      index={i}
                      href={`/oxu?s=${p}`}
                      state={isDone ? "done" : isNext ? "next" : "open"}
                      label={`Səhifə ${p}${isDone ? ", oxunub" : isNext ? ", növbəti" : ", gözləyir"}. Quranda aç`}
                    />
                  );
                })}
              </div>
              {left.length > 0 && (
                <Link href={`/oxu?s=${left[0]}`} className={`${btn.gold} w-full sm:w-auto sm:self-center sm:min-w-[260px]`}>
                  Quranda oxu · səhifə {left[0]}
                </Link>
              )}
            </section>
          );
        })}

        {/* Ayah and hadith of the day, after today's pages: the header's night sky with a thin gold frame */}
        <section id="ayah" aria-label="Günün ayəsi və hədisi" className="night-texture scroll-mt-28 relative overflow-hidden rounded-hero shadow-panel px-5 py-7 md:px-9 md:py-9">
          <div aria-hidden="true" className="absolute inset-1.5 md:inset-2 rounded-[16px] border border-gold/35 pointer-events-none" />
          <div className="relative flex flex-col md:flex-row items-center md:items-stretch gap-6 md:gap-10">
            <DailyFigure caption="Günün ayəsi" item={ownerAyah ? null : auto.ayah} fallback={ownerAyah} />
            <OrnamentRule className="md:hidden shrink-0" />
            <div aria-hidden="true" className="hidden md:flex flex-col items-center shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-gold/80" />
              <span className="flex-1 w-px bg-gold/45" />
              <span className="w-1.5 h-1.5 rounded-full bg-gold/80" />
            </div>
            <DailyFigure caption="Günün hədisi" item={ownerHadith ? null : auto.hadith} fallback={ownerHadith} />
          </div>
        </section>
      </div>

      {encouragement.node}

      {/* Invite dialog */}
      {showInviteModal && inviteGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={handleCancelInvite}>
          <div
            ref={inviteDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-title"
            aria-describedby="invite-text"
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-line rounded-hero p-6 md:p-8 w-full max-w-md flex flex-col gap-4 text-center"
          >
            <h3 id="invite-title" className="m-0 font-bold text-2xl text-ink">Qrup dəvəti</h3>
            <p id="invite-text" className="m-0 text-sm leading-relaxed text-muted">
              Sən <strong className="text-ink">“{inviteGroup.name}”</strong> qrupuna dəvət almısan. Qoşulmaq istəyirsən?
            </p>
            {joinError && <p role="alert" className="m-0 text-sm font-semibold text-danger">{joinError}</p>}
            <div className="flex gap-2.5">
              <button type="button" onClick={handleJoinGroup} className={`${btn.primary} flex-1`}>Qoşul</button>
              <button type="button" onClick={handleCancelInvite} className={`${btn.outline} flex-1`}>İmtina et</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function DailyFigure({ caption, item, fallback }: { caption: string; item: DailyItem | null; fallback: string }) {
  return (
    <figure className="flex-1 m-0 flex flex-col items-center gap-3 min-w-0 text-center">
      <figcaption className="font-display text-[15px] tracking-[0.04em] text-gold">{caption}</figcaption>
      {item ? (
        <>
          {item.text && (
            <blockquote dir="rtl" lang="ar" className="m-0 w-full font-quran text-[26px] md:text-[30px] leading-[2.15] text-gold text-center [word-spacing:0.06em]">
              {item.text}
            </blockquote>
          )}
          <p className="m-0 max-w-[60ch] text-[15px] leading-relaxed text-white/90">{item.translation}</p>
          <div className="text-[13px] text-onforest/75">{item.source}</div>
        </>
      ) : (
        <p className="m-0 text-[15px] leading-relaxed text-white/90 whitespace-pre-line">{fallback}</p>
      )}
    </figure>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <DashboardContent />
    </Suspense>
  );
}
