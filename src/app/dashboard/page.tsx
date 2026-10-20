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
import { useGroupAssignments, useMyGroupMessage } from "@/lib/useGroupData";
import { memberStats, openAssignmentsOf } from "@/lib/khatm";
import { useCallback, useEffect, useState, useRef, Suspense } from "react";
import Link from "next/link";
import AppLayout from "@/components/AppLayout";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { useSearchParams } from "next/navigation";
import { khatmLabel, pageRangesLabel, surahForPage } from "@/lib/quran";
import { formatGregorianAz, formatHijriAz, relativeTimeAz } from "@/lib/dates";
import { enablePushFromUserGesture, isPushSupported } from "@/lib/push";
import { bakuDateKey, dailyContent, type DailyItem } from "@/lib/dailyContent";
import { useEncouragement } from "@/components/Encouragement";
import { Avatar, IconBell, IconCheck, IconLogout, LoadingScreen, ProgressRing, btn } from "@/components/ui";

const CHUNK_SIZE = 5;
const UNDO_MS = 6000;

// Last write that failed, kept so the member can retry it from the today card
type FailedWrite = { message: string; retry: () => Promise<void> };
type Undo = { assignmentId: string; pages: number[]; label: string };

function DashboardContent() {
  const { user, loading, activeGroupId, setActiveGroupId, activeGroup, logout, isSuperAdmin } = useAuth();
  const [isMarking, setIsMarking] = useState(false);
  const [togglingPage, setTogglingPage] = useState<number | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [groupCreatedBy, setGroupCreatedBy] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [markingMessage, setMarkingMessage] = useState(false);
  const [failedWrite, setFailedWrite] = useState<FailedWrite | null>(null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [pushGranted, setPushGranted] = useState(true);
  const [joinError, setJoinError] = useState<string | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const inviteDialogRef = useRef<HTMLDivElement>(null);
  const ownerMessage = useMyGroupMessage(activeGroupId, user?.uid);
  const approvedHere = !!user && (isSuperAdmin || isUserApprovedInGroup(user, activeGroupId, activeGroup));
  const { assignments, loaded: assignmentsLoaded } = useGroupAssignments(activeGroupId, approvedHere);
  const profileRef = useRef<HTMLDivElement>(null);
  const encouragement = useEncouragement();

  // The bell only carries a dot while notifications are still off
  useEffect(() => {
    setPushGranted(!isPushSupported() || Notification.permission === "granted");
  }, []);

  useEffect(() => () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, []);

  const closeProfile = useCallback(() => {
    setProfileOpen(false);
    profileButtonRef.current?.focus();
  }, []);

  // Close the profile menu on outside click or Esc
  useEffect(() => {
    if (!profileOpen) return;
    const onClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeProfile();
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [profileOpen, closeProfile]);

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

  const viewerIsOwner = !!groupCreatedBy && groupCreatedBy === user.uid;

  // Juz the member still has to read, oldest first. Only the oldest one can be marked;
  // the others wait until it is finished.
  const myOpen = openAssignmentsOf(assignments, user.uid);
  const current = myOpen[0] || null;
  const sortedPages = current ? [...current.pages].sort((a, b) => a - b) : [];
  const completedPages = current?.completedPages || [];
  const myCompleted = completedPages.length;

  // Next 5-page chunk to mark
  const chunks: number[][] = [];
  for (let i = 0; i < sortedPages.length; i += CHUNK_SIZE) {
    chunks.push(sortedPages.slice(i, i + CHUNK_SIZE));
  }
  const activeChunk = chunks.find(chunk => !chunk.every(page => completedPages.includes(page))) || [];
  const nextPage = sortedPages.find((p) => !completedPages.includes(p));
  const remaining = sortedPages.length - myCompleted;

  const mine = memberStats(assignments, user.uid);

  const targetTitle = current
    ? `Cüz ${current.juz} · Səhifə ${pageRangesLabel(sortedPages)}`
    : mine.juzDone.length > 0 ? "Hamısı oxunub" : "Hələ cüz təyin edilməyib";

  let remainingText = "Qrup sahibi cüzləri bölüşdürən kimi oxuyacağın cüz burada görünəcək.";
  if (current) {
    remainingText = remaining > 0 && nextPage
      ? `${khatmLabel(current.khatm)} · qalıb ${remaining} səhifə. Növbəti: səhifə ${nextPage}, ${surahForPage(nextPage)}.`
      : "Bu cüzü bitirdin. Allah qəbul etsin.";
  } else if (mine.juzDone.length > 0) {
    remainingText = "Sənə verilən bütün cüzləri bitirdin. Növbəti bölgüdə yeni cüz alacaqsan.";
  }

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

  const handleTogglePage = async (page: number) => {
    if (!current || togglingPage !== null) return;
    const assignmentId = current.id;
    const markRead = !completedPages.includes(page);
    setTogglingPage(page);
    clearUndo();
    const ok = await runWrite(
      () => toggleAssignmentPages(activeGroupId, assignmentId, [page], markRead),
      `Səhifə ${page} yadda saxlanmadı. İnterneti yoxla və yenidən cəhd et.`
    );
    setTogglingPage(null);
    if (ok) {
      setAnnouncement(`Səhifə ${page} ${markRead ? "oxunmuş" : "oxunmamış"} kimi qeyd olundu.`);
      if (markRead) encouragement.show();
    }
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

  // Unread message from the group owner
  const showOwnerMessage = !!ownerMessage?.text && !ownerMessage.read;

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

  const handleEnablePush = async () => {
    setNotice(await enablePushFromUserGesture(user.uid));
    if (isPushSupported()) setPushGranted(Notification.permission === "granted");
  };

  // Today's ayah and hadith change every day by themselves; a text the group owner saved
  // for today (from the AI panel) takes their place for that day only.
  const auto = dailyContent(now);
  const savedForToday = settings?.dailyDate === bakuDateKey(now);
  const ownerAyah = savedForToday ? settings?.currentAyah || "" : "";
  const ownerHadith = savedForToday ? settings?.currentHadith || "" : "";

  const pageGrid = (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
        {sortedPages.map((p) => {
          const isDone = completedPages.includes(p);
          const isNext = p === nextPage;
          return (
            <button
              key={p}
              type="button"
              onClick={() => handleTogglePage(p)}
              disabled={togglingPage !== null}
              aria-pressed={isDone}
              aria-label={`Səhifə ${p}${isDone ? ", oxunub" : isNext ? ", növbəti" : ", gözləyir"}`}
              className={`press min-h-[44px] rounded-[12px] font-bold text-[15px] tabular-nums box-border disabled:cursor-not-allowed ${
                isDone
                  ? "bg-forest text-white border border-forest"
                  : isNext
                    ? "bg-mint text-forest border-2 border-forest"
                    : "bg-cream text-muted border border-line"
              } ${togglingPage === p ? "opacity-50" : ""}`}
            >
              {p}
            </button>
          );
        })}
      </div>
      <p className="m-0 text-[13px] text-muted">Oxuduğun səhifəyə toxun, işarələnsin. Yaşıl xanalar oxunub.</p>
    </div>
  );

  return (
    <AppLayout activeTab="dashboard">
      <div className="max-w-[880px] flex flex-col gap-5 md:gap-7">
        <div role="status" aria-live="polite" className="sr-only">{announcement}</div>

        <header className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5 min-w-0 flex-1">
            <h1 className="m-0 font-extrabold text-[28px] md:text-[36px] leading-[1.15] tracking-[-0.01em] text-ink">
              {firstName ? `Xoş gördük, ${firstName}` : "Xoş gördük"}
            </h1>
            <div className="text-[13px] md:text-[15px] text-muted">{gregorian}{hijri && <> <span className="whitespace-nowrap">· {hijri}</span></>}</div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <button
              type="button"
              onClick={handleEnablePush}
              aria-label={pushGranted ? "Bildirişlər aktivdir" : "Bildirişləri aktiv et"}
              title={pushGranted ? "Bildirişlər aktivdir" : "Bildirişləri aktiv et"}
              className="press relative w-11 h-11 md:w-12 md:h-12 rounded-full border border-line bg-white text-ink shadow-card flex items-center justify-center hover:bg-sand"
            >
              <IconBell size={22} />
              {!pushGranted && (
                <span className="absolute top-2 right-2.5 md:top-2.5 md:right-[11px] w-[9px] h-[9px] rounded-full bg-accent border-2 border-white" />
              )}
            </button>
            <div className="relative" ref={profileRef}>
              <button
                ref={profileButtonRef}
                type="button"
                onClick={() => setProfileOpen(!profileOpen)}
                aria-expanded={profileOpen}
                aria-haspopup="menu"
                aria-label={`Profil menyusu: ${displayName || "hesabın"}`}
                className="press flex items-center gap-3 p-0.5 md:p-1 md:pr-4 rounded-full bg-white border border-line shadow-card hover:bg-sand"
              >
                {user.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <Avatar name={displayName} />
                )}
                <span className="hidden md:inline text-sm font-semibold text-ink">{displayName}</span>
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-[min(15rem,calc(100vw-2.5rem))] bg-white border border-line rounded-[20px] shadow-bar z-50 p-2 text-ink">
                  <div className="px-3 py-2 border-b border-sand mb-1">
                    <div className="text-sm font-bold truncate">{displayName}</div>
                    <div className="text-xs text-muted">{viewerIsOwner ? "Qrup sahibi" : "İştirakçı"}</div>
                  </div>
                  <Link href="/groups" className="block w-full text-left px-3 py-2.5 text-sm font-semibold rounded-xl hover:bg-sand">
                    Qruplarım
                  </Link>
                  <button
                    type="button"
                    onClick={logout}
                    className="w-full flex items-center gap-2 text-left px-3 py-2.5 text-sm font-semibold text-danger rounded-xl hover:bg-[#FBEFEB]"
                  >
                    <IconLogout size={16} />
                    Çıxış
                  </button>
                </div>
              )}
            </div>
          </div>
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

        {showOwnerMessage && ownerMessage && (
          <section
            aria-label="Qrup sahibindən mesaj"
            className="bg-progress rounded-card p-5 md:p-6 flex flex-wrap items-start justify-between gap-4"
          >
            <div className="flex gap-3.5 min-w-0 flex-[1_1_260px]">
              <div className="w-11 h-11 rounded-full bg-white text-goldtext flex items-center justify-center shrink-0">
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

        {/* Ayah and hadith of the day: first thing on the screen */}
        <section aria-label="Günün ayəsi və hədisi" className="bg-white border border-line rounded-card shadow-card p-5 md:p-7 flex flex-col md:flex-row gap-5 md:gap-10">
          <DailyFigure caption="Günün ayəsi" item={ownerAyah ? null : auto.ayah} fallback={ownerAyah} />
          <div aria-hidden="true" className="h-px md:h-auto md:w-px bg-line shrink-0" />
          <DailyFigure caption="Günün hədisi" item={ownerHadith ? null : auto.hadith} fallback={ownerHadith} />
        </section>

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
          <section
            aria-labelledby="hedef"
            className="bg-white border border-line rounded-hero shadow-card p-[22px] md:p-8 flex flex-wrap items-center justify-between gap-4 md:gap-7"
          >
            <div className="flex-[1_1_220px] flex flex-col gap-4 md:gap-[18px] min-w-0">
              <div className="flex flex-col gap-1.5 md:gap-2">
                <h2 id="hedef" className="m-0 font-extrabold text-[26px] md:text-[34px] leading-[1.12] tracking-[-0.015em] text-ink">{targetTitle}</h2>
                <div className="text-[14px] md:text-[15px] text-muted leading-relaxed">{remainingText}</div>
              </div>
              {current && pageGrid}
              {current && (
                <div className="flex flex-wrap gap-3">
                  {activeChunk.length > 0 ? (
                    <button type="button" onClick={handleMarkAsComplete} disabled={isMarking} className={`${btn.gold} w-full sm:w-auto sm:min-w-[260px]`}>
                      {isMarking ? "Qeyd edilir..." : `Oxudum: səhifə ${rangeLabel(activeChunk)}`}
                    </button>
                  ) : (
                    <div className="min-h-[52px] px-5 rounded-btn bg-donebg text-donetext font-bold text-base flex items-center gap-2.5">
                      <IconCheck size={20} />
                      Tamamlandı. Allah qəbul etsin
                    </div>
                  )}
                  <div className="hidden md:block"><Link href="/readings" className={btn.ghostDark}>Səhifələrimə bax</Link></div>
                </div>
              )}
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
            </div>
            {current && (
              <div className="hidden lg:block self-start"><ProgressRing value={myCompleted} total={sortedPages.length} /></div>
            )}
          </section>
        )}
      </div>

      {encouragement.node}

      {/* Invite dialog */}
      {showInviteModal && inviteGroup && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={handleCancelInvite}>
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
    <figure className="flex-1 m-0 flex flex-col gap-2.5 min-w-0">
      <figcaption className="text-[13px] font-bold text-goldtext">{caption}</figcaption>
      {item ? (
        <>
          {item.text && (
            <blockquote dir="rtl" lang="ar" className="m-0 font-amiri text-[24px] md:text-[28px] leading-[1.8] text-ink text-right">
              {item.text}
            </blockquote>
          )}
          <p className="m-0 max-w-[65ch] text-[15px] leading-relaxed text-ink">{item.translation}</p>
          <div className="text-[13px] text-muted">{item.source}</div>
        </>
      ) : (
        <p className="m-0 text-[15px] leading-relaxed text-ink whitespace-pre-line">{fallback}</p>
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
