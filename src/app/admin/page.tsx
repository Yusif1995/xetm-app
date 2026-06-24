"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { 
  getAllUsers, 
  getGroupSettings, 
  setGroupSettings, 
  setAssignmentForUser,
  distributeJuzToUsers,
  updateUserRole,
  clearAllAssignments,
  updateUserAdminNotification,
  deleteUserDoc,
  createGroup,
  updateUserApproval,
  getUserGroupIds,
  getUserAssignment,
  deleteGroup,
  isUserApprovedInGroup,
  type UserDoc, 
  type AppSettings,
  type GroupDoc
} from "@/lib/db";
import ProgressBar from "@/components/ProgressBar";
import UserRow from "@/components/UserRow";
import AppLayout from "@/components/AppLayout";
import { db } from "@/lib/firebase";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";

// 1-30 Cüz üzrə Surə aralıqları
const JUZ_MAP: Record<number, { surah: string }> = {
  1: { surah: "Əl-Fatihə - Əl-Bəqərə" },
  2: { surah: "Əl-Bəqərə" },
  3: { surah: "Əl-Bəqərə - Ali-İmran" },
  4: { surah: "Ali-İmran - An-Nisa" },
  5: { surah: "An-Nisa" },
  6: { surah: "An-Nisa - Al-Maidə" },
  7: { surah: "Al-Maidə - Al-Ənam" },
  8: { surah: "Al-Ənam - Al-Əraf" },
  9: { surah: "Al-Əraf - Al-Ənfal" },
  10: { surah: "Al-Ənfal - At-Tövbə" },
  11: { surah: "At-Tövbə - Hud" },
  12: { surah: "Hud - Yusuf" },
  13: { surah: "Yusuf - İbrahim" },
  14: { surah: "Al-Hicr - An-Nahl" },
  15: { surah: "Al-İsra - Al-Kəhf" },
  16: { surah: "Al-Kəhf - Taha" },
  17: { surah: "Al-Ənbiya - Al-Həcc" },
  18: { surah: "Al-Muminun - Al-Furqan" },
  19: { surah: "Al-Furqan - An-Naml" },
  20: { surah: "An-Naml - Al-Ankabut" },
  21: { surah: "Al-Ankabut - Al-Ahzab" },
  22: { surah: "Al-Ahzab - Yasin" },
  23: { surah: "Yasin - Az-Zumar" },
  24: { surah: "Az-Zumar - Fussilat" },
  25: { surah: "Fussilat - Al-Jasiya" },
  26: { surah: "Al-Ahqaf - Az-Zariyat" },
  27: { surah: "Az-Zariyat - Al-Hadid" },
  28: { surah: "Al-Mujadilah - At-Tahrim" },
  29: { surah: "Al-Mulk - Al-Mursalat" },
  30: { surah: "Ən-Nəbə - Ən-Nas" }
};

