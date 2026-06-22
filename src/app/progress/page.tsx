"use client";

import { useEffect, useState } from "react";
import { type UserDoc, type AppSettings, getUserGroupIds, getUserAssignment, isUserApprovedInGroup } from "@/lib/db";
import ProgressBar from "@/components/ProgressBar";
import UserRow from "@/components/UserRow";
import AppLayout from "@/components/AppLayout";
import { db } from "@/lib/firebase";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { useAuth } from "@/lib/auth";

export default function ProgressPage() {
  const { user, activeGroupId } = useAuth();
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ completedKhatms: 0 });
  const [loading, setLoading] = useState(true);
  const [groupCreatedBy, setGroupCreatedBy] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const list: UserDoc[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ uid: docSnap.id, ...docSnap.data() } as UserDoc);
      });
      setUsers(list);
      setLoading(false);
    }, (err) => {
      console.error("Error in real-time users listener:", err);
      setLoading(false);
    });

    return () => unsubUsers();
  }, [user]);

  useEffect(() => {
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
          completedKhatms: data.completedKhatms || 0
        } as AppSettings);
      }
    }, (err) => {
      console.error("Error in real-time settings listener:", err);
    });

    return () => unsubSettings();
  }, [activeGroupId]);

  // Filter users by active group membership and approval
  const filteredUsers = users.filter((u) => 
    (getUserGroupIds(u).includes(activeGroupId) || (groupCreatedBy && u.uid === groupCreatedBy))
    && isUserApprovedInGroup(u, activeGroupId)
  );

  // Calculate unique pages completed by the group out of 604
  const completedPagesSet = new Set<number>();
  filteredUsers.forEach((u) => {
    const assignment = getUserAssignment(u, activeGroupId);
    const assigned = assignment.assignedPages || [];
    const completed = assignment.completedPages || [];
    completed.forEach((page) => {
      // Only count if the page is assigned to this user and is within the Quran page bounds
      if (page >= 1 && page <= 604 && assigned.includes(page)) {
        completedPagesSet.add(page);
      }
    });
  });
  
  const totalUniqueCompleted = completedPagesSet.size;

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-[#FAF7F2] text-[#0F3D2C] min-h-screen">
        <div className="animate-spin h-10 w-10 text-[#0F3D2C] mb-4">
          <svg className="w-full h-full" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
        <p className="text-sm font-semibold tracking-wide text-[#0F3D2C]/80">Ümumi gedişat yüklənir...</p>
      </div>
    );
  }

  return (
    <AppLayout activeTab="progress">
      <div className="space-y-6 max-w-5xl mx-auto">
        
        {/* Title Header */}
        <div className="flex flex-col border-b border-[#0F3D2C]/5 pb-4">
          <h1 className="text-3xl font-bold tracking-tight text-[#0F3D2C]">
            Qrup Üzrə Ümumi Gedişat
          </h1>
          <p className="text-xs font-semibold text-[#0F3D2C]/60 mt-1 uppercase tracking-wider">
            Xətm qrupumuzdakı bütün iştirakçıların Quran oxuma gedişatını buradan izləyə bilərsiniz.
          </p>
        </div>

        {/* Top Summary Card */}
        <div className="card-premium flex flex-col gap-4">
          <h2 className="text-lg font-bold text-[#0F3D2C] tracking-wide">
            Qrup Xətm Tamamlanması
          </h2>
          <p className="text-xs text-[#0F3D2C]/70 leading-relaxed max-w-2xl font-sans">
            Məqsədimiz Quranın 604 səhifəsinin hamısını birgə tamamlamaqdır. Aşağıdakı bar qrup üzrə tamamlanan unikal səhifələrin sayını göstərir.
          </p>

          <ProgressBar 
            completed={totalUniqueCompleted} 
            total={604} 
            label="Qrup Üzrə Oxunan Səhifə" 
          />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card-premium text-center flex flex-col justify-center items-center py-5">
            <span className="text-[10px] text-[#D5A85A] uppercase font-bold tracking-wider">Tamamlanan Ümumi Xətm</span>
            <div className="text-3xl font-extrabold text-[#0F3D2C] mt-1 font-mono">{settings.completedKhatms || 0}</div>
          </div>
          <div className="card-premium text-center flex flex-col justify-center items-center py-5">
            <span className="text-[10px] text-[#D5A85A] uppercase font-bold tracking-wider">Cari Xətmin Səhifələri</span>
            <div className="text-3xl font-extrabold text-[#0F3D2C] mt-1 font-mono">{totalUniqueCompleted} / 604</div>
          </div>
          <div className="card-premium text-center flex flex-col justify-center items-center py-5">
            <span className="text-[10px] text-[#D5A85A] uppercase font-bold tracking-wider">Cari Xətm Faiz</span>
            <div className="text-3xl font-extrabold text-[#D5A85A] mt-1 font-mono">
              {Math.round((totalUniqueCompleted / 604) * 100)}%
            </div>
          </div>
        </div>

        {/* Participants Table */}
        <div className="card-premium overflow-hidden !p-0">
          <div className="p-5 border-b border-[#0F3D2C]/5 bg-[#FAF7F2]">
            <h3 className="text-sm font-bold text-[#0F3D2C] flex items-center gap-2">
              <span>İştirakçıların Siyahısı</span>
              <span className="text-[10px] bg-[#0F3D2C]/5 text-[#0F3D2C] px-2.5 py-0.5 rounded-full border border-[#0F3D2C]/10 font-bold">
                {filteredUsers.length} nəfər
              </span>
            </h3>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="text-center py-16 text-[#0F3D2C]/40">
              Siyahıda hələ heç bir iştirakçı yoxdur.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#FAF7F2] border-b border-[#0F3D2C]/10 text-[10px] text-[#0F3D2C]/60 uppercase font-bold tracking-wider">
                    <th className="px-4 py-3 md:px-6 md:py-4">İştirakçı</th>
                    <th className="px-4 py-3 md:px-6 md:py-4">Təyin edilmiş Səhifələr</th>
                    <th className="px-4 py-3 md:px-6 md:py-4">Tamamlanan</th>
                    <th className="px-4 py-3 md:px-6 md:py-4">Faiz</th>
                    <th className="px-4 py-3 md:px-6 md:py-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <UserRow key={u.uid} user={u} isAdminView={false} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
