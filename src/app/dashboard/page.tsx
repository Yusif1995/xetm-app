"use client";

import { useAuth } from "@/lib/auth";
import {
  toggleAssignmentPages,
  type UserDoc,
  type AppSettings,
  getGroupDoc,
  joinGroup,
  type GroupDoc,
  getUserGroupIds,
  isUserApprovedInGroup,
  markMemberMessageRead
} from "@/lib/db";
import { useGroupAssignments, useGroupFullNames, useMyGroupMessage } from "@/lib/useGroupData";
import { khatmSummaries, memberStats, openAssignmentsOf } from "@/lib/khatm";
import { useEffect, useState, useRef, Suspense } from "react";
import Link from "next/link";
import AppLayout from "@/components/AppLayout";
import { db } from "@/lib/firebase";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { useSearchParams } from "next/navigation";
import { khatmLabel, pageRangesLabel, surahForPage } from "@/lib/quran";
import { formatGregorianAz, formatHijriAz, relativeTimeAz } from "@/lib/dates";
import { enablePushFromUserGesture } from "@/lib/push";
import { memberShare, ParticipantRow, participantName } from "@/components/GroupWidgets";
import { Avatar, Bar, Card, IconBell, IconLogout, LoadingScreen, ProgressRing, btn } from "@/components/ui";

interface DailyText {
  text: string;
  translation: string;
  source: string;
}

const WEEKDAYS = ["B.e.", "Ç.a.", "Ç.", "C.a.", "C.", "Ş.", "B."];
const CHUNK_SIZE = 5;

