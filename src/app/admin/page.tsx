"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import {
  getGroupMembers,
  distributeJuz,
  assignJuzManually,
  transferAssignment,
  removeAssignment,
  resetGroupAssignments,
  sendMemberMessage,
  updateUserApproval,
  getUserGroupIds,
  isUserApprovedInGroup,
  removeUserFromGroup,
  type UserDoc,
  type GroupDoc
} from "@/lib/db";
import AppLayout from "@/components/AppLayout";
import { db } from "@/lib/firebase";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { JUZ_MAP, khatmLabel, ordinalAz } from "@/lib/quran";
import { memberShare, participantName } from "@/components/GroupWidgets";
import { useGroupAssignments, useGroupFullNames, useGroupMessages } from "@/lib/useGroupData";
import { khatmSummaries, MAX_OPEN_ASSIGNMENTS, openAssignmentsOf, openKhatmForAssignment, type Assignment } from "@/lib/khatm";
import { relativeTimeAz } from "@/lib/dates";
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

  // Message to a member
  const [messageTarget, setMessageTarget] = useState<UserDoc | null>(null);
  const [messageText, setMessageText] = useState("");
  const [messageSending, setMessageSending] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  const [createdGroups, setCreatedGroups] = useState<GroupDoc[]>([]);
  const canManage = !!currentUser && (isSuperAdmin || activeGroup?.createdBy === currentUser.uid);
  const fullNames = useGroupFullNames(activeGroupId, canManage);
  const messages = useGroupMessages(activeGroupId, canManage);
  const { assignments } = useGroupAssignments(activeGroupId, canManage);
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
        await resetGroupAssignments(activeGroupId);
        setAutoMessage("Bütün təyinatlar silindi.");
      } catch (err) {
        console.error("Error clearing assignments:", err);
        alert("Təmizləmə zamanı xəta baş verdi.");
      } finally {
        setLoading(false);
      }
    }
  };

  const openMessage = (user: UserDoc) => {
    setMessageTarget(user);
    setMessageText(messages[user.uid]?.text || "");
    setMessageError(null);
  };

  // Empty text clears the current message
  const submitMessage = async (text: string) => {
    if (!messageTarget) return;
    setMessageSending(true);
    setMessageError(null);
    try {
      await sendMemberMessage(messageTarget.uid, activeGroupId, text);
      setMessageTarget(null);
      setMessageText("");
    } catch (err) {
      console.error("Error sending member message:", err);
      setMessageError("Mesaj göndərilərkən xəta baş verdi.");
    } finally {
      setMessageSending(false);
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
      alert("Cüz təyinatı zamanı xəta baş verdi.");
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
      alert("Təyinatı silərkən xəta baş verdi.");
    }
  };

  const handleTransfer = async (a: Assignment) => {
    if (!transferUid) return;
    try {
      await transferAssignment(activeGroupId, a, transferUid);
      setTransferFor(null);
      setTransferUid("");
    } catch (err) {
      console.error("Error transferring assignment:", err);
      alert("Cüzü ötürərkən xəta baş verdi.");
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
        `${ordinalAz(r.distribution)} bölgü: ${r.assigned} cüz paylandı.` +
        (skippedNames.length > 0 ? ` Geri qaldığı üçün cüz verilmədi: ${skippedNames.join(", ")}.` : "")
      );
    } catch (err) {
      console.error(err);
      setAutoMessage("Paylanma zamanı xəta baş verdi.");
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
          subtitle={isCreatorOfGroup ? `${groupName} qrupunu idarə et: cüzləri böl, iştirakçıları dəvət et` : groupName}
          actions={isCreatorOfGroup ? (
            <Link href="/admin/settings" className={`${button("outline")} w-full md:w-auto`}>
              <IconSettings size={18} />
              Ayarlar
            </Link>
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
                                <button type="button" onClick={() => { setTransferFor(transferFor === a.id ? null : a.id); setTransferUid(""); }} className={button("outline", "sm")}>Ötür</button>
                                <button type="button" onClick={() => handleRemoveAssignment(a)} className={button("danger", "sm")}>Ləğv et</button>
                              </div>
                            </div>
                            {transferFor === a.id && (
                              <div className="flex flex-wrap items-end gap-2">
                                <label className="flex-[1_1_200px] min-w-0 flex flex-col gap-1.5 text-xs font-semibold text-ink">
                                  Kimə ötürülsün? Oxunmuş səhifələr {nameOf(u)} adına qalır.
                                  <select value={transferUid} onChange={(e) => setTransferUid(e.target.value)} className={inputCls}>
                                    <option value="">İştirakçı seç...</option>
                                    {activeGroupUsers.filter((m) => m.uid !== u.uid).map((m) => (
                                      <option key={m.uid} value={m.uid}>{nameOf(m)}</option>
                                    ))}
                                  </select>
                                </label>
                                <button type="button" disabled={!transferUid} onClick={() => handleTransfer(a)} className={btn.primary}>Ötür</button>
                              </div>
                            )}
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
                    return (
                      <div key={u.uid} className="flex flex-wrap items-center gap-3 py-3.5 border-t border-sand">
                        <div className="flex-[1_1_200px] flex items-center gap-3 min-w-0">
                          <Avatar name={nameOf(u)} gold={!isSelf} />
                          <div className="min-w-0">
                            <div className="text-[15px] font-bold truncate">{nameOf(u)}</div>
                            <div className="text-xs text-muted">
                              {isOwnerRow ? "Qrup sahibi" : "İştirakçı"} · {s.label}
                            </div>
                            {messages[u.uid] && (
                              <div className="text-xs font-semibold text-goldtext">
                                Mesaj {messages[u.uid].read ? "oxunub" : "hələ oxunmayıb"}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex-[1_1_140px] flex flex-col gap-1">
                          <div className="text-xs text-muted">{s.total > 0 ? `${s.done} / ${s.total} səhifə · ` : s.finished > 0 ? "Payı bitib · " : ""}{s.finished} cüz bitib</div>
                          <Bar ratio={s.ratio} color={s.status === "done" ? "done" : "accent"} />
                        </div>
                        {isOwnerRow && <Chip tone="owner">Qrup sahibi</Chip>}
                        {/* No messaging or removing yourself */}
                        {!isSelf && (
                          <div className="flex gap-2">
                            <button onClick={() => openMessage(u)} className={button("outline", "sm")}>Mesaj</button>
                            <button onClick={() => handleRemoveUser(u)} className={button("danger", "sm")}>Çıxar</button>
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

              <section className="bg-mint rounded-card p-[18px] md:p-6 flex flex-col gap-3.5">
                <h2 className="m-0 font-bold text-lg md:text-[22px] text-ink">AI köməkçi</h2>
                <div className="text-sm leading-relaxed text-[#2F4A3E]">Günün ayə və hədisini AI ilə yaz, Quran və hədislər barədə suallarını ver.</div>
                <Link href="/admin/ai" className={btn.primary}>
                  <IconSparkle size={18} />
                  Köməkçini aç
                </Link>
              </section>

            </div>
          </div>
        )}
      </div>
      {messageTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-4">
          <form
            onSubmit={(e) => { e.preventDefault(); submitMessage(messageText); }}
            className="bg-white border border-line rounded-hero shadow-bar p-6 w-full max-w-md flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1">
              <h3 className="m-0 font-bold text-2xl text-ink">Mesaj göndər</h3>
              <div className="text-sm text-muted">
                {nameOf(messageTarget)} · {groupName}
              </div>
            </div>
            {messages[messageTarget.uid] && (
              <div className="text-xs text-muted">
                Əvvəlki mesaj {relativeTimeAz(new Date(messages[messageTarget.uid].sentAt).getTime())} göndərilib
                {messages[messageTarget.uid].read ? " və oxunub." : ", hələ oxunmayıb."}
              </div>
            )}
            <label className="flex flex-col gap-2 text-sm font-semibold text-ink">
              Mesaj
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={4}
                maxLength={500}
                autoFocus
                placeholder="Məs. Cüzünü cümə gününə qədər bitirməyə çalış"
                className={`${inputCls} py-3 resize-y`}
              />
            </label>
            <div className="text-xs text-muted">İştirakçı mesajı &quot;Bu gün&quot; ekranında görəcək və telefonuna bildiriş gələcək.</div>
            {messageError && <div className="text-sm font-semibold text-danger">{messageError}</div>}
            <div className="flex flex-wrap gap-2.5">
              <button type="submit" disabled={messageSending || !messageText.trim()} className={`${btn.primary} flex-1`}>
                {messageSending ? "Göndərilir..." : "Göndər"}
              </button>
              {messages[messageTarget.uid] && (
                <button type="button" disabled={messageSending} onClick={() => submitMessage("")} className={btn.danger}>
                  Mesajı sil
                </button>
              )}
              <button type="button" disabled={messageSending} onClick={() => setMessageTarget(null)} className={btn.outline}>
                Ləğv et
              </button>
            </div>
          </form>
        </div>
      )}
    </AppLayout>
  );
}

