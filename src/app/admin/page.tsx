"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import {
  getGroupMembers,
  distributeJuz,
  assignJuzManually,
  transferAssignment,
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
import { JuzBadge, memberShare, participantName, roleOf } from "@/components/GroupWidgets";
import { useGroupAdmins, useGroupAssignments, useGroupFullNames, useGroupThreads } from "@/lib/useGroupData";
import { StatStrip, Up } from "@/components/dash";
import { khatmSummaries, MAX_OPEN_ASSIGNMENTS, openAssignmentsOf, openKhatmForAssignment, type Assignment } from "@/lib/khatm";
import {
  Avatar, Bar, Card, Chip, DateInput, LoadingScreen, PageHeader, btn, button, inputCls
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
  // Removing a member who still has unfinished juz: who takes them over
  const [removeFor, setRemoveFor] = useState<string | null>(null);
  const [removeTo, setRemoveTo] = useState("");
  // Juz left behind by members who are no longer in the group: who takes each one over
  const [orphanTo, setOrphanTo] = useState<Record<string, string>>({});

  // The leader's conversation with one member (bulk messages live in Mesajlar)
  const [messageTarget, setMessageTarget] = useState<UserDoc | null>(null);
  const closeThread = useCallback(() => setMessageTarget(null), []);
  // Settings panel (invite link, privacy, danger zone) opened from the gear button
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    if (window.location.search.includes("ayarlar")) window.history.replaceState(null, "", "/admin");
  }, []);
  // The gear in the desktop top bar links here with ?ayarlar=1
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("ayarlar")) setSettingsOpen(true);
    const open = () => setSettingsOpen(true);
    window.addEventListener("xetm:open-settings", open);
    return () => window.removeEventListener("xetm:open-settings", open);
  }, []);

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

  // Default dates for the next distribution: 4 days, starting the day after the current distribution
  // ends (e.g. current ends on the 10th -> 11th..14th); never in the past; today..+3 when there is none
  const lastEnd = activeGroup?.lastDistribution?.endDate
    || assignments.reduce((m, a) => (a.endDate && a.endDate > m ? a.endDate : m), "");
  useEffect(() => {
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const today = new Date();
    const todayIso = iso(today);
    let start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (lastEnd) {
      const [y, m, d] = lastEnd.split("-").map(Number);
      const next = new Date(y, m - 1, d + 1);
      if (iso(next) > todayIso) start = next;
    }
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 3);
    setGroupStartDate(iso(start));
    setGroupEndDate(iso(end));
  }, [activeGroupId, lastEnd]);

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
  const currentKhatm = summaries.find((k) => !k.completedAt) || null;
  const totalUniqueCompleted = currentKhatm?.pagesRead || 0;
  const { khatm: assigningKhatm, free: freeJuz } = openKhatmForAssignment(assignments);
  const openOf = (uid: string) => openAssignmentsOf(assignments, uid);
  const membersWithOpen = activeGroupUsers.filter((u) => openOf(u.uid).length > 0);
  const membersWithoutOpen = activeGroupUsers.filter((u) => openOf(u.uid).length === 0);
  const memberByUid = (uid: string) => users.find((u) => u.uid === uid);
  // Unfinished juz whose holder left or was removed: they stay in the khatm until handed to someone
  const memberUids = new Set(activeGroupUsers.map((u) => u.uid));
  const orphaned = assignments
    .filter((a) => !a.done && !memberUids.has(a.uid))
    .sort((a, b) => a.khatm - b.khatm || a.juz - b.juz);
  const formerName = (uid: string) => fullNames[uid] || "Keçmiş üzv";

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



  // Pages given to the member to help with go back to the holder; the ones they read stay theirs
  const takeBackHelpOf = async (uid: string) => {
    for (const a of assignments) {
      if (!a.done && (a.helpers || []).some((h) => h.uid === uid && h.pages.some((p) => !a.completedPages.includes(p)))) {
        await takeBackHelpPages(activeGroupId, a, uid);
      }
    }
  };

  const removeMember = async (user: UserDoc, to: string | null) => {
    try {
      setLoading(true);
      if (to) {
        for (const a of openOf(user.uid)) {
          await transferAssignment(activeGroupId, a, to);
        }
      }
      await takeBackHelpOf(user.uid);
      await removeUserFromGroup(user, activeGroupId);
      setRemoveFor(null);
      setRemoveTo("");
      await loadData();
    } catch (err) {
      console.error("Error removing user:", err);
      alert(err instanceof Error ? err.message : "Kənarlaşdırma zamanı xəta baş verdi.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveUser = (user: UserDoc) => {
    // A member with unfinished juz first chooses who reads them
    if (openOf(user.uid).length > 0) {
      setRemoveFor(removeFor === user.uid ? null : user.uid);
      setRemoveTo("");
      return;
    }
    if (window.confirm(`${nameOf(user)} adlı iştirakçını “${groupName}” qrupundan kənarlaşdırmaq istədiyinizə əminsiniz?`)) {
      removeMember(user, null);
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

  const handleTransferOrphan = async (a: Assignment) => {
    const to = orphanTo[a.id];
    if (!to) return;
    try {
      await transferAssignment(activeGroupId, a, to);
      setOrphanTo((prev) => {
        const next = { ...prev };
        delete next[a.id];
        return next;
      });
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
  const openJuzCount = assignments.filter((a) => !a.done).length;

  // Join requests: one row per person with approve and reject
  const requestRows = pendingGroupUsers.map((u) => (
    <div key={u.uid} className="flex flex-wrap items-center justify-between gap-3 bg-white md:bg-white rounded-btn p-3 border border-line md:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar name={nameOf(u)} gold />
        <span className="text-[15px] font-bold truncate">{nameOf(u)}</span>
      </div>
      <div className="flex gap-2">
        <button onClick={() => handleApproveUser(u.uid)} className={button("primary", "sm")}>Təsdiq et</button>
        <button onClick={() => handleRejectUser(u)} className={button("danger", "sm")}>Rədd et</button>
      </div>
    </div>
  ));

  return (
    <AppLayout activeTab="admin">
      <div className="flex flex-col gap-5 md:gap-7">
        <PageHeader
          title="İnzibatçı paneli"
          subtitle={isCreatorOfGroup ? `${groupName} · bölgü, iştirakçılar və istəklər` : undefined}
          tabs={isCreatorOfGroup ? [
            ...(pendingGroupUsers.length > 0 ? [{ id: "istekler", label: "İstəklər" }] : []),
            { id: "bolgu", label: "Cüz bölgüsü" },
            { id: "uzvler", label: "İştirakçılar" },
            { id: "arxiv", label: "Arxiv" },
          ] : undefined}
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
          <>
          {/* Phone: two figures. Participants jumps to the list, requests open as a pop-up */}
          <section aria-label="Xülasə" className="md:hidden grid grid-cols-2 bg-white rounded-[18px] shadow-panel">
            <a href="#uzvler" className="press px-4 py-3.5 flex flex-col min-w-0">
              <span className="text-[12px] font-bold text-muted">İştirakçılar</span>
              <span className="mt-2 mb-1.5 text-[24px] font-extrabold leading-none tabular-nums text-ink">{activeGroupUsers.length}</span>
              <span className="text-[11.5px] text-forest font-bold">Siyahıya bax</span>
            </a>
            <button
              type="button"
              onClick={() => setRequestsOpen(true)}
              aria-haspopup="dialog"
              className="press px-4 py-3.5 flex flex-col items-start min-w-0 text-left border-l border-line"
            >
              <span className="text-[12px] font-bold text-muted">Qoşulmaq istəyənlər</span>
              <span className="mt-2 mb-1.5 text-[24px] font-extrabold leading-none tabular-nums text-ink">{pendingGroupUsers.length}</span>
              <span className="text-[11.5px]">{pendingGroupUsers.length > 0 ? <Up tone="warn">Bax və təsdiq et</Up> : <span className="text-muted">Yeni istək yoxdur</span>}</span>
            </button>
          </section>
          <div className="hidden md:block">
          <StatStrip
            items={[
              {
                label: currentKhatm ? khatmLabel(currentKhatm.khatm) : "Cari xətm",
                value: totalUniqueCompleted,
                unit: `/ ${currentKhatm?.totalPages || 604}`,
                note: <><Up>{pct}%</Up> oxunub</>,
              },
              {
                label: "Oxunan cüzlər",
                value: openJuzCount,
                note: `${currentKhatm?.done ?? 0} / 30 cüz bitib`,
              },
              {
                label: "İştirakçılar",
                value: activeGroupUsers.length,
                note: groupName,
              },
              {
                label: "Qoşulmaq istəyənlər",
                value: pendingGroupUsers.length,
                note: pendingGroupUsers.length > 0 ? <Up tone="warn">Təsdiq gözləyir</Up> : "Yeni istək yoxdur",
              },
            ]}
          />
          </div>
          <div className="flex flex-wrap gap-5 md:gap-7 items-start">

            {/* Left column */}
            <div className="flex-[999_1_560px] min-w-0 flex flex-col gap-5 md:gap-7">

              {/* Pending requests (desktop; on the phone they open from the figure card) */}
              {pendingGroupUsers.length > 0 && (
                <section id="istekler" className="scroll-mt-28 hidden md:flex bg-progress rounded-card p-[18px] md:p-6 flex-col gap-3.5">
                  <div className="flex items-center gap-2.5">
                    <h2 className="m-0 text-base md:text-lg font-bold text-progresstext">Qoşulmaq istəyənlər</h2>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white text-progresstext">{pendingGroupUsers.length}</span>
                  </div>
                  {requestRows}
                </section>
              )}

              {/* Juz distribution */}
              <Card id="bolgu" className="scroll-mt-28 md:!p-7 !gap-[22px]">
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

                {/* Juz of members who left or were removed: free until someone takes them over */}
                {orphaned.length > 0 && (
                  <div className="flex flex-col gap-3 pt-4 border-t border-sand">
                    <div className="text-sm font-semibold text-ink">Qrupdan çıxanların cüzləri · {orphaned.length}</div>
                    <p className="m-0 text-xs text-muted">
                      Bu cüzlər boşdadır. Birinə ötürün ki, xətm yarımçıq qalmasın. Oxunmuş səhifələr çıxan şəxsin adına qalır.
                    </p>
                    {orphaned.map((a) => (
                      <div key={a.id} className="flex flex-col gap-2.5 px-4 py-3.5 rounded-2xl bg-progress">
                        <div className="text-sm">
                          <span className="font-extrabold text-ink">Cüz {a.juz}</span>
                          <span className="text-progresstext"> · {khatmLabel(a.khatm)} · {a.completedPages.length} / {a.pages.length} səhifə · {formerName(a.uid)}</span>
                        </div>
                        <div className="flex flex-wrap items-end gap-2">
                          <label className="flex-[1_1_200px] min-w-0 flex flex-col gap-1.5 text-xs font-semibold text-ink">
                            Kimə ötürülsün?
                            <select
                              value={orphanTo[a.id] || ""}
                              onChange={(e) => setOrphanTo((prev) => ({ ...prev, [a.id]: e.target.value }))}
                              className={inputCls}
                            >
                              <option value="">İştirakçı seç...</option>
                              {activeGroupUsers.map((m) => (
                                <option key={m.uid} value={m.uid}>{nameOf(m)}</option>
                              ))}
                            </select>
                          </label>
                          <button type="button" disabled={!orphanTo[a.id]} onClick={() => handleTransferOrphan(a)} className={btn.primary}>Ötür</button>
                          <button type="button" onClick={() => handleRemoveAssignment(a)} className={button("danger", "sm")}>Ləğv et</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Free juz of the khatm being handed out */}
                <div className="flex flex-col gap-2.5 pt-4 border-t border-sand">
                  <div className="text-sm font-semibold text-ink">{khatmLabel(assigningKhatm)} · təyin edilməyib · {freeJuz.length} cüz</div>
                  <div className="flex flex-wrap gap-2">
                    {freeJuz.map((j) => (
                      <JuzBadge
                        key={j}
                        size="sm"
                        juz={j}
                        state="empty"
                        sub="Boş"
                        selected={pickedJuz === j}
                        onClick={() => { setPickedJuz(pickedJuz === j ? null : j); setPickedUid(""); }}
                        label={`Cüz ${j} təyin et`}
                        title={JUZ_MAP[j]?.surah}
                      />
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
              <Card id="uzvler" className="scroll-mt-28 !gap-2">
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
                            {!isOwnerRow && <button onClick={() => handleRemoveUser(u)} aria-expanded={removeFor === u.uid} className={button("danger", "sm")}>Çıxar</button>}
                          </div>
                        )}
                        {removeFor === u.uid && (() => {
                          const open = openOf(u.uid);
                          return (
                            <div className="basis-full flex flex-col gap-3 p-4 rounded-2xl bg-progress">
                              <p className="m-0 text-sm text-ink">
                                <strong>{nameOf(u)}</strong> adlı iştirakçının bitməmiş cüzü var: {open.map((a) => `Cüz ${a.juz} (${a.completedPages.length} / ${a.pages.length})`).join(", ")}.
                                Qrupdan çıxarmadan əvvəl kimə ötürülsün?
                              </p>
                              <div className="flex flex-wrap items-end gap-2">
                                <label className="flex-[1_1_200px] min-w-0 flex flex-col gap-1.5 text-xs font-semibold text-ink">
                                  Kimə ötürülsün?
                                  <select value={removeTo} onChange={(e) => setRemoveTo(e.target.value)} className={inputCls}>
                                    <option value="">İştirakçı seç...</option>
                                    {activeGroupUsers.filter((m) => m.uid !== u.uid).map((m) => (
                                      <option key={m.uid} value={m.uid}>{nameOf(m)}</option>
                                    ))}
                                  </select>
                                </label>
                                <button type="button" disabled={!removeTo} onClick={() => removeMember(u, removeTo)} className={btn.primary}>
                                  Ötür və çıxar
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => removeMember(u, null)} className={button("danger", "sm")}>Ötürmədən çıxar</button>
                                <button type="button" onClick={() => setRemoveFor(null)} className={button("outline", "sm")}>İmtina</button>
                              </div>
                              <p className="m-0 text-xs text-progresstext">
                                Ötürmədən çıxarsanız, cüz boşda qalır və sonra “Qrupdan çıxanların cüzləri” bölməsindən ötürə bilərsiniz.
                              </p>
                            </div>
                          );
                        })()}
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

              <Card id="arxiv" className="scroll-mt-28">
                <h2 className="m-0 font-bold text-lg md:text-[22px] text-ink">Arxiv</h2>
                <div className="text-sm leading-relaxed text-muted">
                  Tamamlanmış xətmlər və hamının bitirdiyi bölgülər Qrup ekranından çıxır və burada saxlanır.
                </div>
                <Link href="/admin/arxiv" className={button("outline")}>Arxivə bax</Link>
              </Card>


            </div>
          </div>
          </>
        )}
      </div>
      {settingsOpen && <AdminSettingsPanel onClose={closeSettings} />}
      {requestsOpen && (
        <div className="fade-in fixed inset-0 z-[60] bg-[#0B1F33]/55 backdrop-blur-[2px] flex items-end md:items-center justify-center" onClick={() => setRequestsOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="istekler-title"
            onClick={(e) => e.stopPropagation()}
            className="rise-in md:pop-in w-full md:w-[520px] max-h-[80vh] overflow-y-auto bg-white rounded-t-[24px] md:rounded-[24px] p-5 pb-safe flex flex-col gap-3.5"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="istekler-title" className="m-0 text-[18px] font-extrabold text-ink">Qoşulmaq istəyənlər</h2>
              <button
                type="button"
                onClick={() => setRequestsOpen(false)}
                aria-label="Bağla"
                className="press w-11 h-11 -mr-2 rounded-full grid place-items-center text-muted hover:bg-cream"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
            {pendingGroupUsers.length > 0 ? requestRows : <p className="m-0 text-[14px] text-muted">Yeni istək yoxdur.</p>}
          </div>
        </div>
      )}
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

