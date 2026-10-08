"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { createGroup, leaveGroup, type GroupDoc, type GroupMemberStatus } from "@/lib/db";
import AppLayout from "@/components/AppLayout";

const STATUS_LABELS: Record<GroupMemberStatus, { text: string; className: string }> = {
  owner: { text: "Qrup sahibi", className: "bg-purple-50 text-purple-700 border-purple-200" },
  member: { text: "Üzv", className: "bg-green-50 text-green-700 border-green-200" },
  pending: { text: "Təsdiq gözlənilir", className: "bg-amber-50 text-amber-700 border-amber-200" },
};

export default function GroupsPage() {
  const { user, loading, activeGroupId, setActiveGroupId } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<GroupDoc[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);
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
      list.sort((a, b) => a.name.localeCompare(b.name));
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

  const handleOpen = (groupId: string) => {
    setActiveGroupId(groupId);
    router.push("/dashboard");
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
      router.push("/dashboard");
    } catch (err) {
      console.error("Error creating group:", err);
      setError("Qrup yaradılarkən xəta baş verdi. Zəhmət olmasa yenidən cəhd edin.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppLayout activeTab="groups">
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="flex flex-col border-b border-[#0F3D2C]/5 pb-4">
          <h1 className="text-3xl font-bold tracking-tight text-[#0F3D2C]">Qruplarım</h1>
          <p className="text-xs font-semibold text-[#0F3D2C]/60 mt-1 uppercase tracking-wider">
            Üzv olduğunuz xətm qrupları. Qrupa keçmək üçün &quot;Daxil ol&quot; düyməsinə basın.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg font-semibold">
            {error}
          </div>
        )}

        <div className="card-premium flex flex-col gap-3">
          {groupsLoading ? (
            <p className="text-sm text-[#0F3D2C]/60 py-6 text-center">Qruplar yüklənir...</p>
          ) : groups.length === 0 ? (
            <p className="text-sm text-[#0F3D2C]/60 py-6 text-center">
              Hələ heç bir qrupa üzv deyilsiniz. Dəvət linki ilə qoşulun və ya aşağıdan yeni qrup yaradın.
            </p>
          ) : (
            groups.map((g) => {
              const status = (g.members?.[user.uid] || "pending") as GroupMemberStatus;
              const label = STATUS_LABELS[status];
              const memberCount = Object.values(g.members || {}).filter((s) => s === "owner" || s === "member").length;
              const isActive = g.id === activeGroupId;
              return (
                <div
                  key={g.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border ${
                    isActive ? "border-[#0F3D2C]/40 bg-[#E8F4EC]" : "border-[#0F3D2C]/10 bg-[#FAF7F2]"
                  }`}
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-sm font-bold text-[#0F3D2C] truncate">{g.name}</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${label.className}`}>
                        {label.text}
                      </span>
                      <span className="text-[10px] text-[#0F3D2C]/60 font-semibold">{memberCount} iştirakçı</span>
                      {isActive && <span className="text-[10px] text-[#0F3D2C] font-bold">• Aktiv qrup</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleOpen(g.id)}
                      className="px-4 py-2 bg-[#0F3D2C] hover:bg-[#16503c] text-white rounded-lg text-xs font-bold transition-colors"
                    >
                      Daxil ol
                    </button>
                    {status !== "owner" && (
                      <button
                        onClick={() => handleLeave(g)}
                        disabled={busyGroupId === g.id}
                        className="px-3 py-2 bg-white hover:bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        {busyGroupId === g.id ? "..." : "Çıx"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <form onSubmit={handleCreate} className="card-premium flex flex-col gap-3">
          <h3 className="text-sm font-bold text-[#0F3D2C]">Yeni qrup yarat</h3>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Məs. Ailə Xətmi"
              disabled={creating}
              className="flex-1 px-3.5 py-2.5 bg-white border border-[#0F3D2C]/15 focus:border-[#0F3D2C] rounded-xl text-xs font-semibold text-[#0F3D2C] focus:outline-none"
            />
            <button
              type="submit"
              disabled={creating || !newGroupName.trim()}
              className="px-4 py-2.5 bg-[#D5A85A] hover:bg-[#b0913e] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors"
            >
              {creating ? "Yaradılır..." : "Yarat"}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
