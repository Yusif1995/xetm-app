"use client";
// Archive for group managers: khatms whose 30 juz are all finished and distributions in which
// everyone finished. They leave the Qrup screen but stay in the database; this page shows them.
import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import type { UserDoc } from "@/lib/db";
import { activeDistributions, khatmSummaries } from "@/lib/khatm";
import { bakuDay, dayDiff } from "@/lib/analytics";
import { khatmLabel, ordinalAz } from "@/lib/quran";
import { formatIsoDateAz } from "@/lib/dates";
import { useGroupAssignments, useGroupFullNames } from "@/lib/useGroupData";
import { JuzMap, khatmJuzTiles, participantName } from "@/components/GroupWidgets";
import AppLayout from "@/components/AppLayout";
import { Card, Chip, LoadingScreen, PageHeader, button } from "@/components/ui";

export default function ArchivePage() {
  const { user, loading, activeGroupId, activeGroup, activeGroupLoaded, isSuperAdmin } = useAuth();
  const canManage = !!user && (isSuperAdmin || activeGroup?.createdBy === user.uid);
  const { assignments, loaded } = useGroupAssignments(activeGroupId, canManage);
  const fullNames = useGroupFullNames(activeGroupId, canManage);
  const [users, setUsers] = useState<UserDoc[]>([]);

  useEffect(() => {
    if (!user || !activeGroupId || !canManage) return;
    const q = query(collection(db, "users"), where("groupIds", "array-contains", activeGroupId));
    const unsub = onSnapshot(q, (snap) => setUsers(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserDoc))),
      (err) => console.error("Error loading members:", err));
    return () => unsub();
  }, [user, activeGroupId, canManage]);

  if (loading || !user || !activeGroupLoaded || (canManage && !loaded)) return <LoadingScreen text="Arxiv yüklənir..." />;

  if (!canManage) {
    return (
      <AppLayout activeTab="admin">
        <Card danger className="items-center text-center py-12">
          <h2 className="m-0 font-bold text-2xl text-danger">Giriş məhdudlaşdırılıb</h2>
          <p className="m-0 text-sm text-muted">Arxivi yalnız qrupun rəhbəri və adminlər görə bilər.</p>
        </Card>
      </AppLayout>
    );
  }

  const nameOf = (uid: string) => {
    const u = users.find((x) => x.uid === uid);
    return u ? participantName(u, user, fullNames) : fullNames[uid] || "Keçmiş üzv";
  };

  const doneKhatms = khatmSummaries(assignments).filter((k) => k.completedAt).reverse();
  const active = new Set(activeDistributions(assignments, Number.MAX_SAFE_INTEGER));
  const doneDistributions = Array.from(new Set(assignments.map((a) => a.distribution)))
    .filter((d) => !active.has(d))
    .sort((a, b) => b - a);

  return (
    <AppLayout activeTab="admin">
      <div className="max-w-[960px] flex flex-col gap-5 md:gap-7">
        <PageHeader
          title="Arxiv"
          subtitle={activeGroup?.name}
          actions={<Link href="/admin" className={button("outline", "sm")}>İnzibatçı paneli</Link>}
        />

        <section className="flex flex-col gap-3.5">
          <h2 className="m-0 text-lg md:text-xl font-extrabold text-ink">Tamamlanmış xətmlər · {doneKhatms.length}</h2>
          {doneKhatms.length === 0 ? (
            <Card><p className="m-0 text-sm text-muted">Hələ tamamlanmış xətm yoxdur. 30 cüzün hamısı oxunan xətm buraya köçür.</p></Card>
          ) : doneKhatms.map((k) => {
            const start = k.startedAt ? bakuDay(k.startedAt) : null;
            const end = bakuDay(k.completedAt!);
            return (
              <Card key={k.khatm}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="m-0 text-base md:text-lg font-bold text-ink">{khatmLabel(k.khatm)}</h3>
                  <Chip tone="done">Tamamlanıb</Chip>
                </div>
                <div className="text-[13px] text-muted">
                  {start ? `${formatIsoDateAz(start)} – ` : ""}{formatIsoDateAz(end)}
                  {start ? ` · ${dayDiff(start, end) + 1} gün` : ""} · {k.pagesRead} səhifə
                </div>
                <JuzMap tiles={khatmJuzTiles(assignments, k.khatm)} holderName={nameOf} />
              </Card>
            );
          })}
        </section>

        <section className="flex flex-col gap-3.5">
          <h2 className="m-0 text-lg md:text-xl font-extrabold text-ink">Tamamlanmış bölgülər · {doneDistributions.length}</h2>
          {doneDistributions.length === 0 ? (
            <Card><p className="m-0 text-sm text-muted">Hələ tamamlanmış bölgü yoxdur. Hamının cüzünü bitirdiyi bölgü buraya köçür.</p></Card>
          ) : doneDistributions.map((d) => {
            const list = assignments.filter((a) => a.distribution === d).sort((a, b) => (a.doneAt || "").localeCompare(b.doneAt || ""));
            const first = list[0];
            return (
              <Card key={d}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="m-0 text-base md:text-lg font-bold text-ink">{ordinalAz(d)} bölgü</h3>
                  <Chip tone="done">Hamı bitirib</Chip>
                </div>
                <div className="text-[13px] text-muted">
                  {first?.startDate && first.endDate ? `${formatIsoDateAz(first.startDate)} – ${formatIsoDateAz(first.endDate)} · ` : ""}{list.length} cüz
                </div>
                <div className="flex flex-col divide-y divide-line border-t border-line">
                  {list.map((a) => (
                    <div key={a.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 text-sm">
                      <span className="font-bold text-ink">{nameOf(a.uid)}</span>
                      <span className="text-muted">
                        Cüz {a.juz} · {khatmLabel(a.khatm)}{a.doneAt ? ` · bitib ${formatIsoDateAz(a.doneAt.slice(0, 10))}` : ""}
                        {a.endDate && a.doneAt && bakuDay(a.doneAt) > a.endDate ? " · gecikib" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </section>
      </div>
    </AppLayout>
  );
}
