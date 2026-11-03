"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import {
  getGroupMembers,
  distributeJuz,
  assignJuzManually,
  transferAssignment,
  giveHelpPages,
  takeBackHelpPages,
  removeAssignment,
  resetGroupAssignments,
  syncGroupArchive,
  updateUserApproval,
  getUserGroupIds,
  isUserApprovedInGroup,
  removeUserFromGroup,
  type UserDoc,
  type GroupDoc
} from "@/lib/db";
import AppLayout from "@/components/AppLayout";
import AdminSettingsPanel from "@/components/AdminSettingsPanel";
import { ThreadDialog } from "@/components/MemberMessaging";
import { db } from "@/lib/firebase";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { JUZ_MAP, khatmLabel, ordinalAz } from "@/lib/quran";
import { memberShare, participantName, roleOf } from "@/components/GroupWidgets";
import { useGroupAdmins, useGroupAssignments, useGroupFullNames, useGroupThreads } from "@/lib/useGroupData";
import { helperPages, khatmSummaries, MAX_OPEN_ASSIGNMENTS, openAssignmentsOf, openKhatmForAssignment, type Assignment } from "@/lib/khatm";
import {
  Avatar, Bar, Card, Chip, DateInput, IconSettings, IconSparkle, LoadingScreen, PageHeader, btn, button, inputCls
} from "@/components/ui";