function DashboardContent() {
  const { user, loading, activeGroupId, setActiveGroupId, activeGroup, logout, isSuperAdmin } = useAuth();
  const [allUsers, setAllUsers] = useState<UserDoc[]>([]);
  const [isMarking, setIsMarking] = useState(false);
  const [togglingPage, setTogglingPage] = useState<number | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [groupCreatedBy, setGroupCreatedBy] = useState<string | null>(null);
  const [dailyAyah, setDailyAyah] = useState<DailyText | null>(null);
  const [dailyHadith, setDailyHadith] = useState<DailyText | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [markingMessage, setMarkingMessage] = useState(false);
  const canSeeNames = !!user && (isSuperAdmin || activeGroup?.createdBy === user.uid);
  const fullNames = useGroupFullNames(activeGroupId, canSeeNames);
  const ownerMessage = useMyGroupMessage(activeGroupId, user?.uid);
  const approvedHere = !!user && (isSuperAdmin || isUserApprovedInGroup(user, activeGroupId, activeGroup));
  const { assignments } = useGroupAssignments(activeGroupId, approvedHere);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchDaily() {
      try {
        const res = await fetch("/api/daily");
        if (res.ok) {
          const data = await res.json();
          if (data.ayah && data.hadith) {
            setDailyAyah(data.ayah);
            setDailyHadith(data.hadith);
          } else if (data.text) {
            const item = { text: data.text, translation: data.translation, source: data.source };
            if (data.type === "ayah") {
              setDailyAyah(item);
            } else {
              setDailyHadith(item);
            }
          }
        }
      } catch (err) {
        console.error("Error fetching daily content in dashboard:", err);
      }
    }
    fetchDaily();
  }, []);

  // Close the profile menu on outside click
  useEffect(() => {
    if (!profileOpen) return;
    const onClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [profileOpen]);

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
    try {
      await joinGroup(user, inviteGroup.id);
      setActiveGroupId(inviteGroup.id);
      setShowInviteModal(false);
      window.history.replaceState({}, "", "/dashboard");
      window.location.reload();
    } catch (err) {
      console.error("Error joining group:", err);
    }
  };

  const handleCancelInvite = () => {
    setShowInviteModal(false);
    window.history.replaceState({}, "", "/dashboard");
  };

  // Members of the active group only
  useEffect(() => {
    if (!user || !activeGroupId) {
      setAllUsers([]);
      return;
    }

    const membersQuery = query(collection(db, "users"), where("groupIds", "array-contains", activeGroupId));
    const unsubUsers = onSnapshot(membersQuery, (snapshot) => {
      const list: UserDoc[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const totalCompletedPages = data.totalCompletedPages !== undefined
          ? data.totalCompletedPages
          : ((data.completedPages?.length || 0) + (data.previousCompletedPages?.length || 0));
        list.push({ uid: docSnap.id, ...data, totalCompletedPages } as UserDoc);
      });
      setAllUsers(list);
    }, (err) => {
      console.error("Error in real-time users listener:", err);
    });

    return () => unsubUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, activeGroupId]);

  useEffect(() => {
    if (!activeGroupId) return;
    const settingsRef = activeGroupId === "default"
      ? doc(db, "settings", "config")
      : doc(db, "groups", activeGroupId);

    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (activeGroupId !== "default" && data) {
          setGroupCreatedBy(data.createdBy || null);
        } else {
          setGroupCreatedBy(null);
        }
        setSettings({
          currentAyah: data.currentAyah || "",
          currentHadith: data.currentHadith || "",
          completedKhatms: data.completedKhatms || 0,
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

  // Approved members of the active group (plus the group creator)
  const filteredUsers = allUsers.filter((u) =>
    (getUserGroupIds(u).includes(activeGroupId) || (groupCreatedBy && u.uid === groupCreatedBy))
    && isUserApprovedInGroup(u, activeGroupId, activeGroup)
  );
  // Show yourself first
  const participants = [...filteredUsers].sort((a, b) => (a.uid === user.uid ? -1 : b.uid === user.uid ? 1 : 0));

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

  // Group khatm progress: the oldest khatm that is not finished yet
  const summaries = khatmSummaries(assignments);
  const completedKhatms = summaries.filter((k) => k.completedAt).length;
  const currentKhatm = summaries.find((k) => !k.completedAt) || summaries[summaries.length - 1] || null;
  const groupRatio = currentKhatm ? currentKhatm.pagesRead / currentKhatm.totalPages : 0;

  // This member's share in each khatm
  const mine = memberStats(assignments, user.uid);

  const targetTitle = current
    ? `Cüz ${current.juz} · Səhifə ${pageRangesLabel(sortedPages)}`
    : mine.juzDone.length > 0 ? "Hamısı oxunub" : "Hələ cüz təyin edilməyib";

  let remainingText = "Qrup sahibi cüzləri bölüşdürən kimi oxuyacağın cüz burada görünəcək.";
  if (current) {
    remainingText = remaining > 0
      ? `${khatmLabel(current.khatm)} · qalıb ${remaining} səhifə. Növbəti: səhifə ${nextPage}.`
      : "Bu cüzü bitirdin. Allah qəbul etsin.";
  } else if (mine.juzDone.length > 0) {
    remainingText = "Sənə verilən bütün cüzləri bitirdin. Növbəti bölgüdə yeni cüz alacaqsan.";
  }

  const handleMarkAsComplete = async () => {
    if (!current || activeChunk.length === 0 || isMarking) return;
    setIsMarking(true);
    try {
      await toggleAssignmentPages(activeGroupId, current.id, activeChunk, true);
    } catch (err) {
      console.error("Error marking chunk as completed:", err);
    } finally {
      setIsMarking(false);
    }
  };

  const handleTogglePage = async (page: number) => {
    if (!current || togglingPage !== null) return;
    setTogglingPage(page);
    try {
      await toggleAssignmentPages(activeGroupId, current.id, [page], !completedPages.includes(page));
    } catch (err) {
      console.error("Error toggling page:", err);
    } finally {
      setTogglingPage(null);
    }
  };

  // Reading streak (consecutive days with a completion, ending today or yesterday)
  const readTimes = assignments
    .filter((a) => a.uid === user.uid)
    .flatMap((a) => Object.values(a.completedAt || {}));
  const readDays = new Set(readTimes.map((t) => new Date(t).toDateString()));
  const getStreak = () => {
    const oneDay = 24 * 60 * 60 * 1000;
    const today = new Date(new Date().toDateString()).getTime();
    let cursor = readDays.has(new Date(today).toDateString()) ? today : today - oneDay;
    let streak = 0;
    while (readDays.has(new Date(cursor).toDateString())) {
      streak++;
      cursor -= oneDay;
    }
    return streak;
  };
  const userStreak = getStreak();

  // Current week (Monday first) for the streak dots
  const now = new Date();
  const mondayOffset = (now.getDay() + 6) % 7;
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset + i);
    return {
      label: WEEKDAYS[i],
      read: readDays.has(d.toDateString()),
      isToday: i === mondayOffset,
      future: i > mondayOffset,
    };
  });

  const hijri = formatHijriAz(now);
  const dateLine = `${formatGregorianAz(now)}${hijri ? ` -- ${hijri}` : ""}`;
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
    } finally {
      setMarkingMessage(false);
    }
  };

  const handleEnablePush = async () => {
    alert(await enablePushFromUserGesture(user.uid));
  };

  // Daily ayah/hadith: generated item first, group settings as plain-text fallback
  const ayahFallback = settings?.currentAyah || "";
  const hadithFallback = settings?.currentHadith || "";

  return (
    <AppLayout activeTab="dashboard">
      <div className="flex flex-col gap-5 md:gap-7">

        <header className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5 min-w-0 flex-1">
            <h1 className="m-0 font-display font-bold text-[28px] md:text-[40px] leading-[1.1] text-forest">
              Xoş gördük, {firstName}
            </h1>
            <div className="text-[13px] md:text-[15px] text-muted">{dateLine}</div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <button
              type="button"
              onClick={handleEnablePush}
              aria-label="Bildirişləri aktiv et"
              title="Bildirişləri aktiv et"
              className="relative w-11 h-11 md:w-12 md:h-12 rounded-full border border-[#E3DBC7] bg-white text-forest flex items-center justify-center hover:bg-sand transition-colors"
            >
              <IconBell size={22} />
              <span className="absolute top-2 right-2.5 md:top-2.5 md:right-[11px] w-[9px] h-[9px] rounded-full bg-accent border-2 border-white" />
            </button>
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen(!profileOpen)}
                aria-expanded={profileOpen}
                className="flex items-center gap-3 p-0.5 md:p-1 md:pr-4 rounded-full bg-white border border-[#E3DBC7] hover:bg-sand transition-colors"
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
                <div className="absolute right-0 top-full mt-2 w-[min(15rem,calc(100vw-2.5rem))] bg-white border border-line rounded-btn shadow-xl z-50 p-2 text-ink">
                  <div className="px-3 py-2 border-b border-sand mb-1">
                    <div className="text-sm font-bold truncate">{displayName}</div>
                    <div className="text-xs text-muted">{viewerIsOwner ? "Qrup sahibi" : "İştirakçı"}</div>
                  </div>
                  <Link href="/groups" className="block w-full text-left px-3 py-2.5 text-sm font-semibold rounded-xl hover:bg-sand">
                    Qruplarım
                  </Link>
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-2 text-left px-3 py-2.5 text-sm font-semibold text-danger rounded-xl hover:bg-red-50"
                  >
                    <IconLogout size={16} />
                    Çıxış
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {showOwnerMessage && ownerMessage && (
          <section
            aria-label="Qrup sahibindən mesaj"
            className="bg-progress border border-accent rounded-card p-5 md:p-6 flex flex-wrap items-start justify-between gap-4"
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
            <button type="button" onClick={handleMessageRead} disabled={markingMessage} className={`${btn.primary} w-full md:w-auto`}>
              {markingMessage ? "..." : "Oxudum"}
            </button>
          </section>
        )}

        <div className="flex flex-wrap gap-5 md:gap-7 items-start">

          {/* Left column */}
          <div className="flex-[999_1_520px] min-w-0 flex flex-col gap-5 md:gap-7">

            {/* Hero */}
            <section
              aria-labelledby="hedef"
              className="bg-forest text-cream rounded-[22px] md:rounded-hero p-[22px] md:p-8 flex flex-wrap items-center justify-between gap-4 md:gap-7"
            >
              <div className="flex-[1_1_220px] flex flex-col gap-4 md:gap-[18px] min-w-0">
                <div className="flex flex-col gap-1.5 md:gap-2">
                  <div className="text-xs md:text-[13px] font-semibold text-gold">Bugünkü hədəfin</div>
                  <h2 id="hedef" className="m-0 font-display font-semibold text-2xl md:text-[32px] leading-[1.15]">{targetTitle}</h2>
                  <div className="text-[13px] md:text-[15px] text-onforest leading-relaxed">{remainingText}</div>
                </div>
                {current && (
                  <div className="flex flex-wrap gap-3">
                    {activeChunk.length > 0 ? (
                      <button type="button" onClick={handleMarkAsComplete} disabled={isMarking} className={btn.gold}>
                        {isMarking
                          ? "Qeyd edilir..."
                          : `Oxudum: səhifə ${activeChunk[0]}${activeChunk.length > 1 ? `–${activeChunk[activeChunk.length - 1]}` : ""}`}
                      </button>
                    ) : (
                      <div className="min-h-[52px] px-6 rounded-btn bg-[rgba(226,184,92,0.16)] text-gold font-bold text-base flex items-center">
                        Tamamlandı. Allah qəbul etsin
                      </div>
                    )}
                    <div className="hidden md:block"><Link href="/readings" className={btn.ghostDark}>Səhifələrimə bax</Link></div>
                  </div>
                )}
                {myOpen.length > 1 && (
                  <Link href="/readings" className="text-[13px] font-semibold text-gold underline underline-offset-4">
                    Növbədə daha {myOpen.length - 1} cüz var — bu cüzü bitirəndə açılacaq
                  </Link>
                )}
              </div>
              {current && (
                <>
                  <div className="hidden md:block"><ProgressRing value={myCompleted} total={sortedPages.length} /></div>
                  <div className="md:hidden"><ProgressRing value={myCompleted} total={sortedPages.length} size={88} caption={`/ ${sortedPages.length}`} /></div>
                </>
              )}
            </section>

            {/* My pages */}
            {current && (
              <Card>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="m-0 text-base md:text-lg font-bold text-forest">Cüz {current.juz} · {khatmLabel(current.khatm)}</h2>
                  <div className="text-xs md:text-[13px] text-muted">Oxuduğun səhifəyə toxun, işarələnsin</div>
                </div>
                <div className="grid grid-cols-5 md:grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-2">
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
                        className={`min-h-[44px] md:min-h-[48px] rounded-xl font-bold text-[15px] box-border transition-colors disabled:cursor-not-allowed ${
                          isDone
                            ? "bg-forest text-cream border border-forest"
                            : isNext
                              ? "bg-white text-forest border-2 border-accent"
                              : "bg-white text-muted border border-[#D9D1BE]"
                        } ${togglingPage === p ? "opacity-50" : ""}`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-5 text-[13px] text-muted">
                  <span className="inline-flex items-center gap-2"><span className="w-3.5 h-3.5 rounded bg-forest" />Oxunub</span>
                  <span className="inline-flex items-center gap-2"><span className="w-3.5 h-3.5 rounded bg-white border-2 border-accent box-border" />Növbəti</span>
                  <span className="inline-flex items-center gap-2"><span className="w-3.5 h-3.5 rounded bg-white border border-[#D9D1BE] box-border" />Gözləyir</span>
                </div>
              </Card>
            )}

            {/* Ayah + hadith */}
            {(dailyAyah || dailyHadith || ayahFallback || hadithFallback) && (
              <section aria-label="Günün ayəsi və hədisi" className="bg-white border border-line rounded-card p-5 md:p-7 flex flex-wrap gap-8">
                {(dailyAyah || ayahFallback) && (
                  <DailyFigure caption="Günün ayəsi" item={dailyAyah} fallback={ayahFallback} />
                )}
                {(dailyHadith || hadithFallback) && (
                  <DailyFigure caption="Günün hədisi" item={dailyHadith} fallback={hadithFallback} />
                )}
              </section>
            )}
          </div>

          {/* Right column */}
          <div className="flex-[1_1_320px] min-w-0 flex flex-col gap-5 md:gap-7">
            <Card>
              <h2 className="m-0 text-[15px] font-bold text-muted">
                Qrup xətmi{currentKhatm ? ` · ${khatmLabel(currentKhatm.khatm)}` : ""}
              </h2>
              <div className="flex items-baseline gap-2">
                <div className="font-display font-bold text-[44px] leading-none text-forest">{currentKhatm?.pagesRead || 0}</div>
                <div className="text-[15px] text-muted">/ 604 səhifə</div>
              </div>
              <Bar ratio={groupRatio} height={12} />
              <div className="text-[13px] text-muted">
                {currentKhatm ? `${currentKhatm.done} / 30 cüz oxunub` : "Hələ bölgü olmayıb"}
                {completedKhatms > 0 && ` · ${completedKhatms} xətm tamamlanıb`}
              </div>
            </Card>

            <Card>
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="m-0 text-[15px] font-bold text-muted">Mənim payım</h2>
                <Link href="/analytics" className="text-[13px] font-semibold text-forest underline underline-offset-4">Analitika</Link>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <MiniStat value={mine.pagesRead} label="səhifə" />
                <MiniStat value={mine.juzDone.length} label="cüz bitib" />
                <MiniStat value={mine.personalKhatms} label="şəxsi xətm" />
              </div>
              {mine.perKhatm.length === 0 ? (
                <p className="m-0 text-sm text-muted">Hələ cüz almamısan.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {mine.perKhatm.slice(-3).reverse().map((k) => (
                    <div key={k.khatm} className="flex items-start justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <div className="font-semibold text-ink">{khatmLabel(k.khatm)}</div>
                        <div className="text-xs text-muted truncate">
                          {k.juz.length > 0 ? `Cüz ${k.juz.join(", ")}` : "Ötürülmüş cüz"}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-forest">{k.juz.length} cüz</div>
                        <div className="text-xs text-muted">{k.pagesRead} səhifə</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <h2 className="m-0 text-[15px] font-bold text-muted">Ardıcıl gün</h2>
              <div className="flex items-baseline gap-2">
                <div className="font-display font-bold text-[44px] leading-none text-forest">{userStreak}</div>
                <div className="text-[15px] text-muted">gün</div>
              </div>
              <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-muted">
                {week.map((d) => (
                  <div key={d.label} className={`flex flex-col items-center gap-1.5 ${d.isToday ? "font-bold text-forest" : ""}`}>
                    <span
                      className={`w-7 h-7 rounded-full box-border ${
                        d.read
                          ? "bg-forest"
                          : d.isToday
                            ? "bg-white border-2 border-accent"
                            : d.future
                              ? "bg-sand"
                              : "bg-white border border-[#D9D1BE]"
                      }`}
                    />
                    {d.label}
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h2 className="m-0 text-[15px] font-bold text-muted">İştirakçılar</h2>
              {participants.length === 0 ? (
                <p className="m-0 text-sm text-muted">Hələ iştirakçı yoxdur.</p>
              ) : (
                <div className="flex flex-col gap-[18px]">
                  {participants.map((u) => (
                    <ParticipantRow
                      key={u.uid}
                      compact
                      share={memberShare(assignments, u.uid)}
                      name={participantName(u, user, fullNames)}
                      isSelf={u.uid === user.uid}
                      isOwner={u.uid === groupCreatedBy}
                    />
                  ))}
                </div>
              )}
              {nextPage && current && (
                <div className="text-xs text-muted">Növbəti səhifən: {surahForPage(nextPage)}</div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Invite modal */}
      {showInviteModal && inviteGroup && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-line rounded-hero p-6 md:p-8 w-full max-w-md flex flex-col gap-4 text-center">
            <h3 className="m-0 font-display font-semibold text-2xl text-forest">Qrup dəvəti</h3>
            <p className="m-0 text-sm leading-relaxed text-muted">
              Siz <strong className="text-ink">“{inviteGroup.name}”</strong> qrupuna dəvət aldınız. Bu qrupa qoşulmaq istəyirsiniz?
            </p>
            <div className="flex gap-2.5">
              <button onClick={handleJoinGroup} className={`${btn.primary} flex-1`}>Qoşul</button>
              <button onClick={handleCancelInvite} className={`${btn.outline} flex-1`}>İmtina et</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function MiniStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl bg-cream py-2.5">
      <div className="font-display font-bold text-2xl leading-none text-forest">{value}</div>
      <div className="text-[11px] text-muted mt-1">{label}</div>
    </div>
  );
}

function DailyFigure({ caption, item, fallback }: { caption: string; item: DailyText | null; fallback: string }) {
  return (
    <figure className="flex-[1_1_280px] m-0 flex flex-col gap-3 min-w-0">
      <figcaption className="text-[13px] font-bold text-goldtext">{caption}</figcaption>
      {item ? (
        <>
          {item.text && (
            <blockquote dir="rtl" lang="ar" className="m-0 font-amiri text-[26px] md:text-[32px] leading-[1.8] text-forest text-right">
              {item.text}
            </blockquote>
          )}
          <p className="m-0 text-[15px] leading-relaxed text-ink">{item.translation}</p>
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
