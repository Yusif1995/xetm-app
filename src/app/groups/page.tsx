"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { createGroup, leaveGroup, type GroupDoc, type GroupMemberStatus } from "@/lib/db";
import AppLayout from "@/components/AppLayout";
import { Card, Chip, IconLogout, PageHeader, btn, button, inputCls } from "@/components/ui";

const STATUS_CHIP: Record<GroupMemberStatus, { tone: "owner" | "done" | "pending"; text: string }> = {
  owner: { tone: "owner", text: "Qrup sahibi" },
  member: { tone: "done", text: "Üzv" },
  pending: { tone: "pending", text: "Təsdiq gözlənilir" },
};

// Accepts a full invite link (".../?invite=ID") or a bare group ID
function parseInviteId(input: string): string {
  const value = input.trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.searchParams.get("invite") || "";
  } catch {
    const match = value.match(/invite=([A-Za-z0-9_-]+)/);
    if (match) return match[1];
    return /^[A-Za-z0-9_-]{10,}$/.test(value) ? value : "";
  }
}

export default function GroupsPage() {
  const { user, loading, logout, activeGroupId, setActiveGroupId, isSuperAdmin } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<GroupDoc[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const [inviteInput, setInviteInput] = useState("");
  const [busyGroupId, setBusyGroupId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Every group whose members map lists this user
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "groups"),
      where(`members.${user.uid}`, "in", ["owner", "member", "pending"])
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as GroupDoc));
      // Active group first, then by name
      list.sort((a, b) => (a.id === activeGroupId ? -1 : b.id === activeGroupId ? 1 : a.name.localeCompare(b.name)));
      setGroups(list);
      setGroupsLoading(false);
    }, (err) => {
      console.error("Error loading my groups:", err);
      setGroupsLoading(false);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  if (loading || !user) {
    return null;
  }

  const openGroup = (groupId: string, path: string) => {
    setActiveGroupId(groupId);
    router.push(path);
  };

  const handleLeave = async (group: GroupDoc) => {
    if (!window.confirm(`“${group.name}” qrupundan çıxmaq istədiyinizə əminsiniz? Bu qrupdakı oxu məlumatlarınız silinəcək.`)) {
      return;
    }
    setBusyGroupId(group.id);
    setError(null);
    try {
      await leaveGroup(user, group.id);
      if (activeGroupId === group.id) {
        const next = groups.find((g) => g.id !== group.id);
        setActiveGroupId(next ? next.id : "");
      }
    } catch (err) {
      console.error("Error leaving group:", err);
      setError("Qrupdan çıxarkən xəta baş verdi. Zəhmət olmasa yenidən cəhd edin.");
    } finally {
      setBusyGroupId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const newId = await createGroup(newGroupName.trim(), user.uid);
      setNewGroupName("");
      setActiveGroupId(newId);
      router.push("/admin");
    } catch (err) {
      console.error("Error creating group:", err);
      setError("Qrup yaradılarkən xəta baş verdi. Zəhmət olmasa yenidən cəhd edin.");
    } finally {
      setCreating(false);
    }
  };

  // Hand the invite over to the dashboard, which shows the join dialog
  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const inviteId = parseInviteId(inviteInput);
    if (!inviteId) {
      setError("Dəvət linki tanınmadı. Linki tam şəkildə yapışdırın.");
      return;
    }
    setError(null);
    router.push(`/dashboard?invite=${encodeURIComponent(inviteId)}`);
  };

  return (
    <AppLayout activeTab="groups">
      <div className="flex flex-col gap-5 md:gap-7">
        <PageHeader
          title="Qruplarım"
          subtitle={<>
            <span className="md:hidden">Qrupunu idarə et, yeni qrup yarat və ya qoşul</span>
            <span className="hidden md:inline">Üzv olduğun xətm qrupları</span>
          </>}
        />

        {error && (
          <div className="p-3.5 bg-[#FBEAE5] border border-dangerline text-danger text-sm rounded-btn font-semibold">
            {error}
          </div>
        )}

        <section aria-label="Qrup siyahısı" className="flex flex-col gap-3.5">
          {groupsLoading ? (
            <Card><p className="m-0 text-sm text-muted text-center py-4">Qruplar yüklənir...</p></Card>
          ) : groups.length === 0 ? (
            <Card>
              <p className="m-0 text-sm text-muted text-center py-4">
                Hələ heç bir qrupa üzv deyilsən. Dəvət linki ilə qoşul və ya aşağıdan yeni qrup yarat.
              </p>
            </Card>
          ) : (
            groups.map((g) => {
              const status = (g.members?.[user.uid] || "pending") as GroupMemberStatus;
              const chip = STATUS_CHIP[status];
              const memberCount = Object.values(g.members || {}).filter((s) => s === "owner" || s === "member").length;
              const isActive = g.id === activeGroupId;
              const canManage = status === "owner" || isSuperAdmin;
              return (
                <div
                  key={g.id}
                  className={`bg-white rounded-card p-5 md:p-6 flex flex-wrap items-center gap-4 md:gap-5 ${
                    isActive ? "border-2 border-forest" : "border border-line"
                  }`}
                >
                  <div className="flex-[1_1_260px] flex flex-col gap-2.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="font-display font-bold text-[22px] md:text-[26px] text-forest truncate">{g.name}</div>
                      <Chip tone={chip.tone}>{chip.text}</Chip>
                      {isActive && <Chip tone="active">Aktiv qrup</Chip>}
                    </div>
                    <div className="text-sm text-muted">
                      {memberCount} iştirakçı{(g.completedKhatms || 0) > 0 ? ` · ${g.completedKhatms} xətm tamamlanıb` : ""}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 w-full md:w-auto">
                    <button type="button" onClick={() => openGroup(g.id, "/progress")} className={`${btn.primary} flex-1 md:flex-none`}>
                      {isActive ? "Qrupa bax" : "Daxil ol"}
                    </button>
                    {canManage && (
                      <button type="button" onClick={() => openGroup(g.id, "/admin")} className={`${btn.outline} flex-1 md:flex-none`}>
                        İdarə et
                      </button>
                    )}
                    {status !== "owner" && (
                      <button
                        type="button"
                        onClick={() => handleLeave(g)}
                        disabled={busyGroupId === g.id}
                        className={button("danger", "md")}
                      >
                        {busyGroupId === g.id ? "..." : "Çıx"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </section>

        <div className="flex flex-wrap gap-5 items-stretch">
          <form onSubmit={handleCreate} className="flex-[1_1_360px] bg-white border border-line rounded-card p-[18px] md:p-6 flex flex-col gap-3.5">
            <h2 className="m-0 text-base md:text-lg font-bold text-forest">Yeni qrup yarat</h2>
            <div className="flex flex-wrap gap-2.5 items-end">
              <label className="flex-[1_1_220px] flex flex-col gap-2 text-sm font-semibold">
                Qrupun adı
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Məs. Ailə xətmi"
                  disabled={creating}
                  className={inputCls}
                />
              </label>
              <button type="submit" disabled={creating || !newGroupName.trim()} className={`${btn.primary} w-full md:w-auto`}>
                {creating ? "Yaradılır..." : "Yarat"}
              </button>
            </div>
          </form>

          <form onSubmit={handleJoin} className="flex-[1_1_360px] bg-white border border-line rounded-card p-[18px] md:p-6 flex flex-col gap-3.5">
            <h2 className="m-0 text-base md:text-lg font-bold text-forest">Dəvət linki ilə qoşul</h2>
            <div className="flex flex-wrap gap-2.5 items-end">
              <label className="flex-[1_1_220px] flex flex-col gap-2 text-sm font-semibold">
                Dəvət linki
                <input
                  type="text"
                  value={inviteInput}
                  onChange={(e) => setInviteInput(e.target.value)}
                  placeholder="Linki bura yapışdır"
                  className={inputCls}
                />
              </label>
              <button type="submit" disabled={!inviteInput.trim()} className={`${button("outlineStrong")} w-full md:w-auto`}>
                Qoşul
              </button>
            </div>
          </form>
        </div>

        {/* Logout lives in the sidebar on desktop; on mobile it is here */}
        <button type="button" onClick={logout} className={`${btn.danger} md:hidden w-full`}>
          <IconLogout size={18} />
          Çıxış
        </button>
      </div>
    </AppLayout>
  );
}