export default function AdminPage() {
  const { user: currentUser, loading: authLoading, activeGroupId, setActiveGroupId, activeGroup, activeGroupLoaded, isSuperAdmin } = useAuth();
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Auto distribution
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoMessage, setAutoMessage] = useState<string | null>(null);

  // Juz distribution dates
  const [groupStartDate, setGroupStartDate] = useState("");
  const [groupEndDate, setGroupEndDate] = useState("");
  const [pickedJuz, setPickedJuz] = useState<number | null>(null);
  const [pickedUid, setPickedUid] = useState("");
  // Transfer an unfinished juz to another member
  const [transferFor, setTransferFor] = useState<string | null>(null);
  const [transferUid, setTransferUid] = useState("");
  // "pages": a friend only helps with the chosen pages; "juz": the whole juz moves to them
  const [transferMode, setTransferMode] = useState<"juz" | "pages">("pages");
  const [helpPages, setHelpPages] = useState<number[]>([]);

  // The leader's conversation with one member (bulk messages live in Mesajlar)
  const [messageTarget, setMessageTarget] = useState<UserDoc | null>(null);
  const closeThread = useCallback(() => setMessageTarget(null), []);
  // Settings panel (invite link, privacy, danger zone) opened from the gear button
  const [settingsOpen, setSettingsOpen] = useState(false);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  const [createdGroups, setCreatedGroups] = useState<GroupDoc[]>([]);
  const canManage = !!currentUser && (isSuperAdmin || activeGroup?.createdBy === currentUser.uid);
  const fullNames = useGroupFullNames(activeGroupId, canManage);
  // Only the group creator reads the conversations (other app admins can send, not read)
  const isGroupCreator = !!currentUser && activeGroup?.createdBy === currentUser.uid;
  const threads = useGroupThreads(activeGroupId, isGroupCreator);
  const { assignments } = useGroupAssignments(activeGroupId, canManage);
  const adminUids = useGroupAdmins(activeGroupId, canManage);
  const [groupCreatedBy, setGroupCreatedBy] = useState<string | null>(null);

  async function loadData(groupId = activeGroupId) {
    try {
      setUsers(await getGroupMembers(groupId));
    } catch (err) {
      console.error("Error loading admin data:", err);
    } finally {
      setLoading(false);
    }
  }

  // Real-time listener for the members of the managed group
  useEffect(() => {
    if (!activeGroupId) {
      setUsers([]);
      setLoading(false);
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
      setUsers(list);
      setLoading(false);
    }, (err) => {
      console.error("Error in real-time users listener:", err);
      setLoading(false);
    });

    return () => unsubUsers();
  }, [activeGroupId]);

  // Real-time listener for the group owner
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
      }
    }, (err) => {
      console.error("Error in real-time settings listener:", err);
    });

    return () => unsubSettings();
  }, [activeGroupId]);

  // Real-time listener for groups created by this user
  useEffect(() => {
    if (!currentUser) return;
    const ownedQuery = query(collection(db, "groups"), where("createdBy", "==", currentUser.uid));
    const unsubGroups = onSnapshot(ownedQuery, (snapshot) => {
      const list: GroupDoc[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as GroupDoc);
      });
      setCreatedGroups(list);
    }, (err) => {
      console.error("Error in real-time groups listener:", err);
    });

    return () => unsubGroups();
  }, [currentUser]);

  // Default dates for the next distribution: today .. one week later
  useEffect(() => {
    const today = new Date();
    const inAWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setGroupStartDate((v) => v || iso(today));
    setGroupEndDate((v) => v || iso(inAWeek));
  }, [activeGroupId]);

  if (authLoading || loading || !activeGroupLoaded) {
    return <LoadingScreen text="İnzibatçı paneli yüklənir..." />;
  }

  if (!currentUser) {
    return null; // Guarded by middleware
  }

  const isCreatorOfGroup = canManage;
  const nameOf = (u: UserDoc) => participantName(u, currentUser, fullNames);
  const groupName = activeGroup?.name || "Qrup";

  const groupUsers = users.filter((u) =>
    getUserGroupIds(u).includes(activeGroupId) ||
    (groupCreatedBy && u.uid === groupCreatedBy)
  );
  const activeGroupUsers = groupUsers.filter((u) => isUserApprovedInGroup(u, activeGroupId, activeGroup));
  const pendingGroupUsers = groupUsers.filter((u) => !isUserApprovedInGroup(u, activeGroupId, activeGroup));

  // Khatm progress from the juz assignments
  const summaries = khatmSummaries(assignments);
  const completedKhatms = summaries.filter((k) => k.completedAt).length;
  const currentKhatm = summaries.find((k) => !k.completedAt) || null;
  const totalUniqueCompleted = currentKhatm?.pagesRead || 0;
  const { khatm: assigningKhatm, free: freeJuz } = openKhatmForAssignment(assignments);
  const openOf = (uid: string) => openAssignmentsOf(assignments, uid);
  const membersWithOpen = activeGroupUsers.filter((u) => openOf(u.uid).length > 0);
  const membersWithoutOpen = activeGroupUsers.filter((u) => openOf(u.uid).length === 0);
  const memberByUid = (uid: string) => users.find((u) => u.uid === uid);

  const handleApproveUser = async (uid: string) => {
    try {
      setLoading(true);
      await updateUserApproval(uid, true, activeGroupId);
      await loadData();
    } catch (err) {
      console.error("Error approving user:", err);
      alert("Təsdiqləmə zamanı xəta baş verdi.");
    } finally {
      setLoading(false);
    }
  };

  const handleRejectUser = async (user: UserDoc) => {
    if (window.confirm(`${nameOf(user)} adlı iştirakçının qoşulmaq istəyini rədd etmək istəyirsiniz?`)) {
      try {
        setLoading(true);
        await removeUserFromGroup(user, activeGroupId);
        await loadData();
      } catch (err) {
        console.error("Error rejecting user:", err);
        alert("Rədd edərkən xəta baş verdi.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleClearAll = async () => {
    if (window.confirm("Bütün cüz təyinatları, oxuma tarixçəsi və xətm sayğacı silinəcək və sayma sıfırdan başlayacaq. Davam edilsin?")) {
      try {
        setLoading(true);
        // Finished khatms and distributions are copied to the archive first, so they survive the reset
        await syncGroupArchive(activeGroupId);
        await resetGroupAssignments(activeGroupId);
        setAutoMessage("Bütün təyinatlar silindi.");
      } catch (err) {
        console.error("Error clearing assignments:", err);
        alert(err instanceof Error ? err.message : "Təmizləmə zamanı xəta baş verdi.");
      } finally {
        setLoading(false);
      }
    }
  };



  const handleRemoveUser = async (user: UserDoc) => {
    if (window.confirm(`${nameOf(user)} adlı iştirakçını “${groupName}” qrupundan kənarlaşdırmaq istədiyinizə əminsiniz?`)) {
      try {
        setLoading(true);
        await removeUserFromGroup(user, activeGroupId);
        await loadData();
      } catch (err) {
        console.error("Error removing user:", err);
        alert("Kənarlaşdırma zamanı xəta baş verdi.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAssignJuz = async (uid: string, juzNum: number) => {
    if (!groupStartDate || !groupEndDate) {
      alert("Zəhmət olmasa, əvvəlcə başlama və bitmə tarixlərini seçin.");
      return;
    }
    const member = memberByUid(uid);
    if (member && openOf(uid).length >= MAX_OPEN_ASSIGNMENTS &&
        !window.confirm(`${nameOf(member)} adlı iştirakçının artıq ${openOf(uid).length} bitməmiş cüzü var. Yenə də cüz verilsin?`)) {
      return;
    }
    try {
      setLoading(true);
      await assignJuzManually(activeGroupId, uid, assigningKhatm, juzNum, groupStartDate, groupEndDate);
      setPickedJuz(null);
      setPickedUid("");
    } catch (err) {
      console.error("Error assigning juz:", err);
      alert(err instanceof Error ? err.message : "Cüz təyinatı zamanı xəta baş verdi.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAssignment = async (a: Assignment) => {
    const member = memberByUid(a.uid);
    if (!window.confirm(`${member ? nameOf(member) : "İştirakçı"} adlı iştirakçının Cüz ${a.juz} (${khatmLabel(a.khatm)}) təyinatı ləğv edilsin? Oxunmuş səhifələri də silinəcək.`)) return;
    try {
      await removeAssignment(activeGroupId, a.id);
    } catch (err) {
      console.error("Error removing assignment:", err);
      alert(err instanceof Error ? err.message : "Təyinatı silərkən xəta baş verdi.");
    }
  };

  const handleTransfer = async (a: Assignment) => {
    if (!transferUid) return;
    try {
      if (transferMode === "pages") {
        if (helpPages.length === 0) return;
        await giveHelpPages(activeGroupId, a, transferUid, helpPages);
      } else {
        await transferAssignment(activeGroupId, a, transferUid);
      }
      setTransferFor(null);
      setTransferUid("");
    } catch (err) {
      console.error("Error transferring assignment:", err);
      alert(err instanceof Error ? err.message : "Cüzü ötürərkən xəta baş verdi.");
    }
  };

  const handleTakeBackHelp = async (a: Assignment, helperUid: string) => {
    try {
      await takeBackHelpPages(activeGroupId, a, helperUid);
    } catch (err) {
      console.error("Error taking back help pages:", err);
      alert(err instanceof Error ? err.message : "Səhifələri geri almaq alınmadı.");
    }
  };

  // Unread pages of a juz that nobody is helping with yet: these can be given to a friend
  const freePagesOf = (a: Assignment) => {
    const given = helperPages(a);
    return [...a.pages].sort((x, y) => x - y).filter((p) => !a.completedPages.includes(p) && !given.has(p));
  };

  const openTransfer = (a: Assignment) => {
    const opening = transferFor !== a.id;
    setTransferFor(opening ? a.id : null);
    setTransferUid("");
    setTransferMode("pages");
    setHelpPages(opening ? freePagesOf(a) : []);
  };

  // Random distribution: one juz per member who is not behind
  const handleAutoDistribute = async () => {
    if (!groupStartDate || !groupEndDate) {
      alert("Zəhmət olmasa, əvvəlcə başlama və bitmə tarixlərini seçin.");
      return;
    }
    if (!window.confirm(`Cüzlər sıra ilə paylanacaq, hər iştirakçıya bir cüz düşəcək. ${MAX_OPEN_ASSIGNMENTS} bitməmiş cüzü olan iştirakçılara bu bölgüdə cüz verilmir. Davam edilsin?`)) {
      return;
    }
    setAutoLoading(true);
    setAutoMessage(null);
    try {
      const r = await distributeJuz(activeGroupId, activeGroupUsers.map((u) => u.uid), groupStartDate, groupEndDate);
      const skippedNames = r.skipped.map((uid) => {
        const m = memberByUid(uid);
        return m ? nameOf(m) : "İştirakçı";
      });
      setAutoMessage(
        (r.assigned === 0 ? "Heç kimə cüz düşmədi, bölgü sayılmadı." : `${ordinalAz(r.distribution)} bölgü: ${r.assigned} cüz paylandı.`) +
        (skippedNames.length > 0 ? ` Geri qaldığı üçün cüz verilmədi: ${skippedNames.join(", ")}.` : "")
      );
    } catch (err) {
      console.error(err);
      setAutoMessage(err instanceof Error ? err.message : "Paylanma zamanı xəta baş verdi.");
    } finally {
      setAutoLoading(false);
    }
  };

  const filteredUsers = activeGroupUsers.filter(
    (u) =>
      nameOf(u).toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.nickname || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pct = Math.round((totalUniqueCompleted / 604) * 100);

  return (
    <AppLayout activeTab="admin">
      <div className="flex flex-col gap-5 md:gap-7">
        <PageHeader
          title="İnzibatçı paneli"
          actions={canManage ? (
            <div className="flex items-center gap-2 md:gap-3 self-start shrink-0">
              <Link
                href="/admin/ai"
                aria-label="AI köməkçi"
                title="AI köməkçi"
                className="press w-11 h-11 md:w-12 md:h-12 rounded-full bg-mint border border-line shadow-card text-forest flex items-center justify-center hover:bg-donebg"
              >
                <IconSparkle size={22} />
              </Link>
              {isCreatorOfGroup && (
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  aria-label="Ayarlar"
                  title="Ayarlar"
                  aria-haspopup="dialog"
                  aria-expanded={settingsOpen}
                  className="press w-11 h-11 md:w-12 md:h-12 rounded-full bg-white border border-line shadow-card text-ink flex items-center justify-center hover:bg-sand"
                >
                  <IconSettings size={22} />
                </button>
              )}
            </div>
          ) : undefined}
        />

        {!isCreatorOfGroup ? (
          <Card danger className="items-center text-center py-12">
            <h2 className="m-0 font-bold text-2xl text-danger">Giriş məhdudlaşdırılıb</h2>
            <p className="m-0 text-sm text-muted max-w-md">
              Siz bu xətm qrupunun sahibi deyilsiniz. Bu səbəbdən qrupu idarə etmək səlahiyyətiniz yoxdur.
            </p>
            <Link href="/groups" className={btn.outline}>Qruplarım</Link>
          </Card>
        ) : (
          <div className="flex flex-wrap gap-5 md:gap-7 items-start">

            {/* Left column */}
            <div className="flex-[999_1_560px] min-w-0 flex flex-col gap-5 md:gap-7">

              {/* Pending requests */}
              {pendingGroupUsers.length > 0 && (
                <section className="bg-progress rounded-card p-[18px] md:p-6 flex flex-col gap-3.5">
                  <div className="flex items-center gap-2.5">
                    <h2 className="m-0 text-base md:text-lg font-bold text-progresstext">Qoşulmaq istəyənlər</h2>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white text-progresstext">{pendingGroupUsers.length}</span>
                  </div>
                  {pendingGroupUsers.map((u) => (
                    <div key={u.uid} className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-btn p-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar name={nameOf(u)} gold />
                        <span className="text-[15px] font-bold truncate">{nameOf(u)}</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleApproveUser(u.uid)} className={button("primary", "sm")}>Təsdiq et</button>
                        <button onClick={() => handleRejectUser(u)} className={button("danger", "sm")}>Rədd et</button>
                      </div>
                    </div>
                  ))}
                </section>
              )}

              {/* Status */}
              <p aria-label="Qrupun vəziyyəti" className="m-0 text-[15px] leading-relaxed text-muted">
                {currentKhatm ? khatmLabel(currentKhatm.khatm) : "Cari xətm"}: <strong className="text-ink tabular-nums">{totalUniqueCompleted}</strong> / {currentKhatm?.totalPages || 604} səhifə oxunub ({pct}%)
                {completedKhatms > 0 ? <> · <strong className="text-ink tabular-nums">{completedKhatms}</strong> xətm tamamlanıb</> : null}
              </p>

              {/* Juz distribution */}
              <Card className="md:!p-7 !gap-[22px]">
                <h2 className="m-0 text-base md:text-xl font-bold text-ink">Cüz bölgüsü</h2>

                <div className="flex flex-wrap gap-4">
                  <label className="flex-[1_1_200px] min-w-0 flex flex-col gap-2 text-sm font-semibold text-ink">
                    Başlama tarixi
                    <DateInput value={groupStartDate} onChange={(e) => setGroupStartDate(e.target.value)} />
                  </label>
                  <label className="flex-[1_1_200px] min-w-0 flex flex-col gap-2 text-sm font-semibold text-ink">
                    Bitmə tarixi
                    <DateInput value={groupEndDate} onChange={(e) => setGroupEndDate(e.target.value)} />
                  </label>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={handleAutoDistribute} disabled={autoLoading || activeGroupUsers.length === 0} className={button("primary", "lg")}>
                    {autoLoading ? "Paylanır..." : "Cüzləri payla"}
                  </button>
                  <button type="button" onClick={handleClearAll} className={button("outline", "lg")}>
                    Sıfırla
                  </button>
                </div>
                {autoMessage && <div className="text-sm font-semibold text-donetext">{autoMessage}</div>}

                {/* Unfinished juz per member */}
                <div className="flex flex-col gap-3 pt-4 border-t border-sand">
                  <div className="text-sm font-semibold text-ink">Oxunmaqda olan cüzlər</div>
                  {membersWithOpen.length === 0 && (
                    <p className="m-0 text-sm text-muted">Hazırda bitməmiş cüz yoxdur.</p>
                  )}
                  {membersWithOpen.map((u) => {
                    const open = openOf(u.uid);
                    return (
                      <div key={u.uid} className="flex flex-col gap-2.5 px-4 py-3.5 rounded-2xl bg-cream">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar name={nameOf(u)} gold={u.uid !== currentUser.uid} />
                          <div className="min-w-0 flex-1">
                            <div className="text-[15px] font-bold truncate">{nameOf(u)}</div>
                            <div className="text-xs text-muted">{open.length} bitməmiş cüz</div>
                          </div>
                          {open.length >= MAX_OPEN_ASSIGNMENTS && <Chip tone="pending">Geri qalır</Chip>}
                        </div>
                        {open.map((a) => (
                          <div key={a.id} className="flex flex-col gap-2 bg-white rounded-xl px-3 py-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-sm">
                                <span className="font-extrabold text-ink">Cüz {a.juz}</span>
                                <span className="text-muted"> · {khatmLabel(a.khatm)} · {a.completedPages.length} / {a.pages.length} səhifə</span>
                              </div>
                              <div className="flex gap-2">
                                <button type="button" onClick={() => openTransfer(a)} className={button("outline", "sm")}>Ötür</button>
                                <button type="button" onClick={() => handleRemoveAssignment(a)} className={button("danger", "sm")}>Ləğv et</button>
                              </div>
                            </div>
                            {(a.helpers || []).map((h) => {
                              const helper = memberByUid(h.uid);
                              const unread = h.pages.filter((p) => !a.completedPages.includes(p));
                              return (
                                <div key={h.uid} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-mint px-3 py-2 text-[13px] text-forest">
                                  <span>
                                    <strong>{helper ? nameOf(helper) : "Keçmiş üzv"}</strong> kömək edir · səhifə {h.pages.join(", ")}
                                    {unread.length < h.pages.length ? ` · ${h.pages.length - unread.length} oxunub` : ""}
                                  </span>
                                  {unread.length > 0 && (
                                    <button type="button" onClick={() => handleTakeBackHelp(a, h.uid)} className="press min-h-[36px] px-2.5 rounded-lg font-bold hover:bg-white/60">Geri al</button>
                                  )}
                                </div>
                              );
                            })}
                            {transferFor === a.id && (() => {
                              const free = freePagesOf(a);
                              const canSend = !!transferUid && (transferMode === "juz" || helpPages.length > 0);
                              return (
                                <div className="flex flex-col gap-3 pt-1">
                                  <div role="radiogroup" aria-label="Nə ötürülsün" className="grid grid-cols-2 gap-1 rounded-xl bg-sand p-1">
                                    {([["pages", "Qalan səhifələr"], ["juz", "Bütün cüz"]] as const).map(([v, label]) => (
                                      <button
                                        key={v}
                                        type="button"
                                        role="radio"
                                        aria-checked={transferMode === v}
                                        onClick={() => setTransferMode(v)}
                                        className={`press min-h-[40px] rounded-[10px] text-[13px] ${transferMode === v ? "bg-white text-forest font-extrabold shadow-card" : "text-muted font-bold"}`}
                                      >
                                        {label}
                                      </button>
                                    ))}
                                  </div>
                                  {transferMode === "pages" ? (
                                    <div className="flex flex-col gap-2">
                                      <p className="m-0 text-xs text-muted">
                                        Seçilən səhifələri dostu oxuyur. Cüz {nameOf(u)} adında qalır və bitəndə ona yazılır; dostun oxuduğu səhifələr dostun hesabına düşür.
                                      </p>
                                      {free.length === 0 ? (
                                        <p className="m-0 text-xs font-semibold text-ink">Verilə biləcək oxunmamış səhifə qalmayıb.</p>
                                      ) : (
                                        <div className="flex flex-wrap gap-1.5">
                                          {free.map((p) => {
                                            const on = helpPages.includes(p);
                                            return (
                                              <button
                                                key={p}
                                                type="button"
                                                aria-pressed={on}
                                                onClick={() => setHelpPages((prev) => on ? prev.filter((x) => x !== p) : [...prev, p].sort((x, y) => x - y))}
                                                className={`press min-w-[48px] min-h-[40px] px-2 rounded-lg text-[13px] font-bold tabular-nums border ${on ? "bg-forest border-forest text-white" : "bg-white border-line text-muted"}`}
                                              >
                                                {p}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="m-0 text-xs text-muted">Cüz tam olaraq seçilən şəxsə keçir və bitəndə onun adına yazılır. Oxunmuş səhifələr {nameOf(u)} adına qalır.</p>
                                  )}
                                  <div className="flex flex-wrap items-end gap-2">
                                    <label className="flex-[1_1_200px] min-w-0 flex flex-col gap-1.5 text-xs font-semibold text-ink">
                                      {transferMode === "pages" ? "Kim kömək etsin?" : "Kimə ötürülsün?"}
                                      <select value={transferUid} onChange={(e) => setTransferUid(e.target.value)} className={inputCls}>
                                        <option value="">İştirakçı seç...</option>
                                        {activeGroupUsers.filter((m) => m.uid !== u.uid).map((m) => (
                                          <option key={m.uid} value={m.uid}>{nameOf(m)}</option>
                                        ))}
                                      </select>
                                    </label>
                                    <button type="button" disabled={!canSend} onClick={() => handleTransfer(a)} className={btn.primary}>
                                      {transferMode === "pages" ? `${helpPages.length} səhifəni ver` : "Cüzü ötür"}
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                  {membersWithoutOpen.length > 0 && (
                    <div className="text-sm text-muted">
                      Hazırda cüzü olmayanlar: {membersWithoutOpen.map((u) => nameOf(u)).join(", ")}
                    </div>
                  )}
                </div>

                {/* Free juz of the khatm being handed out */}
                <div className="flex flex-col gap-2.5 pt-4 border-t border-sand">
                  <div className="text-sm font-semibold text-ink">{khatmLabel(assigningKhatm)} · təyin edilməyib · {freeJuz.length} cüz</div>
                  <div className="grid grid-cols-6 md:grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-1.5">
                    {freeJuz.map((j) => (
                      <button
                        key={j}
                        type="button"
                        aria-label={`Cüz ${j} təyin et`}
                        title={JUZ_MAP[j]?.surah}
                        onClick={() => { setPickedJuz(pickedJuz === j ? null : j); setPickedUid(""); }}
                        className={`min-h-[44px] rounded-[10px] font-bold text-sm border ${
                          pickedJuz === j
                            ? "bg-forest text-white border-forest"
                            : "border-dashed border-[#BDB59F] bg-[#F3EEDF] text-[#4F4A39] hover:bg-sand"
                        }`}
                      >
                        {j}
                      </button>
                    ))}
                  </div>
                  {pickedJuz !== null && (
                    <div className="flex flex-wrap items-end gap-3 p-4 rounded-2xl bg-mint">
                      <label className="flex-[1_1_220px] min-w-0 flex flex-col gap-2 text-sm font-semibold text-ink">
                        Cüz {pickedJuz} ({khatmLabel(assigningKhatm)}, {JUZ_MAP[pickedJuz]?.surah}) kimə təyin edilsin?
                        <select value={pickedUid} onChange={(e) => setPickedUid(e.target.value)} className={inputCls}>
                          <option value="">İştirakçı seç...</option>
                          {activeGroupUsers.map((u) => (
                            <option key={u.uid} value={u.uid}>{nameOf(u)}</option>
                          ))}
                        </select>
                      </label>
                      <button type="button" disabled={!pickedUid} onClick={() => handleAssignJuz(pickedUid, pickedJuz)} className={btn.primary}>
                        Təyin et
                      </button>
                      <button type="button" onClick={() => setPickedJuz(null)} className={btn.outline}>Ləğv et</button>
                    </div>
                  )}
                </div>
              </Card>

              {/* Members */}
              <Card className="!gap-2">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
                  <div className="flex items-center gap-2.5">
                    <h2 className="m-0 text-base md:text-lg font-bold text-ink">İştirakçılar</h2>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-sand text-muted">{activeGroupUsers.length} nəfər</span>
                  </div>
                  <Link href="/mesajlar" className={button("outline", "sm")}>Toplu mesaj</Link>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Ad ilə axtar..."
                    className={`${inputCls} md:w-64 min-h-[44px]`}
                  />
                </div>
                {filteredUsers.length === 0 ? (
                  <p className="m-0 text-sm text-muted py-4">Heç bir iştirakçı tapılmadı.</p>
                ) : (
                  filteredUsers.map((u) => {
                    const s = memberShare(assignments, u.uid);
                    const isSelf = u.uid === currentUser.uid;
                    const isOwnerRow = u.uid === groupCreatedBy;
                    const role = roleOf(u.uid, currentUser.uid, groupCreatedBy, adminUids);
                    return (
                      <div key={u.uid} className="flex flex-wrap items-center gap-3 py-3.5 border-t border-sand">
                        <div className="flex-[1_1_200px] flex items-center gap-3 min-w-0">
                          <Avatar name={nameOf(u)} gold={!isSelf} />
                          <div className="min-w-0">
                            <div className="text-[15px] font-bold truncate">{nameOf(u)}</div>
                            <div className="text-xs text-muted">
                              {role} · {s.label}
                            </div>
                            {threads[u.uid]?.managerUnread ? (
                              <div className="text-xs font-bold text-forest">Yeni cavab var</div>
                            ) : threads[u.uid]?.lastFrom === "manager" && (
                              <div className="text-xs font-semibold text-goldtext">
                                Mesaj {threads[u.uid].memberUnread ? "hələ oxunmayıb" : "oxunub"}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex-[1_1_140px] flex flex-col gap-1">
                          <div className="text-xs text-muted">{s.total > 0 ? `${s.done} / ${s.total} səhifə · ` : s.finished > 0 ? "Payı bitib · " : ""}{s.finished} cüz bitib</div>
                          <Bar ratio={s.ratio} color={s.status === "done" ? "done" : "accent"} />
                        </div>
                        {role !== "İştirakçı" && <Chip tone="owner">{role}</Chip>}
                        {/* No messaging or removing yourself */}
                        {!isSelf && (
                          <div className="flex gap-2">
                            {isGroupCreator && <button onClick={() => setMessageTarget(u)} className={button("outline", "sm")}>Mesaj</button>}
                            {!isOwnerRow && <button onClick={() => handleRemoveUser(u)} className={button("danger", "sm")}>Çıxar</button>}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </Card>

            </div>

            {/* Right column */}
            <div className="flex-[1_1_300px] min-w-0 flex flex-col gap-5 md:gap-7">
              <Card>
                <h2 className="m-0 text-[15px] font-bold text-muted">İdarə olunan qrup</h2>
                <label className="flex flex-col gap-2">
                  <span className="sr-only">Qrup seç</span>
                  <select
                    value={activeGroupId}
                    onChange={(e) => {
                      setActiveGroupId(e.target.value);
                      setGroupStartDate("");
                      setGroupEndDate("");
                      loadData(e.target.value);
                    }}
                    className={`${inputCls} font-semibold`}
                  >
                    {!createdGroups.some((g) => g.id === activeGroupId) && activeGroup && (
                      <option value={activeGroupId}>{activeGroup.name}</option>
                    )}
                    {createdGroups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </label>
                <Bar ratio={totalUniqueCompleted / 604} height={12} />
                <div className="text-[13px] text-muted">{totalUniqueCompleted} / 604 səhifə · {activeGroupUsers.length} iştirakçı</div>
                <Link href="/groups" className="text-sm font-semibold text-forest underline underline-offset-4">Yeni qrup yarat</Link>
              </Card>

              <Card>
                <h2 className="m-0 font-bold text-lg md:text-[22px] text-ink">Arxiv</h2>
                <div className="text-sm leading-relaxed text-muted">
                  Tamamlanmış xətmlər və hamının bitirdiyi bölgülər Qrup ekranından çıxır və burada saxlanır.
                </div>
                <Link href="/admin/arxiv" className={button("outline")}>Arxivə bax</Link>
              </Card>


            </div>
          </div>
        )}
      </div>
      {settingsOpen && <AdminSettingsPanel onClose={closeSettings} />}
      {messageTarget && (
        <ThreadDialog
          groupId={activeGroupId}
          groupName={groupName}
          memberUid={messageTarget.uid}
          memberName={nameOf(messageTarget)}
          summary={threads[messageTarget.uid]}
          onClose={closeThread}
        />
      )}
    </AppLayout>
  );
}

