"use client";

import { useEffect, useState } from "react";
import { type UserDoc, type AppSettings } from "@/lib/db";
import ProgressBar from "@/components/ProgressBar";
import UserRow from "@/components/UserRow";
import AppLayout from "@/components/AppLayout";
import { db } from "@/lib/firebase";
import { collection, doc, onSnapshot } from "firebase/firestore";

export default function ProgressPage() {
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ completedKhatms: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

    const unsubSettings = onSnapshot(doc(db, "settings", "config"), (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data() as AppSettings);
      }
    }, (err) => {
      console.error("Error in real-time settings listener:", err);
    });

    return () => {
      unsubUsers();
      unsubSettings();
    };
  }, []);

  // Calculate unique pages completed by the group out of 604
  const completedPagesSet = new Set<number>();
  users.forEach((u) => {
    const assigned = u.assignedPages || [];
    const completed = u.completedPages || [];
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
      <div className="flex-1 flex flex-col justify-center items-center islamic-bg text-[#fdf6e3] min-h-screen">
        <div className="animate-spin h-10 w-10 text-[#c9a84c] mb-4">
          <svg className="w-full h-full" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
        <p className="text-sm font-semibold tracking-wide text-[#fdf6e3]/85">Ümumi gedişat yüklənir...</p>
      </div>
    );
  }

  return (
    <AppLayout activeTab="progress">
        
        {/* Top Summary Card */}
        <div className="islamic-card p-6 shadow-xl relative overflow-hidden">
          <div className="islamic-card-inner" />
          <div className="islamic-pattern" />
          <div className="relative z-10 w-full">
            <h2 className="text-xl md:text-2xl font-amiri font-bold text-[#c9a84c] mb-2 uppercase tracking-wide">
              Qrup Üzrə Ümumi Gedişat
            </h2>
            <p className="text-sm text-[#fdf6e3]/75 mb-6 max-w-2xl font-sans">
              Bu xətm qrupumuzdakı bütün iştirakçıların oxuduğu Quran səhifələrinin cəmidir. Məqsədimiz Quranın 604 səhifəsinin hamısını birgə tamamlamaqdır.
            </p>

            <ProgressBar 
              completed={totalUniqueCompleted} 
              total={604} 
              label="Qrup Xətm Tamamlanması" 
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="islamic-card p-6 text-center shadow-md">
            <div className="islamic-card-inner" />
            <div className="islamic-pattern" />
            <div className="relative z-10">
              <span className="text-xs text-[#c9a84c] uppercase font-bold tracking-wider">Tamamlanan Ümumi Xətm</span>
              <div className="text-3xl font-extrabold text-[#fdf6e3] mt-1 font-mono">{settings.completedKhatms || 0}</div>
            </div>
          </div>
          <div className="islamic-card p-6 text-center shadow-md">
            <div className="islamic-card-inner" />
            <div className="islamic-pattern" />
            <div className="relative z-10">
              <span className="text-xs text-[#c9a84c] uppercase font-bold tracking-wider">Cari Xətmin Səhifələri</span>
              <div className="text-3xl font-extrabold text-[#fdf6e3] mt-1 font-mono">{totalUniqueCompleted} / 604</div>
            </div>
          </div>
          <div className="islamic-card p-6 text-center shadow-md">
            <div className="islamic-card-inner" />
            <div className="islamic-pattern" />
            <div className="relative z-10">
              <span className="text-xs text-[#c9a84c] uppercase font-bold tracking-wider">Cari Xətm Faiz</span>
              <div className="text-3xl font-extrabold text-[#c9a84c] mt-1 font-mono">
                {Math.round((totalUniqueCompleted / 604) * 100)}%
              </div>
            </div>
          </div>
        </div>

        {/* Participants Table */}
        <div className="islamic-card shadow-lg overflow-hidden">
          <div className="islamic-card-inner" />
          <div className="islamic-pattern" />
          <div className="relative z-10 w-full">
            <div className="p-5 border-b border-[#c9a84c]/15 bg-[#0b301a]/60">
              <h3 className="text-lg font-bold text-[#fdf6e3] flex items-center gap-2">
                <span>İştirakçıların Siyahısı</span>
                <span className="text-xs bg-[#c9a84c]/15 text-[#c9a84c] px-2.5 py-0.5 rounded-full border border-[#c9a84c]/20">
                  {users.length} nəfər
                </span>
              </h3>
            </div>

            {users.length === 0 ? (
              <div className="text-center py-16 text-[#fdf6e3]/50">
                Siyahıda hələ heç bir iştirakçı yoxdur.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#05180d]/85 border-b border-[#c9a84c]/15 text-xs text-[#c9a84c] uppercase font-bold tracking-wider">
                      <th className="px-4 py-3 md:px-6 md:py-4">İştirakçı</th>
                      <th className="px-4 py-3 md:px-6 md:py-4">Təyin edilmiş Səhifələr</th>
                      <th className="px-4 py-3 md:px-6 md:py-4">Tamamlanan</th>
                      <th className="px-4 py-3 md:px-6 md:py-4">Faiz</th>
                      <th className="px-4 py-3 md:px-6 md:py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
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
