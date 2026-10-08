"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import {
  getAllUsers,
  getGroupSettings,
  setGroupSettings,
  setAssignmentForUser,
  distributeJuzToUsers,
  clearAllAssignments,
  updateUserAdminNotification,
  updateUserApproval,
  getUserGroupIds,
  getUserAssignment,
  deleteGroup,
  isUserApprovedInGroup,
  removeUserFromGroup,
  type UserDoc,
  type AppSettings,
  type GroupDoc
} from "@/lib/db";
import AppLayout from "@/components/AppLayout";
import { db } from "@/lib/firebase";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { JUZ_MAP, juzPages, pageRangesLabel } from "@/lib/quran";
import { participantStats } from "@/components/GroupWidgets";
import {
  Avatar, Bar, Card, Chip, IconLink, IconSparkle, IconTrash, LoadingScreen, PageHeader, btn, button, inputCls
} from "@/components/ui";

export default function AdminPage() {
  const { user: currentUser, loading: authLoading, activeGroupId, setActiveGroupId, activeGroup, activeGroupLoaded, isSuperAdmin } = useAuth();
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Manual page assignment form
  const [selectedUser, setSelectedUser] = useState<UserDoc | null>(null);
  const [pagesInput, setPagesInput] = useState("");
  const [startDateInput, setStartDateInput] = useState("");
  const [endDateInput, setEndDateInput] = useState("");
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);

  // Auto distribution
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoMessage, setAutoMessage] = useState<string | null>(null);

  // Login page / daily settings
  const [settings, setSettings] = useState<AppSettings>({ currentAyah: "", currentHadith: "" });
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Juz distribution dates
  const [groupStartDate, setGroupStartDate] = useState("");
  const [groupEndDate, setGroupEndDate] = useState("");
  const [pickedJuz, setPickedJuz] = useState<number | null>(null);
  const [pickedUid, setPickedUid] = useState("");

  const [createdGroups, setCreatedGroups] = useState<GroupDoc[]>([]);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [groupCreatedBy, setGroupCreatedBy] = useState<string | null>(null);

  async function loadData(groupId = activeGroupId) {
    try {
      const allUsers = await getAllUsers();
      setUsers(allUsers);
      const appSettings = await getGroupSettings(groupId);
      setSettings(appSettings);
    } catch (err) {
      console.error("Error loading admin data:", err);
    } finally {
      setLoading(false);
    }
  }

  // Real-time listener for users
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
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
  }, []);

  // Real-time listener for settings based on activeGroupId
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
          currentAyah: data.currentAyah || "İnna lilləhi və inna ileyhi raciun",
          currentHadith: data.currentHadith || "Sizin ən xeyirliniz Quranı öyrənən və onu başqalarına öyrədəndir.",
          lastDistributedJuz: data.lastDistributedJuz || 0,
          cycleStartJuz: data.cycleStartJuz || 1,
          completedKhatms: data.completedKhatms || 0,
          isCurrentKhatmCompleted: data.isCurrentKhatmCompleted || false,
          currentDailyItem: data.currentDailyItem,
          lastDailyUpdate: data.lastDailyUpdate
        });
      }
    }, (err) => {
      console.error("Error in real-time settings listener:", err);
    });

    return () => unsubSettings();
  }, [activeGroupId]);

  // Real-time listener for groups created by this user
  useEffect(() => {
    if (!currentUser) return;
    const unsubGroups = onSnapshot(collection(db, "groups"), (snapshot) => {
      const list: GroupDoc[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.createdBy === currentUser.uid) {
          list.push({ id: docSnap.id, ...data } as GroupDoc);
        }
      });
      setCreatedGroups(list);
    }, (err) => {
      console.error("Error in real-time groups listener:", err);
    });

    return () => unsubGroups();
  }, [currentUser]);

  // Set default group dates based on current assignments if available
  useEffect(() => {
    const groupUsers = users.filter(u => getUserGroupIds(u).includes(activeGroupId));
    const assignedUser = groupUsers.find(u => getUserAssignment(u, activeGroupId).assignmentStartDate);
    if (assignedUser) {
      const assignment = getUserAssignment(assignedUser, activeGroupId);
      if (!groupStartDate) setGroupStartDate(assignment.assignmentStartDate || "");
      if (!groupEndDate) setGroupEndDate(assignment.assignmentEndDate || "");
    }
  }, [users, activeGroupId, groupStartDate, groupEndDate]);

  if (authLoading || loading || !activeGroupLoaded) {
    return <LoadingScreen text="İnzibatçı paneli yüklənir..." />;
  }

  if (!currentUser) {
    return null; // Guarded by middleware
  }

  const isCreatorOfGroup = isSuperAdmin || (!!activeGroup && activeGroup.createdBy === currentUser.uid);
  const groupName = activeGroup?.name || "Qrup";

  const groupUsers = users.filter((u) =>
    getUserGroupIds(u).includes(activeGroupId) ||
    (groupCreatedBy && u.uid === groupCreatedBy)
  );
  const activeGroupUsers = groupUsers.filter((u) => isUserApprovedInGroup(u, activeGroupId, activeGroup));
  const pendingGroupUsers = groupUsers.filter((u) => !isUserApprovedInGroup(u, activeGroupId, activeGroup));

  // Unique pages completed by the group out of 604
  const completedPagesSet = new Set<number>();
  activeGroupUsers.forEach((u) => {
    const assignment = getUserAssignment(u, activeGroupId);
    const assigned = assignment.assignedPages || [];
    const completed = assignment.completedPages || [];
    completed.forEach((page) => {
      if (page >= 1 && page <= 604 && assigned.includes(page)) {
        completedPagesSet.add(page);
      }
    });
  });
  const totalUniqueCompleted = completedPagesSet.size;

  // Juz ownership in the active group
  const juzsOf = (u: UserDoc): number[] => {
    const a = getUserAssignment(u, activeGroupId);
    return a.assignedJuzs && a.assignedJuzs.length > 0 ? a.assignedJuzs : a.assignedJuz ? [a.assignedJuz] : [];
  };
  const takenJuz = new Set<number>(activeGroupUsers.flatMap(juzsOf));
  const freeJuz = Array.from({ length: 30 }, (_, i) => i + 1).filter((j) => !takenJuz.has(j));

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
    if (window.confirm(`${user.name} adlı iştirakçının qoşulmaq istəyini rədd etmək istəyirsiniz?`)) {
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

  const handleCopyInviteLink = () => {
    if (activeGroupId === "default") return;
    const inviteLink = `${window.location.origin}/?invite=${activeGroupId}`;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 3000);
    });
  };

  const handleDeleteGroup = async () => {
    if (activeGroupId === "default") return;
    if (window.confirm(`“${groupName}” qrupunu silmək istədiyinizdən əminsiniz? Qrupa aid bütün oxunma məlumatları və üzvlük qeydləri silinəcək.`)) {
      try {
        setLoading(true);
        await deleteGroup(activeGroupId);

        const remaining = createdGroups.filter(g => g.id !== activeGroupId);
        if (remaining.length > 0) {
          setActiveGroupId(remaining[0].id);
          await loadData(remaining[0].id);
        } else {
          const userRef = doc(db, "users", currentUser.uid);
          await updateDoc(userRef, { isOnboarded: false, groupId: "" });
          window.location.href = "/dashboard";
        }
      } catch (err) {
        console.error("Error deleting group:", err);
        alert("Qrupu silərkən xəta baş verdi.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleClearAll = async () => {
    if (window.confirm("Bütün iştirakçıların səhifə təyinatlarını və arxiv tarixçələrini tamamilə sıfırlamaq (təmizləmək) istəyirsiniz?")) {
      try {
        setLoading(true);
        await clearAllAssignments(activeGroupId);
        await loadData();
      } catch (err) {
        console.error("Error clearing assignments:", err);
        alert("Təmizləmə zamanı xəta baş verdi.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleNotifyClick = async (user: UserDoc) => {
    const msg = window.prompt(
      "İştirakçıya bildiriş daxil edin (Boş buraxdıqda mövcud bildiriş silinir):",
      user.adminNotification || ""
    );
    if (msg !== null) {
      try {
        await updateUserAdminNotification(user.uid, msg, activeGroupId);
        await loadData();
      } catch (err) {
        console.error("Error updating admin notification:", err);
        alert("Bildiriş göndərilərkən xəta baş verdi.");
      }
    }
  };

  const handleRemoveUser = async (user: UserDoc) => {
    if (window.confirm(`${user.name} adlı iştirakçını “${groupName}” qrupundan kənarlaşdırmaq istədiyinizə əminsiniz?`)) {
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

    const userToAssign = users.find(u => u.uid === uid);
    const assignment = userToAssign ? getUserAssignment(userToAssign, activeGroupId) : null;
    if (userToAssign && assignment && assignment.assignedPages && assignment.assignedPages.length > 0) {
      if (!window.confirm(`${userToAssign.name} adlı iştirakçının artıq mövcud təyinatı var. Onu silib bu Cüzlə əvəz etmək istəyirsiniz?`)) {
        return;
      }
    }

    try {
      setLoading(true);
      await setAssignmentForUser(uid, juzPages(juzNum), groupStartDate, groupEndDate, juzNum, activeGroupId);
      setPickedJuz(null);
      setPickedUid("");
      await loadData();
    } catch (err) {
      console.error("Error assigning juz:", err);
      alert("Cüz təyinatı zamanı xəta baş verdi.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveJuzAssignment = async (user: UserDoc) => {
    const assignment = getUserAssignment(user, activeGroupId);
    const label = assignment.assignedJuz ? `Cüz ${assignment.assignedJuz}` : "səhifə";
    if (window.confirm(`${user.name} adlı iştirakçının ${label} təyinatını ləğv etmək istəyirsiniz?`)) {
      try {
        setLoading(true);
        await setAssignmentForUser(user.uid, [], "", "", undefined, activeGroupId);
        await loadData();
      } catch (err) {
        console.error("Error removing juz assignment:", err);
        alert("Təyinatı silərkən xəta baş verdi.");
      } finally {
        setLoading(false);
      }
    }
  };

  const parsePagesString = (input: string): number[] => {
    const result: number[] = [];
    for (let part of input.split(",")) {
      part = part.trim();
      if (part.includes("-")) {
        const [startStr, endStr] = part.split("-");
        const start = parseInt(startStr.trim(), 10);
        const end = parseInt(endStr.trim(), 10);
        if (!isNaN(start) && !isNaN(end) && start <= end) {
          for (let i = start; i <= end; i++) {
            if (i >= 1 && i <= 604) result.push(i);
          }
        }
      } else {
        const page = parseInt(part, 10);
        if (!isNaN(page) && page >= 1 && page <= 604) result.push(page);
      }
    }
    return Array.from(new Set(result)).sort((a, b) => a - b);
  };

  const handleSelectUser = (user: UserDoc) => {
    setSelectedUser(user);
    setAssignSuccess(false);
    setAssignError(null);
    const assignment = getUserAssignment(user, activeGroupId);
    setStartDateInput(assignment.assignmentStartDate || "");
    setEndDateInput(assignment.assignmentEndDate || "");
    setPagesInput(pageRangesLabel(assignment.assignedPages || []).replace(/–/g, "-"));
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setAssignLoading(true);
    setAssignError(null);
    setAssignSuccess(false);

    try {
      const newPages = parsePagesString(pagesInput);
      await setAssignmentForUser(selectedUser.uid, newPages, startDateInput, endDateInput, undefined, activeGroupId);
      setAssignSuccess(true);
      setSelectedUser(null);
      setPagesInput("");
      setStartDateInput("");
      setEndDateInput("");
      await loadData();
    } catch (err) {
      console.error(err);
      setAssignError("Səhifələr təyin edilərkən xəta baş verdi.");
    } finally {
      setAssignLoading(false);
    }
  };

  // "Bərabər böl": distribute juz to every approved member using the dates above
  const handleAutoDistribute = async () => {
    if (!groupStartDate || !groupEndDate) {
      alert("Zəhmət olmasa, əvvəlcə başlama və bitmə tarixlərini seçin.");
      return;
    }
    if (!window.confirm("Bütün aktiv iştirakçılara növbəti cüzlər paylanacaq və cari oxunma vəziyyəti arxivə keçəcək. Davam edilsin?")) {
      return;
    }
    setAutoLoading(true);
    setAutoMessage(null);
    try {
      await distributeJuzToUsers(groupStartDate, groupEndDate, activeGroupId);
      setAutoMessage("Cüzlər iştirakçılara bölündü.");
      await loadData();
    } catch (err) {
      console.error(err);
      setAutoMessage("Avtomatik paylanma zamanı xəta baş verdi.");
    } finally {
      setAutoLoading(false);
    }
  };

  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsLoading(true);
    setSettingsSuccess(false);
    try {
      await setGroupSettings(settings, activeGroupId);
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving global settings:", err);
    } finally {
      setSettingsLoading(false);
    }
  };

  const filteredUsers = activeGroupUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const assignedRows = activeGroupUsers.filter((u) => getUserAssignment(u, activeGroupId).assignedPages.length > 0 || juzsOf(u).length > 0);
  const unassignedUsers = activeGroupUsers.filter((u) => !assignedRows.includes(u));
  const pct = Math.round((totalUniqueCompleted / 604) * 100);

  return (
    <AppLayout activeTab="admin">
      <div className="flex flex-col gap-5 md:gap-7">
        <PageHeader
          title="İnzibatçı paneli"
          subtitle={isCreatorOfGroup ? `${groupName} qrupunu idarə et: cüzləri böl, iştirakçıları dəvət et` : groupName}
          actions={isCreatorOfGroup && activeGroupId !== "default" ? (
            <button
              type="button"
              onClick={handleCopyInviteLink}
              className="min-h-[52px] w-full md:w-auto px-6 rounded-btn font-bold text-[15px] inline-flex items-center justify-center gap-2.5 bg-gold text-forest md:bg-forest md:text-cream transition-colors"
            >
              <IconLink />
              {inviteCopied ? "Link kopyalandı" : "Dəvət linkini paylaş"}
            </button>
          ) : undefined}
        />

        {!isCreatorOfGroup ? (
          <Card danger className="items-center text-center py-12">
            <h2 className="m-0 font-display font-semibold text-2xl text-danger">Giriş məhdudlaşdırılıb</h2>
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
                <section className="bg-progress border border-accent rounded-card p-[18px] md:p-6 flex flex-col gap-3.5">
                  <div className="flex items-center gap-2.5">
                    <h2 className="m-0 text-base md:text-lg font-bold text-progresstext">Qoşulmaq istəyənlər</h2>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white text-progresstext">{pendingGroupUsers.length}</span>
                  </div>
                  {pendingGroupUsers.map((u) => (
                    <div key={u.uid} className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-btn p-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar name={u.name} gold />
                        <span className="text-[15px] font-bold truncate">{u.name}</span>
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
              <section aria-label="Qrupun vəziyyəti" className="grid grid-cols-3 md:flex md:flex-wrap gap-2.5 md:gap-5">
                <StatTile label="Tamamlanan xətm" mobileLabel="Xətm" value={String(settings.completedKhatms || 0)} />
                <StatTile label="Cari xətmin səhifələri" mobileLabel="Oxunan" value={String(totalUniqueCompleted)} suffix="/ 604" />
                <StatTile label="Cari xətm faizi" mobileLabel="Gedişat" value={`${pct}%`} gold />
              </section>

              {/* Juz distribution */}
              <Card className="md:!p-7 !gap-[22px]">
                <div className="flex flex-col gap-1">
                  <h2 className="m-0 text-base md:text-xl font-bold text-forest">Cüz bölgüsü</h2>
                  <div className="text-sm leading-relaxed text-muted">Quranın 30 cüzünü iştirakçılara təyin et və xətmin tarix aralığını seç.</div>
                </div>

                <div className="flex flex-wrap gap-4">
                  <label className="flex-[1_1_200px] flex flex-col gap-2 text-sm font-semibold text-ink">
                    Başlama tarixi
                    <input type="date" value={groupStartDate} onChange={(e) => setGroupStartDate(e.target.value)} className={inputCls} />
                  </label>
                  <label className="flex-[1_1_200px] flex flex-col gap-2 text-sm font-semibold text-ink">
                    Bitmə tarixi
                    <input type="date" value={groupEndDate} onChange={(e) => setGroupEndDate(e.target.value)} className={inputCls} />
                  </label>
                </div>

                {/* Assigned members */}
                <div className="flex flex-col gap-3">
                  {assignedRows.map((u) => {
                    const juzs = juzsOf(u);
                    const s = participantStats(u, activeGroupId);
                    return (
                      <div key={u.uid} className="flex flex-wrap items-center gap-3 md:gap-4 px-4 py-3.5 rounded-2xl bg-cream">
                        <div className="flex-[1_1_200px] flex items-center gap-3 min-w-0">
                          <Avatar name={u.name} gold={u.uid !== currentUser.uid} />
                          <div className="min-w-0">
                            <div className="text-[15px] font-bold truncate">{u.name}</div>
                            <div className="text-xs text-muted">{s.completed} / {s.assigned} səhifə</div>
                          </div>
                        </div>
                        <div className="flex-[2_1_240px] flex flex-wrap items-center gap-1.5">
                          {juzs.length > 0 ? juzs.map((j) => (
                            <button
                              key={j}
                              type="button"
                              onClick={() => handleRemoveJuzAssignment(u)}
                              title="Təyinatı ləğv et"
                              className="min-w-[44px] min-h-[36px] px-3 rounded-[10px] bg-forest text-cream font-bold text-sm inline-flex items-center justify-center gap-1.5 hover:bg-[#16503c]"
                            >
                              Cüz {j} <span aria-hidden="true" className="opacity-70">×</span>
                            </button>
                          )) : (
                            <button
                              type="button"
                              onClick={() => handleRemoveJuzAssignment(u)}
                              className="min-h-[36px] px-3 rounded-[10px] bg-forest text-cream font-bold text-sm"
                            >
                              Səhifə {pageRangesLabel(getUserAssignment(u, activeGroupId).assignedPages)} ×
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {unassignedUsers.length > 0 && (
                    <div className="text-sm text-muted">
                      Cüz təyin edilməyənlər: {unassignedUsers.map((u) => u.name).join(", ")}
                    </div>
                  )}
                </div>

                {/* Free juz */}
                <div className="flex flex-col gap-2.5">
                  <div className="text-sm font-semibold text-ink">Təyin edilməyib · {freeJuz.length} cüz</div>
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
                            ? "bg-forest text-cream border-forest"
                            : "border-dashed border-[#BDB59F] bg-[#F3EEDF] text-[#4F4A39] hover:bg-sand"
                        }`}
                      >
                        {j}
                      </button>
                    ))}
                  </div>
                  {pickedJuz !== null && (
                    <div className="flex flex-wrap items-end gap-3 p-4 rounded-2xl bg-mint">
                      <label className="flex-[1_1_220px] flex flex-col gap-2 text-sm font-semibold text-ink">
                        Cüz {pickedJuz} ({JUZ_MAP[pickedJuz]?.surah}) kimə təyin edilsin?
                        <select value={pickedUid} onChange={(e) => setPickedUid(e.target.value)} className={inputCls}>
                          <option value="">İştirakçı seç...</option>
                          {activeGroupUsers.map((u) => (
                            <option key={u.uid} value={u.uid}>{u.name}</option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        disabled={!pickedUid}
                        onClick={() => handleAssignJuz(pickedUid, pickedJuz)}
                        className={btn.primary}
                      >
                        Təyin et
                      </button>
                      <button type="button" onClick={() => setPickedJuz(null)} className={btn.outline}>Ləğv et</button>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-3 pt-4 border-t border-sand">
                  <button type="button" onClick={handleAutoDistribute} disabled={autoLoading} className={button("primary", "lg")}>
                    {autoLoading ? "Bölünür..." : "Bərabər böl"}
                  </button>
                  <button type="button" onClick={handleClearAll} className={button("outline", "lg")}>
                    Sıfırla
                  </button>
                </div>
                {autoMessage && <div className="text-sm font-semibold text-done">{autoMessage}</div>}
              </Card>

              {/* Manual page assignment */}
              <Card>
                <div className="flex flex-col gap-1">
                  <h2 className="m-0 text-base md:text-lg font-bold text-forest">Səhifə aralığı təyin et</h2>
                  <div className="text-sm text-muted">Cüzdən fərqli səhifə təyin etmək üçün (məs. 1-20, 35, 40-50).</div>
                </div>
                <form onSubmit={handleAssignSubmit} className="flex flex-col gap-4">
                  <label className="flex flex-col gap-2 text-sm font-semibold text-ink">
                    İştirakçı
                    <select
                      value={selectedUser?.uid || ""}
                      onChange={(e) => {
                        const selected = activeGroupUsers.find(u => u.uid === e.target.value);
                        if (selected) {
                          handleSelectUser(selected);
                        } else {
                          setSelectedUser(null);
                          setPagesInput("");
                        }
                      }}
                      required
                      className={inputCls}
                    >
                      <option value="">Seçin...</option>
                      {activeGroupUsers.map(u => (
                        <option key={u.uid} value={u.uid}>{u.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-semibold text-ink">
                    Səhifələr
                    <input
                      type="text"
                      required
                      value={pagesInput}
                      onChange={(e) => setPagesInput(e.target.value)}
                      placeholder="Məsələn: 1-20, 35, 40-50"
                      className={`${inputCls} font-mono`}
                    />
                  </label>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex-[1_1_160px] flex flex-col gap-2 text-sm font-semibold text-ink">
                      Başlama tarixi
                      <input type="date" required value={startDateInput} onChange={(e) => setStartDateInput(e.target.value)} className={inputCls} />
                    </label>
                    <label className="flex-[1_1_160px] flex flex-col gap-2 text-sm font-semibold text-ink">
                      Bitmə tarixi
                      <input type="date" required value={endDateInput} onChange={(e) => setEndDateInput(e.target.value)} className={inputCls} />
                    </label>
                  </div>
                  {assignError && <div className="text-sm font-semibold text-danger">{assignError}</div>}
                  {assignSuccess && <div className="text-sm font-semibold text-done">Səhifələr uğurla təyin edildi.</div>}
                  <div className="flex flex-wrap gap-3">
                    <button type="submit" disabled={assignLoading || !selectedUser} className={btn.primary}>
                      {assignLoading ? "Yadda saxlanılır..." : "Təyin et"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSelectedUser(null); setPagesInput(""); setStartDateInput(""); setEndDateInput(""); }}
                      className={btn.outline}
                    >
                      Təmizlə
                    </button>
                  </div>
                </form>
              </Card>

              {/* Members */}
              <Card className="!gap-2">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
                  <div className="flex items-center gap-2.5">
                    <h2 className="m-0 text-base md:text-lg font-bold text-forest">İştirakçılar</h2>
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
                    const s = participantStats(u, activeGroupId);
                    const isSelf = u.uid === currentUser.uid;
                    const isOwnerRow = u.uid === groupCreatedBy;
                    return (
                      <div key={u.uid} className="flex flex-wrap items-center gap-3 py-3.5 border-t border-sand">
                        <div className="flex-[1_1_200px] flex items-center gap-3 min-w-0">
                          <Avatar name={u.name} gold={!isSelf} />
                          <div className="min-w-0">
                            <div className="text-[15px] font-bold truncate">{u.name}</div>
                            <div className="text-xs text-muted">
                              {isOwnerRow ? "Qrup sahibi" : "İştirakçı"} · {s.juzLabel}
                            </div>
                          </div>
                        </div>
                        <div className="flex-[1_1_140px] flex flex-col gap-1">
                          <div className="text-xs text-muted">{s.completed} / {s.assigned} səhifə</div>
                          <Bar ratio={s.ratio} color={s.status === "done" ? "done" : "accent"} />
                        </div>
                        {isOwnerRow && <Chip tone="owner">Qrup sahibi</Chip>}
                        <div className="flex gap-2">
                          <button onClick={() => handleNotifyClick(u)} className={button("outline", "sm")}>Bildiriş</button>
                          {!isSelf && (
                            <button onClick={() => handleRemoveUser(u)} className={button("danger", "sm")}>Çıxar</button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </Card>

              {/* Danger zone */}
              {activeGroupId !== "default" && (
                <Card danger className="!flex-row flex-wrap items-center justify-between gap-5">
                  <div className="flex-[1_1_320px] flex flex-col gap-1.5">
                    <h2 className="m-0 text-base md:text-lg font-bold text-danger">Təhlükəli zona</h2>
                    <div className="text-sm leading-relaxed text-muted">Qrupu sildikdə bütün iştirakçıların gedişatı silinir. Bu əməliyyat geri qaytarılmır.</div>
                  </div>
                  <button type="button" onClick={handleDeleteGroup} className={`${btn.danger} w-full md:w-auto`}>
                    <IconTrash size={18} />
                    Qrupu sil
                  </button>
                </Card>
              )}
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
                <h2 className="m-0 font-display font-semibold text-lg md:text-[22px] text-forest">AI köməkçi</h2>
                <div className="text-sm leading-relaxed text-[#2F4A3E]">Quran ayələri, hədislər və dini mövzularda suallarını ver.</div>
                <Link href="/admin/ai" className={btn.primary}>
                  <IconSparkle size={18} />
                  Köməkçini aç
                </Link>
              </section>

              <Card>
                <h2 className="m-0 text-[15px] font-bold text-muted">Günün ayəsi və hədisi</h2>
                <form onSubmit={handleSettingsSubmit} className="flex flex-col gap-3.5">
                  <label className="flex flex-col gap-2 text-sm font-semibold text-ink">
                    Günün ayəsi
                    <textarea
                      value={settings.currentAyah || ""}
                      onChange={(e) => setSettings({ ...settings, currentAyah: e.target.value })}
                      rows={3}
                      className={`${inputCls} py-3 resize-y`}
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-semibold text-ink">
                    Günün hədisi
                    <textarea
                      value={settings.currentHadith || ""}
                      onChange={(e) => setSettings({ ...settings, currentHadith: e.target.value })}
                      rows={3}
                      className={`${inputCls} py-3 resize-y`}
                    />
                  </label>
                  {settingsSuccess && <div className="text-sm font-semibold text-done">Yadda saxlanıldı.</div>}
                  <button type="submit" disabled={settingsLoading} className={btn.primary}>
                    {settingsLoading ? "Yadda saxlanılır..." : "Yadda saxla"}
                  </button>
                </form>
              </Card>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function StatTile({ label, mobileLabel, value, suffix, gold = false }: { label: string; mobileLabel: string; value: string; suffix?: string; gold?: boolean }) {
  return (
    <div className="md:flex-[1_1_200px] bg-white border border-line rounded-2xl md:rounded-card px-2.5 py-3.5 md:p-[22px] flex flex-col-reverse md:flex-col gap-0.5 md:gap-2 text-center md:text-left">
      <div className="text-[11px] md:text-sm font-semibold text-muted">
        <span className="md:hidden">{mobileLabel}</span>
        <span className="hidden md:inline">{label}</span>
      </div>
      <div className={`font-display font-bold text-[26px] md:text-[40px] leading-none ${gold ? "text-goldtext" : "text-forest"}`}>
        {value}
        {suffix && <span className="hidden md:inline font-sans font-medium text-base text-muted"> {suffix}</span>}
      </div>
    </div>
  );
}
