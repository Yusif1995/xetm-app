"use client";

import { useAuth } from "@/lib/auth";
import {
  toggleCompletedPages,
  type UserDoc,
  type AppSettings,
  getGroupDoc,
  joinGroup,
  type GroupDoc,
  getUserGroupIds,
  getUserAssignment,
  isUserApprovedInGroup
} from "@/lib/db";
import { useEffect, useState, useMemo, useRef, Suspense } from "react";
import Link from "next/link";
import AppLayout from "@/components/AppLayout";
import { db } from "@/lib/firebase";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { useSearchParams } from "next/navigation";
import { surahForPage, pageRangesLabel } from "@/lib/quran";
import { formatGregorianAz, formatHijriAz } from "@/lib/dates";
import { enablePushFromUserGesture } from "@/lib/push";
import { ParticipantRow, participantName } from "@/components/GroupWidgets";
import { Avatar, Bar, Card, IconBell, IconLogout, LoadingScreen, ProgressRing, btn } from "@/components/ui";

interface DailyText {
  text: string;
  translation: string;
  source: string;
}

const WEEKDAYS = ["B.e.", "Ç.a.", "Ç.", "C.a.", "C.", "Ş.", "B."];
const CHUNK_SIZE = 5;

function DashboardContent() {
  const { user, loading, refreshUser, activeGroupId, setActiveGroupId, activeGroup, logout } = useAuth();
  const [allUsers, setAllUsers] = useState<UserDoc[]>([]);
  const [completedPagesState, setCompletedPagesState] = useState<number[]>([]);
  const [isMarking, setIsMarking] = useState(false);
  const [togglingPage, setTogglingPage] = useState<number | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [groupCreatedBy, setGroupCreatedBy] = useState<string | null>(null);
  const [dailyAyah, setDailyAyah] = useState<DailyText | null>(null);
  const [dailyHadith, setDailyHadith] = useState<DailyText | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
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

  const activeAssignment = useMemo(
    () => user ? getUserAssignment(user, activeGroupId) : null,
    [user, activeGroupId]
  );

  const completedPagesKey = JSON.stringify(activeAssignment?.completedPages || []);
  useEffect(() => {
    setCompletedPagesState(activeAssignment?.completedPages || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedPagesKey]);

  useEffect(() => {
    if (!user) return;

    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
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
  }, [user?.uid]);

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

  const assignedPages = activeAssignment?.assignedPages || [];
  const sortedPages = [...assignedPages].sort((a, b) => a - b);
  const myCompleted = sortedPages.filter((p) => completedPagesState.includes(p)).length;

  // Previous round must be finished before the new pages unlock
  const prevAssigned = activeAssignment?.previousAssignedPages || [];
  const prevCompleted = activeAssignment?.previousCompletedPages || [];
  const prevRemaining = prevAssigned.filter((p) => !prevCompleted.includes(p)).length;
  const hasUncompletedPrev = prevRemaining > 0;

  // Next 5-page chunk to mark
  const chunks: number[][] = [];
  for (let i = 0; i < sortedPages.length; i += CHUNK_SIZE) {
    chunks.push(sortedPages.slice(i, i + CHUNK_SIZE));
  }
  const activeChunk = chunks.find(chunk => !chunk.every(page => completedPagesState.includes(page))) || [];
  const nextPage = sortedPages.find((p) => !completedPagesState.includes(p));
  const remaining = sortedPages.length - myCompleted;

  // Group stats (unique pages out of 604)
  const groupCompletedSet = new Set<number>();
  filteredUsers.forEach((u) => {
    const a = getUserAssignment(u, activeGroupId);
    const assigned = a.assignedPages || [];
    (a.completedPages || []).forEach((p) => {
      if (p >= 1 && p <= 604 && assigned.includes(p)) groupCompletedSet.add(p);
    });
  });
  const groupCount = groupCompletedSet.size;
  const groupRatio = groupCount / 604;

  const juzs = activeAssignment?.assignedJuzs?.length
    ? activeAssignment.assignedJuzs
    : activeAssignment?.assignedJuz ? [activeAssignment.assignedJuz] : [];
  const targetTitle = sortedPages.length === 0
    ? "Hələ səhifə təyin edilməyib"
    : `${juzs.length > 0 ? `Cüz ${juzs.join(", ")} · ` : ""}Səhifə ${pageRangesLabel(sortedPages)}`;

  let remainingText = "Qrup sahibi cüzləri bölüşdürən kimi səhifələrin burada görünəcək.";
  if (sortedPages.length > 0) {
    remainingText = remaining > 0
      ? `Qalıb ${remaining} səhifə. Növbəti: səhifə ${nextPage}.`
      : "Bütün səhifələrini oxudun. Allah qəbul etsin.";
  }

  const handleMarkAsComplete = async () => {
    if (activeChunk.length === 0 || isMarking || hasUncompletedPrev) return;
    setIsMarking(true);
    try {
      await toggleCompletedPages(user.uid, activeChunk, true, activeGroupId);
      setCompletedPagesState(prev => {
        const next = [...prev];
        activeChunk.forEach(p => {
          if (!next.includes(p)) next.push(p);
        });
        return next;
      });
      await refreshUser();
    } catch (err) {
      console.error("Error marking chunk as completed:", err);
    } finally {
      setIsMarking(false);
    }
  };

  const handleTogglePage = async (page: number) => {
    if (togglingPage !== null || hasUncompletedPrev) return;
    const isCompleted = !completedPagesState.includes(page);
    setTogglingPage(page);
    try {
      await toggleCompletedPages(user.uid, [page], isCompleted, activeGroupId);
      setCompletedPagesState(prev => isCompleted ? [...prev, page] : prev.filter(p => p !== page));
      await refreshUser();
    } catch (err) {
      console.error("Error toggling page:", err);
    } finally {
      setTogglingPage(null);
    }
  };

  // Reading streak (consecutive days with a completion, ending today or yesterday)
  const completedAt = activeAssignment?.completedAt || {};
  const readDays = new Set(Object.values(completedAt).map((t) => new Date(t).toDateString()));
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
  const firstName = user.firstName || user.name.split(" ")[0];

  const handleEnablePush = async () => {
    alert(await enablePushFromUserGesture(user.uid));
  };

  // Daily ayah/hadith: generated item first, group settings as plain-text fallback
  const ayahFallback = settings?.currentAyah || "";
  const hadithFallback = settings?.currentHadith || "";

  return (
    <AppLayout activeTab="dashboard">
      <div className="flex flex-col gap-5 md:gap-7">

        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1.5 min-w-0">
            <h1 className="m-0 font-display font-bold text-[28px] md:text-[40px] leading-[1.1] text-forest">
              Xoş gördük, {firstName}
            </h1>
            <div className="text-[13px] md:text-[15px] text-muted">{dateLine}</div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleEnablePush}
              aria-label="Bildirişləri aktiv et"
              title="Bildirişləri aktiv et"
              className="relative w-12 h-12 rounded-full border border-[#E3DBC7] bg-white text-forest flex items-center justify-center hover:bg-sand transition-colors"
            >
              <IconBell size={22} />
              <span className="absolute top-2.5 right-[11px] w-[9px] h-[9px] rounded-full bg-accent border-2 border-white" />
            </button>
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen(!profileOpen)}
                aria-expanded={profileOpen}
                className="flex items-center gap-3 p-1 md:pr-4 rounded-full bg-white border border-[#E3DBC7] hover:bg-sand transition-colors"
              >
                {user.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <Avatar name={user.name} />
                )}
                <span className="hidden md:inline text-sm font-semibold text-ink">{user.name}</span>
              </button>
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-line rounded-btn shadow-xl z-50 p-2">
                  <div className="px-3 py-2 border-b border-sand mb-1">
                    <div className="text-sm font-bold truncate">{user.name}</div>
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
                {sortedPages.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {hasUncompletedPrev ? (
                      <Link href="/readings" className={btn.gold}>
                        Əvvəlki tapşırığı bitir ({prevRemaining} səhifə)
                      </Link>
                    ) : activeChunk.length > 0 ? (
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
              </div>
              {sortedPages.length > 0 && (
                <>
                  <div className="hidden md:block"><ProgressRing value={myCompleted} total={sortedPages.length} /></div>
                  <div className="md:hidden"><ProgressRing value={myCompleted} total={sortedPages.length} size={88} caption={`/ ${sortedPages.length}`} /></div>
                </>
              )}
            </section>

            {/* My pages */}
            {sortedPages.length > 0 && (
              <Card>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="m-0 text-base md:text-lg font-bold text-forest">Mənim səhifələrim</h2>
                  <div className="text-xs md:text-[13px] text-muted">
                    {hasUncompletedPrev ? "Əvvəlki tapşırıq bitənə qədər kilidlidir" : "Oxuduğun səhifəyə toxun, işarələnsin"}
                  </div>
                </div>
                <div className="grid grid-cols-5 md:grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-2">
                  {sortedPages.map((p) => {
                    const isDone = completedPagesState.includes(p);
                    const isNext = p === nextPage;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handleTogglePage(p)}
                        disabled={hasUncompletedPrev || togglingPage !== null}
                        aria-pressed={isDone}
                        aria-label={`Səhifə ${p}${isDone ? ", oxunub" : isNext ? ", növbəti" : ", gözləyir"}`}
                        className={`min-h-[44px] md:min-h-[48px] rounded-xl font-bold text-[15px] box-border transition-colors disabled:cursor-not-allowed ${
                          isDone
                            ? "bg-forest text-cream border border-forest"
                            : isNext
                              ? "bg-white text-forest border-2 border-accent"
                              : "bg-white text-muted border border-[#D9D1BE]"
                        } ${togglingPage === p ? "opacity-50" : ""} ${hasUncompletedPrev ? "opacity-60" : ""}`}
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
              <h2 className="m-0 text-[15px] font-bold text-muted">Qrup xətmi</h2>
              <div className="flex items-baseline gap-2">
                <div className="font-display font-bold text-[44px] leading-none text-forest">{groupCount}</div>
                <div className="text-[15px] text-muted">/ 604 səhifə</div>
              </div>
              <Bar ratio={groupRatio} height={12} />
              <div className="text-[13px] text-muted">
                {activeGroup?.name ? `${activeGroup.name} · ` : ""}ümumi gedişatın {Math.round(groupRatio * 100)}%-i
                {(settings?.completedKhatms || 0) > 0 && ` · ${settings?.completedKhatms} xətm tamamlanıb`}
              </div>
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
                      user={u}
                      groupId={activeGroupId}
                      name={participantName(u, user.uid, viewerIsOwner)}
                      isSelf={u.uid === user.uid}
                      isOwner={u.uid === groupCreatedBy}
                    />
                  ))}
                </div>
              )}
              {nextPage && sortedPages.length > 0 && (
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