export default function AdminPage() {
  const { user: currentUser, loading: authLoading, activeGroupId, setActiveGroupId } = useAuth();
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Selection and form state for assigning pages
  const [selectedUser, setSelectedUser] = useState<UserDoc | null>(null);
  const [pagesInput, setPagesInput] = useState("");
  const [startDateInput, setStartDateInput] = useState("");
  const [endDateInput, setEndDateInput] = useState("");
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);

  // Auto distribution modal state
  const [showAutoModal, setShowAutoModal] = useState(false);
  const [autoStartDate, setAutoStartDate] = useState("");
  const [autoEndDate, setAutoEndDate] = useState("");
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoSuccess, setAutoSuccess] = useState(false);
  const [autoError, setAutoError] = useState<string | null>(null);

  // Settings state
  const [settings, setSettings] = useState<AppSettings>({ currentAyah: "", currentHadith: "" });
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [showParticipantsList, setShowParticipantsList] = useState(true);

  // Local states for the 30 Juz group setup
  const [groupStartDate, setGroupStartDate] = useState("");
  const [groupEndDate, setGroupEndDate] = useState("");

  const [createdGroups, setCreatedGroups] = useState<GroupDoc[]>([]);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [createGroupLoading, setCreateGroupLoading] = useState(false);
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

  // Real-time listener for groups created by this admin
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

  if (authLoading || loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-[#FAF7F2] text-[#0F3D2C] min-h-screen">
        <div className="animate-spin h-10 w-10 text-[#0F3D2C] mb-4">
          <svg className="w-full h-full" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
        <p className="text-sm font-semibold tracking-wide text-[#0F3D2C]/80">İnzibatçı paneli yüklənir...</p>
      </div>
    );
  }

  if (!currentUser || currentUser.role !== "admin") {
    return null; // Guarded by middleware
  }

  const isCreatorOfGroup = activeGroupId === "default" || !groupCreatedBy || groupCreatedBy === currentUser.uid;

  // Calculate unique pages completed by the selected group out of 604
  const groupUsers = users.filter((u) => 
    getUserGroupIds(u).includes(activeGroupId) || 
    (groupCreatedBy && u.uid === groupCreatedBy)
  );
  const activeGroupUsers = groupUsers.filter((u) => isUserApprovedInGroup(u, activeGroupId));
  const pendingGroupUsers = groupUsers.filter((u) => !isUserApprovedInGroup(u, activeGroupId));

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

  const handleApproveUser = async (uid: string) => {
    try {
      setLoading(true);
      await updateUserApproval(uid, true, activeGroupId);
      await loadData();
      alert("İştirakçı uğurla təsdiqləndi.");
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
        await deleteUserDoc(user.uid);
        await loadData();
        alert("İstək rədd edildi və silindi.");
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
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const inviteLink = `${origin}/?invite=${activeGroupId}`;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 3000);
    });
  };

  const handleDeleteGroup = async () => {
    if (activeGroupId === "default") return;
    const groupName = createdGroups.find(g => g.id === activeGroupId)?.name || "Bu qrupu";
    if (window.confirm(`“${groupName}” qrupunu silmək istədiyinizdən əminsiniz? Qrupa aid bütün oxunma məlumatları və üzvlük qeydləri silinəcək.`)) {
      try {
        setLoading(true);
        await deleteGroup(activeGroupId);
        alert("Qrup uğurla silindi.");
        
        const remaining = createdGroups.filter(g => g.id !== activeGroupId);
        if (remaining.length > 0) {
          setActiveGroupId(remaining[0].id);
          await loadData(remaining[0].id);
        } else {
          if (currentUser) {
            const userRef = doc(db, "users", currentUser.uid);
            await updateDoc(userRef, { isOnboarded: false, groupId: "" });
          }
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

  const handleCreateGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !currentUser) return;
    setCreateGroupLoading(true);
    try {
      const newId = await createGroup(newGroupName, currentUser.uid);
      setActiveGroupId(newId);
      setShowCreateGroupModal(false);
      setNewGroupName("");
      alert("Yeni qrup uğurla yaradıldı!");
      await loadData(newId);
    } catch (err) {
      console.error("Error creating group:", err);
      alert("Qrup yaradılarkən xəta baş verdi.");
    } finally {
      setCreateGroupLoading(false);
    }
  };

  const handleRoleToggle = async (user: UserDoc) => {
    try {
      const newRole = user.role === "admin" ? "user" : "admin";
      await updateUserRole(user.uid, newRole);
      await loadData();
    } catch (err) {
      console.error("Error toggling role:", err);
      alert("Rol dəyişdirilərkən xəta baş verdi.");
    }
  };

  const handleClearAll = async () => {
    if (window.confirm("Bütün iştirakçıların səhifə təyinatlarını və arxiv tarixçələrini tamamilə sıfırlamaq (təmizləmək) istəyirsiniz?")) {
      try {
        setLoading(true);
        await clearAllAssignments(activeGroupId);
        alert("Bütün səhifə təyinatları uğurla təmizləndi.");
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
      "İştirakçıya admin bildirişi daxil edin (Boş buraxdıqda mövcud bildiriş silinir):",
      user.adminNotification || ""
    );
    if (msg !== null) {
      try {
        await updateUserAdminNotification(user.uid, msg);
        await loadData();
      } catch (err) {
        console.error("Error updating admin notification:", err);
        alert("Bildiriş göndərilərkən xəta baş verdi.");
      }
    }
  };

  const handleRemoveUser = async (user: UserDoc) => {
    const groupName = activeGroupId === "default" 
      ? "Sistem Qrupu"
      : createdGroups.find(g => g.id === activeGroupId)?.name || "fərdi qrup";

    if (window.confirm(`${user.name} adlı iştirakçını “${groupName}” qrupundan kənarlaşdırmaq istədiyinizə əminsiniz?`)) {
      try {
        setLoading(true);
        if (activeGroupId === "default") {
          await deleteUserDoc(user.uid);
          alert("İştirakçı Sistem Qrupundan (və tətbiqdən) silindi.");
        } else {
          const { doc, updateDoc, arrayRemove, deleteField } = await import("firebase/firestore");
          const userRef = doc(db, "users", user.uid);
          await updateDoc(userRef, {
            groupIds: arrayRemove(activeGroupId),
            [`groupData.${activeGroupId}`]: deleteField()
          });
          alert(`İştirakçı “${groupName}” qrupundan kənarlaşdırıldı.`);
        }
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
      alert("Zəhmət olmasa, əvvəlcə qrup üçün Başlama və Bitmə tarixlərini daxil edin (yuxarı sağ küncdən).");
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
      const startPage = (juzNum - 1) * 20 + 1;
      const endPage = juzNum === 30 ? 604 : juzNum * 20;
      const pages: number[] = [];
      for (let p = startPage; p <= endPage; p++) {
        pages.push(p);
      }
      
      await setAssignmentForUser(uid, pages, groupStartDate, groupEndDate, juzNum, activeGroupId);
      alert(`Cüz ${juzNum} uğurla ${userToAssign?.name || "iştirakçıya"} təyin edildi.`);
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
    if (window.confirm(`${user.name} adlı iştirakçının Cüz ${assignment.assignedJuz} təyinatını ləğv etmək istəyirsiniz?`)) {
      try {
        setLoading(true);
        await setAssignmentForUser(user.uid, [], "", "", undefined, activeGroupId);
        alert("Cüz təyinatı ləğv edildi.");
        await loadData();
      } catch (err) {
        console.error("Error removing juz assignment:", err);
        alert("Təyinatı silərkən xəta baş verdi.");
      } finally {
        setLoading(false);
      }
    }
  };

  // Filter users by name or email (though email is not displayed)
  const filteredUsers = activeGroupUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const parsePagesString = (input: string): number[] => {
    const result: number[] = [];
    const parts = input.split(",");
    
    for (let part of parts) {
      part = part.trim();
      if (part.includes("-")) {
        const [startStr, endStr] = part.split("-");
        const start = parseInt(startStr.trim(), 10);
        const end = parseInt(endStr.trim(), 10);
        
        if (!isNaN(start) && !isNaN(end) && start <= end) {
          for (let i = start; i <= end; i++) {
            if (i >= 1 && i <= 604) {
              result.push(i);
            }
          }
        }
      } else {
        const page = parseInt(part, 10);
        if (!isNaN(page) && page >= 1 && page <= 604) {
          result.push(page);
        }
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
    
    if (assignment.assignedPages && assignment.assignedPages.length > 0) {
      const sorted = [...assignment.assignedPages].sort((a, b) => a - b);
      const ranges: string[] = [];
      let start = sorted[0];
      let end = sorted[0];
      
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === end + 1) {
          end = sorted[i];
        } else {
          ranges.push(start === end ? `${start}` : `${start}-${end}`);
          start = sorted[i];
          end = sorted[i];
        }
      }
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      setPagesInput(ranges.join(", "));
    } else {
      setPagesInput("");
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setAssignLoading(true);
    setAssignError(null);
    setAssignSuccess(false);

    try {
      const newPages = parsePagesString(pagesInput);
      
      await setAssignmentForUser(
        selectedUser.uid, 
        newPages, 
        startDateInput, 
        endDateInput,
        undefined, // juzNumber
        activeGroupId
      );
      
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

  const handleAutoDistribute = async (e: React.FormEvent) => {
    e.preventDefault();
    setAutoLoading(true);
    setAutoError(null);
    setAutoSuccess(false);

    try {
      await distributeJuzToUsers(autoStartDate, autoEndDate, activeGroupId);
      setAutoSuccess(true);
      setShowAutoModal(false);
      setAutoStartDate("");
      setAutoEndDate("");
      
      await loadData();
    } catch (err) {
      console.error(err);
      setAutoError("Avtomatik paylanma zamanı xəta baş verdi.");
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

  return (
    <AppLayout activeTab="admin">
      <div className="flex flex-col gap-6 max-w-7xl mx-auto px-4 py-6 text-[#0F3D2C]">
        
        {/* Page Title */}
        <div className="flex justify-between items-center">
          <h1 className="text-xl md:text-2xl font-bold font-sans tracking-wide">
            İnzibatçı Paneli
          </h1>
        </div>

        {/* Group Selector and Creation Section */}
        <div className="card-premium flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-col gap-1 w-full md:w-auto">
            <label className="text-[10px] uppercase font-bold text-[#D5A85A] tracking-wider">İdarə Olunan Qrup</label>
            <select
              value={activeGroupId}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "__new__") {
                  setShowCreateGroupModal(true);
                } else {
                  setActiveGroupId(val);
                  loadData(val);
                }
              }}
              className="px-4 py-2.5 bg-[#FAF7F2] border border-[#0F3D2C]/20 rounded-xl text-[#0F3D2C] font-bold text-sm outline-none focus:border-[#0F3D2C]/40 transition-colors w-full md:w-64"
            >
              {createdGroups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
              <option value="__new__" className="text-[#D5A85A] font-bold">+ Yeni Qrup Yarat...</option>
            </select>
          </div>

          {activeGroupId !== "default" && (
            <div className="flex gap-2 w-full md:w-auto">
              <button
                onClick={handleCopyInviteLink}
                className="w-full md:w-auto px-5 py-3 bg-[#0F3D2C] hover:bg-[#16503c] text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center gap-2"
              >
                <span>🔗</span>
                <span>{inviteCopied ? "Link Kopyalandı!" : "Dəvət Linkini Paylaş"}</span>
              </button>
              <button
                onClick={handleDeleteGroup}
                className="w-full md:w-auto px-5 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center gap-2"
              >
                <span>🗑️</span>
                <span>Qrupu Sil</span>
              </button>
            </div>
          )}
        </div>

        {!isCreatorOfGroup ? (
          <div className="card-premium flex flex-col items-center justify-center py-16 text-center border border-red-200 bg-red-50/50">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 text-2xl mb-4">
              🚫
            </div>
            <h2 className="text-lg font-bold text-red-800 mb-1 font-serif">Giriş Məhdudlaşdırılıb</h2>
            <p className="text-xs text-red-700/80 max-w-md font-sans">
              Siz bu xətm qrupunun yaradıcısı (inzibatçısı) deyilsiniz. Bu səbəbdən qrupu idarə etmək səlahiyyətiniz yoxdur.
            </p>
          </div>
        ) : (
          <>
            {/* Pending Membership Requests */}
            {pendingGroupUsers.length > 0 && (
          <div className="card-premium border border-amber-500/35 bg-amber-500/5 flex flex-col gap-4">
            <h3 className="text-sm font-bold text-amber-800 flex items-center gap-2">
              <span>⚠️ Qrupa Qoşulmaq İstəyənlər (Təsdiq Gözləyənlər)</span>
              <span className="text-[10px] bg-amber-500/20 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                {pendingGroupUsers.length} istək
              </span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-amber-500/10 text-[10px] text-amber-800/70 uppercase font-bold tracking-wider">
                    <th className="px-4 py-2">İştirakçı</th>
                    <th className="px-4 py-2 text-right">Qərar</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingGroupUsers.map((u) => (
                    <tr key={u.uid} className="border-b border-amber-500/5 text-xs text-amber-900">
                      <td className="px-4 py-3 flex items-center gap-3">
                        {u.photoURL ? (
                          <img src={u.photoURL} alt={u.name} className="w-8 h-8 rounded-full border border-amber-500/20" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center font-bold text-amber-800">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="font-bold">{u.name}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleApproveUser(u.uid)}
                            className="px-3 py-1.5 bg-[#0F3D2C] hover:bg-[#16503c] text-white font-bold rounded-lg transition-colors text-[10px]"
                          >
                            Təsdiq et
                          </button>
                          <button
                            onClick={() => handleRejectUser(u)}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors text-[10px]"
                          >
                            Rədd et
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Global Progress overview */}
        <div className="card-premium">
          <h2 className="text-xs font-bold text-[#0F3D2C] mb-3 uppercase tracking-wider">
            Quranın Ümumi Xətm Vəziyyəti
          </h2>
          <ProgressBar completed={totalUniqueCompleted} total={604} label="Tamamlanan Səhifələr (Bütün iştirakçılar)" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card-premium text-center">
            <span className="text-xs text-[#0F3D2C]/60 uppercase font-bold tracking-wider">Tamamlanan Ümumi Xətm</span>
            <div className="text-3xl font-extrabold text-[#0F3D2C] mt-1 font-mono">{settings.completedKhatms || 0}</div>
          </div>
          <div className="card-premium text-center">
            <span className="text-xs text-[#0F3D2C]/60 uppercase font-bold tracking-wider">Cari Xətmin Səhifələri</span>
            <div className="text-3xl font-extrabold text-[#0F3D2C] mt-1 font-mono">{totalUniqueCompleted} / 604</div>
          </div>
          <div className="card-premium text-center">
            <span className="text-xs text-[#0F3D2C]/60 uppercase font-bold tracking-wider">Cari Xətm Faiz</span>
            <div className="text-3xl font-extrabold text-[#D5A85A] mt-1 font-mono">
              {Math.round((totalUniqueCompleted / 604) * 100)}%
            </div>
          </div>
        </div>

        {/* 30 Cüz üzrə Qrup İdarəetməsi */}
        <div className="card-premium flex flex-col gap-4">
          <div className="flex flex-col md:flex-row justify-between md:items-center border-b border-[#0F3D2C]/5 pb-3">
            <div>
              <h3 className="text-base font-bold text-[#0F3D2C] font-sans">
                30 Cüz üzrə Qrup İdarəetməsi (Xətm Qrupu)
              </h3>
              <p className="text-xs text-[#0F3D2C]/65 mt-0.5">
                Quranın 30 cüzünü 30 fərqli iştirakçıya təyin edərək qrup formatında xətm yaradın.
              </p>
            </div>
            
            {/* Global dates for the group assignment */}
            <div className="flex flex-wrap gap-3 mt-3 md:mt-0 items-center">
              <div className="flex items-center gap-1.5 text-xs text-[#0F3D2C] font-semibold">
                <span>Başlama:</span>
                <div className="relative">
                  <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#0F3D2C]/40 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <input
                    type="date"
                    value={groupStartDate}
                    onChange={(e) => setGroupStartDate(e.target.value)}
                    className="pl-7 pr-2 py-1.5 bg-white border border-[#0F3D2C]/15 focus:border-[#0F3D2C] rounded-lg text-xs font-mono focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#0F3D2C] font-semibold">
                <span>Bitmə:</span>
                <div className="relative">
                  <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#0F3D2C]/40 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <input
                    type="date"
                    value={groupEndDate}
                    onChange={(e) => setGroupEndDate(e.target.value)}
                    className="pl-7 pr-2 py-1.5 bg-white border border-[#0F3D2C]/15 focus:border-[#0F3D2C] rounded-lg text-xs font-mono focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 30 Juz slots grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[420px] overflow-y-auto pr-1">
            {Array.from({ length: 30 }, (_, i) => {
              const juzNum = i + 1;
              const juzInfo = JUZ_MAP[juzNum];
              const assignedUser = activeGroupUsers.find(u => {
                const assignment = getUserAssignment(u, activeGroupId);
                return assignment.assignedJuz === juzNum || (assignment.assignedJuzs && assignment.assignedJuzs.includes(juzNum));
              });
              
              return (
                <div key={juzNum} className="p-3 bg-[#FAF7F2] border border-[#0F3D2C]/5 rounded-xl flex flex-col justify-between gap-3 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                      <span className="text-xs font-extrabold text-[#D5A85A]">Cüz {juzNum}</span>
                      <span className="text-[10px] text-[#0F3D2C]/65 font-bold leading-tight mt-0.5">
                        {juzInfo?.surah || ""}
                      </span>
                    </div>
                    {assignedUser && (
                      <span className="text-[9px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-100">
                        Təyin edilib
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-[#0F3D2C]/5 pt-2">
                    {assignedUser ? (
                      <div className="flex justify-between items-center w-full">
                        <span className="text-xs font-bold text-[#0F3D2C] truncate max-w-[130px]" title={assignedUser.name}>
                          {assignedUser.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveJuzAssignment(assignedUser)}
                          className="px-2 py-1 text-[9px] font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded transition-colors"
                        >
                          Ləğv et
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 w-full">
                        <select
                          id={`juz-select-${juzNum}`}
                          className="flex-1 px-1.5 py-1 bg-white border border-[#0F3D2C]/10 focus:border-[#0F3D2C] rounded text-[11px] text-[#0F3D2C] focus:outline-none"
                          defaultValue=""
                        >
                          <option value="" disabled>İştirakçı...</option>
                          {activeGroupUsers.map(u => (
                            <option key={u.uid} value={u.uid}>{u.name}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const selectElement = document.getElementById(`juz-select-${juzNum}`) as HTMLSelectElement;
                            const selectedUid = selectElement?.value;
                            if (selectedUid) {
                              handleAssignJuz(selectedUid, juzNum);
                              selectElement.value = ""; 
                            } else {
                              alert("Zəhmət olmasa, əvvəlcə bir iştirakçı seçin.");
                            }
                          }}
                          className="px-2 py-1 text-[9px] font-bold text-[#0F3D2C] bg-white hover:bg-[#FAF7F2] border border-[#0F3D2C]/20 rounded transition-colors"
                        >
                          Təyin et
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mid grid: User pages assignment & Login settings */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* User page assignment card */}
          <div className="lg:col-span-2 card-premium flex flex-col justify-between gap-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#0F3D2C]/5 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#0F3D2C]">
                  Səhifə Təyin Etmə Paneli
                </h3>
                <p className="text-xs text-[#0F3D2C]/60 mt-0.5">
                  İstifadəçiyə səhifə təyin etmək üçün aşağıdakı cədvəldən &quot;Səhifə Təyin Et&quot; düyməsinə klikləyin.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setShowAutoModal(true)}
                  className="px-4 py-2 bg-[#D5A85A] hover:bg-[#b0913e] text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
                >
                  Cüzləri Avtomatik Payla
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="px-4 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
                >
                  Təmizlə (Sıfırla)
                </button>
              </div>
            </div>

            {autoSuccess && (
              <div className="p-3 bg-green-50/80 border border-green-200 text-green-700 text-xs rounded-lg font-semibold">
                Cüzlər iştirakçılara uğurla və təsadüfi ardıcıllıqla paylanıldı!
              </div>
            )}

            {selectedUser ? (
              <form onSubmit={handleAssignSubmit} className="space-y-4">
                <div className="p-4 bg-[#FAF7F2] border border-[#0F3D2C]/10 rounded-xl">
                  <span className="text-xs text-[#0F3D2C]/65 block mb-1">Seçilən İstifadəçi:</span>
                  <span className="text-sm font-bold text-[#0F3D2C]">{selectedUser.name}</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F3D2C]/80 mb-1.5 uppercase tracking-wide">
                    Səhifə Aralığı və ya Nömrələri
                  </label>
                  <input
                    type="text"
                    required
                    value={pagesInput}
                    onChange={(e) => setPagesInput(e.target.value)}
                    placeholder="Məsələn: 1-20, 35, 40-50"
                    className="w-full px-4 py-2 bg-white border border-[#0F3D2C]/15 focus:border-[#0F3D2C] rounded-lg text-[#0F3D2C] focus:outline-none font-mono text-sm"
                  />
                  <span className="text-[10px] text-[#0F3D2C]/50 mt-1 block">
                    Range-ləri tire (-) ilə ayırın, tək səhifələri isə vergüllə daxil edin (1-604 arası).
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#0F3D2C]/80 mb-1.5 uppercase tracking-wide">
                      Başlama Tarixi
                    </label>
                    <input
                      type="date"
                      required
                      value={startDateInput}
                      onChange={(e) => setStartDateInput(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#0F3D2C]/15 focus:border-[#0F3D2C] rounded-lg text-xs text-[#0F3D2C] focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#0F3D2C]/80 mb-1.5 uppercase tracking-wide">
                      Bitmə Tarixi
                    </label>
                    <input
                      type="date"
                      required
                      value={endDateInput}
                      onChange={(e) => setEndDateInput(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#0F3D2C]/15 focus:border-[#0F3D2C] rounded-lg text-xs text-[#0F3D2C] focus:outline-none font-mono"
                    />
                  </div>
                </div>

                {assignError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg font-semibold">
                    {assignError}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={assignLoading}
                    className="px-5 py-2 bg-[#0F3D2C] hover:bg-[#1C2E24] text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
                  >
                    {assignLoading ? "Yadda saxlanılır..." : "Təyin et"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedUser(null)}
                    className="px-5 py-2 bg-white hover:bg-[#FAF7F2] border border-[#0F3D2C]/20 text-[#0F3D2C] rounded-lg text-xs font-bold transition-all"
                  >
                    Ləğv Et
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-[#0F3D2C]/15 rounded-xl bg-[#FAF7F2]/40">
                <span className="text-3xl mb-2">📋</span>
                <p className="text-xs text-[#0F3D2C]/55 max-w-xs font-semibold">
                  Heç bir iştirakçı seçilməyib. Aşağıdakı cədvəldən bir istifadəçi seçin.
                </p>
              </div>
            )}

            {assignSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 text-green-700 text-xs rounded-lg font-semibold">
                Səhifələr uğurla təyin edildi!
              </div>
            )}
          </div>

          {/* Login Page Config (Ayah/Hadith) */}
          <div className="card-premium flex flex-col justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-[#0F3D2C] border-b border-[#0F3D2C]/5 pb-2">
                Giriş Səhifəsi Ayarları
              </h3>
              <p className="text-xs text-[#0F3D2C]/60 mt-1 mb-4">
                Giriş səhifəsində nümayiş etdirilməsi üçün Quran Ayəsini və ya Hədisi buradan təyin edə bilərsiniz.
              </p>

              <form onSubmit={handleSettingsSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#0F3D2C]/80 mb-1.5 uppercase tracking-wide">
                    Günün Ayəsi
                  </label>
                  <textarea
                    value={settings.currentAyah || ""}
                    onChange={(e) => setSettings({ ...settings, currentAyah: e.target.value })}
                    placeholder="Ayəni daxil edin..."
                    rows={3}
                    className="w-full px-3 py-2 bg-white border border-[#0F3D2C]/15 focus:border-[#0F3D2C] rounded-lg text-xs text-[#0F3D2C] focus:outline-none resize-none font-sans"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F3D2C]/80 mb-1.5 uppercase tracking-wide">
                    Günün Hədisi
                  </label>
                  <textarea
                    value={settings.currentHadith || ""}
                    onChange={(e) => setSettings({ ...settings, currentHadith: e.target.value })}
                    placeholder="Hədisi daxil edin..."
                    rows={3}
                    className="w-full px-3 py-2 bg-white border border-[#0F3D2C]/15 focus:border-[#0F3D2C] rounded-lg text-xs text-[#0F3D2C] focus:outline-none resize-none font-sans"
                  />
                </div>

                {settingsSuccess && (
                  <div className="p-2.5 bg-green-50 border border-green-200 text-green-700 text-xs rounded-lg font-semibold animate-fadeIn">
                    Ayarlar uğurla yadda saxlanıldı!
                  </div>
                )}

                <button
                  type="submit"
                  disabled={settingsLoading}
                  className="w-full px-4 py-2.5 bg-[#0F3D2C] hover:bg-[#1C2E24] text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
                >
                  {settingsLoading ? "Yadda saxlanılır..." : "Məlumatları Yenilə"}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* User list with search */}
        <div className="card-premium overflow-hidden flex flex-col gap-4">
          <div 
            onClick={() => setShowParticipantsList(!showParticipantsList)}
            className="border-b border-[#0F3D2C]/5 pb-3 flex flex-col md:flex-row justify-between items-center gap-4 cursor-pointer select-none"
          >
            <h3 className="text-base font-bold text-[#0F3D2C] flex items-center gap-2">
              <span>Qeydiyyatlı İştirakçılar</span>
              <span className="text-xs bg-[#D5A85A]/15 text-[#D5A85A] px-2.5 py-0.5 rounded-full border border-[#D5A85A]/30 font-mono">
                {activeGroupUsers.length} iştirakçı
              </span>
              <span className="text-xs text-[#0F3D2C] ml-1 font-mono">
                {showParticipantsList ? "▲" : "▼"}
              </span>
            </h3>

            {/* Search Input */}
            {showParticipantsList && (
              <div className="w-full md:w-72" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ad ilə axtar..."
                  className="w-full px-3 py-1.5 bg-white border border-[#0F3D2C]/15 focus:border-[#0F3D2C] rounded-lg text-xs text-[#0F3D2C] focus:outline-none"
                />
              </div>
            )}
          </div>

          {showParticipantsList && (
            filteredUsers.length === 0 ? (
              <div className="text-center py-16 text-[#0F3D2C]/50 text-sm">
                Heç bir iştirakçı tapılmadı.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#FAF7F2] border-b border-[#0F3D2C]/10 text-xs text-[#0F3D2C] uppercase font-bold tracking-wider">
                      <th className="px-4 py-3 md:px-6 md:py-4">İştirakçı</th>
                      <th className="px-4 py-3 md:px-6 md:py-4">Təyin edilmiş Səhifələr</th>
                      <th className="px-4 py-3 md:px-6 md:py-4">Tamamlanan</th>
                      <th className="px-4 py-3 md:px-6 md:py-4">Faiz</th>
                      <th className="px-4 py-3 md:px-6 md:py-4">Status</th>
                      <th className="px-4 py-3 md:px-6 md:py-4 text-right">Əməliyyat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <UserRow 
                        key={u.uid} 
                        user={u} 
                        isAdminView={true} 
                        groupCreatedBy={groupCreatedBy}
                        onAssignPagesClick={handleSelectUser} 
                        onRoleToggle={handleRoleToggle}
                        onNotifyClick={handleNotifyClick}
                        onRemoveUserClick={handleRemoveUser}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
        </>
        )}
      </div>

      {/* Auto Distribution Modal */}
      {showAutoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="card-premium max-w-md w-full p-6 shadow-2xl relative z-10 flex flex-col gap-4 text-[#0F3D2C]">
            <h3 className="text-base font-bold text-[#0F3D2C] flex items-center gap-2 border-b border-[#0F3D2C]/5 pb-2">
              <span>🕋</span>
              <span>Cüzləri Avtomatik Payla</span>
            </h3>
            <p className="text-xs text-[#0F3D2C]/70 leading-relaxed font-medium">
              Bu əməliyyat bütün aktiv iştirakçılara növbəti xətm üzrə təsadüfi cüzləri (20-şər səhifə, 30-cu cüz üçün 24 səhifə) paylayacaq və oxunma tarixçələrini sıfırlayacaq.
            </p>
            
            <form onSubmit={handleAutoDistribute} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#0F3D2C]/80 mb-1.5 uppercase tracking-wide">
                    Başlama Tarixi
                  </label>
                  <input
                    type="date"
                    required
                    value={autoStartDate}
                    onChange={(e) => setAutoStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#0F3D2C]/15 focus:border-[#0F3D2C] rounded-lg text-xs text-[#0F3D2C] focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#0F3D2C]/80 mb-1.5 uppercase tracking-wide">
                    Bitmə Tarixi
                  </label>
                  <input
                    type="date"
                    required
                    value={autoEndDate}
                    onChange={(e) => setAutoEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#0F3D2C]/15 focus:border-[#0F3D2C] rounded-lg text-xs text-[#0F3D2C] focus:outline-none font-mono"
                  />
                </div>
              </div>

              {autoError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg font-semibold">
                  {autoError}
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAutoModal(false);
                    setAutoError(null);
                  }}
                  className="px-4 py-2 bg-white border border-[#0F3D2C]/20 text-[#0F3D2C] text-xs font-bold rounded-lg transition-all"
                >
                  Ləğv Et
                </button>
                <button
                  type="submit"
                  disabled={autoLoading}
                  className="px-4 py-2 bg-[#0F3D2C] hover:bg-[#1C2E24] text-white text-xs font-bold rounded-lg transition-all shadow-sm active:scale-95"
                >
                  {autoLoading ? "Paylanılır..." : "Paylanmanı Başlat"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="card-premium max-w-md w-full p-6 shadow-2xl relative z-10 flex flex-col gap-4 text-[#0F3D2C]">
            <h3 className="text-base font-bold text-[#0F3D2C] flex items-center gap-2 border-b border-[#0F3D2C]/5 pb-2">
              <span>👥</span>
              <span>Yeni Qrup Yarat</span>
            </h3>
            <p className="text-xs text-[#0F3D2C]/70 leading-relaxed font-medium">
              Yeni bir xətm qrupu yaradın. Bu qrupa daxil olacaq iştirakçılar yalnız bu qrupun cüzlərini və fəaliyyətini görəcəkdir.
            </p>
            
            <form onSubmit={handleCreateGroupSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#0F3D2C]/80 mb-1.5 uppercase tracking-wide">
                  Qrup Adı
                </label>
                <input
                  type="text"
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Məsələn: Cümə Xətmi, Ailə Qrupu"
                  className="w-full px-4 py-2 bg-white border border-[#0F3D2C]/15 focus:border-[#0F3D2C] rounded-lg text-[#0F3D2C] focus:outline-none text-sm font-semibold"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateGroupModal(false);
                    setNewGroupName("");
                  }}
                  className="px-4 py-2 bg-white border border-[#0F3D2C]/20 text-[#0F3D2C] text-xs font-bold rounded-lg transition-all"
                >
                  Ləğv Et
                </button>
                <button
                  type="submit"
                  disabled={createGroupLoading}
                  className="px-4 py-2 bg-[#0F3D2C] hover:bg-[#1C2E24] text-white text-xs font-bold rounded-lg transition-all shadow-sm active:scale-95"
                >
                  {createGroupLoading ? "Yaradılır..." : "Qrupu Yarat"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
