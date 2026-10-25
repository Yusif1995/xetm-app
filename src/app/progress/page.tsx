"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { type UserDoc, getUserGroupIds, isUserApprovedInGroup } from "@/lib/db";
import AppLayout from "@/components/AppLayout";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from "@/lib/auth";
import { formatIsoDateAz, relativeTimeAz } from "@/lib/dates";
import { khatmLabel } from "@/lib/quran";
import { khatmSummaries, memberStats, openKhatmForAssignment, readerStateInKhatm, type ReaderState } from "@/lib/khatm";
import { useGroupAssignments, useGroupFullNames, useGroupAdmins } from "@/lib/useGroupData";
import { JuzMap, KhatmTabs, khatmJuzTiles, memberShare, ParticipantRow, participantName, roleOf } from "@/components/GroupWidgets";
import { Bar, Card, LoadingScreen, PageHeader, button } from "@/components/ui";

// Same colours as the juz tiles above: given (yellow), in progress (brown), finished (green)
const READER_TABS: { key: ReaderState; label: string; on: string; off: string; empty: string }[] = [
  {
    key: "notStarted", label: "Başlamayanlar",
    on: "bg-juzassigned border-juzassignedline text-ink ring-2 ring-juzassignedline",
    off: "bg-juzassigned/40 border-juzassignedline/60 text-muted",
    empty: "Hamı oxumağa başlayıb.",
  },
  {
    key: "reading", label: "Davam edənlər",
    on: "bg-juzprogress border-juzprogress text-white",
    off: "bg-juzprogress/10 border-juzprogress/30 text-juzprogress",
    empty: "Hazırda oxumağa davam edən yoxdur.",
  },
  {
    key: "finished", label: "Bitirənlər",
    on: "bg-juzdone border-juzdone text-white",
    off: "bg-juzdone/10 border-juzdone/30 text-juzdone",
    empty: "Hələ cüzünü bitirən yoxdur.",
  },
];

export default function ProgressPage() {
  const { user, activeGroupId, activeGroup, isSuperAdmin } = useAuth();
  const [readerTab, setReaderTab] = useState<ReaderState>("notStarted");
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [selectedKhatm, setSelectedKhatm] = useState<number | null>(null);
  const canSeeNames = !!user && (isSuperAdmin || activeGroup?.createdBy === user.uid);
  const fullNames = useGroupFullNames(activeGroupId, canSeeNames);
  const approvedHere = !!user && (isSuperAdmin || isUserApprovedInGroup(user, activeGroupId, activeGroup));
  const { assignments, loaded } = useGroupAssignments(activeGroupId, approvedHere);
  const adminUids = useGroupAdmins(activeGroupId, approvedHere);

  // Members of the active group only
  useEffect(() => {
    if (!user) return;
    if (!activeGroupId) {
      setUsers([]);
      setUsersLoading(false);
      return;
    }
    const membersQuery = query(collection(db, "users"), where("groupIds", "array-contains", activeGroupId));
    const unsubUsers = onSnapshot(membersQuery, (snapshot) => {
      setUsers(snapshot.docs.map((d) => ({ uid: d.id, ...d.data() } as UserDoc)));
      setUsersLoading(false);
    }, (err) => {
      console.error("Error in real-time users listener:", err);
      setUsersLoading(false);
    });
    return () => unsubUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, activeGroupId]);

  if (usersLoading || !user || (approvedHere && !loaded)) {
    return <LoadingScreen text="Ümumi gedişat yüklənir..." />;
  }

  const groupCreatedBy = activeGroup?.createdBy || null;
  const filteredUsers = users.filter((u) =>
    (getUserGroupIds(u).includes(activeGroupId) || (groupCreatedBy && u.uid === groupCreatedBy))
    && isUserApprovedInGroup(u, activeGroupId, activeGroup)
  );
  const nameOf = (u: UserDoc) => participantName(u, user, fullNames);
  const nameByUid = (uid: string) => {
    const u = users.find((x) => x.uid === uid);
    return u ? nameOf(u) : "Keçmiş üzv";
  };
  // Owner first, then admins, then everyone by name
  const rank = (uid: string) => (uid === groupCreatedBy ? 0 : adminUids.includes(uid) ? 1 : 2);
  const participants = [...filteredUsers].sort((a, b) =>
    rank(a.uid) - rank(b.uid) || nameOf(a).localeCompare(nameOf(b))
  );

  // Khatms: every khatm with assignments, plus the one currently being handed out
  const summaries = khatmSummaries(assignments);
  const completed = new Set(summaries.filter((k) => k.completedAt).map((k) => k.khatm));
  const assigningKhatm = openKhatmForAssignment(assignments).khatm;
  const khatms = Array.from(new Set([...summaries.map((k) => k.khatm), ...(assignments.length > 0 ? [assigningKhatm] : [])])).sort((a, b) => a - b);
  const defaultKhatm = summaries.find((k) => !k.completedAt)?.khatm ?? khatms[khatms.length - 1] ?? 1;
  const khatm = selectedKhatm && khatms.includes(selectedKhatm) ? selectedKhatm : defaultKhatm;
  const summary = summaries.find((k) => k.khatm === khatm) || null;

  // Where each participant stands in the selected khatm, by the juz they hold now
  const byState: Record<ReaderState, UserDoc[]> = { notStarted: [], reading: [], finished: [] };
  participants.forEach((u) => byState[readerStateInKhatm(assignments, u.uid, khatm)].push(u));
  const ratio = summary ? summary.pagesRead / summary.totalPages : 0;

  // Recent activity: pages read per holder per day, newest first
  const activityMap = new Map<string, { name: string; count: number; time: number }>();
  assignments.forEach((a) => {
    Object.values(a.completedAt || {}).forEach((iso) => {
      const time = new Date(iso).getTime();
      if (Number.isNaN(time)) return;
      const key = `${a.uid}|${new Date(time).toDateString()}`;
      const entry = activityMap.get(key);
      if (entry) {
        entry.count++;
        entry.time = Math.max(entry.time, time);
      } else {
        activityMap.set(key, { name: nameByUid(a.uid), count: 1, time });
      }
    });
  });
  const activities = Array.from(activityMap.values()).sort((a, b) => b.time - a.time).slice(0, 6);

  const groupName = activeGroup?.name || "Qrup";

  return (
    <AppLayout activeTab="progress">
      <div className="flex flex-col gap-5 md:gap-7">
        <PageHeader
          title={`Qrup · ${groupName}`}
          subtitle={<>
            <span className="md:hidden">{participants.length} iştirakçı</span>
            <span className="hidden md:inline">Xətmlər, cüzlər və iştirakçıların oxuma gedişatı</span>
          </>}
          actions={
            <div className="flex gap-2">
              <Link href="/analytics" className={button("outline", "sm")}>Analitika</Link>
              <div className="md:hidden"><Link href="/groups" className={button("outline", "sm")}>Qruplarım</Link></div>
            </div>
          }
        />

        {/* Summary of the selected khatm */}
        <section aria-labelledby="xetm" className="bg-white border border-line rounded-hero shadow-card p-5 md:p-8 flex flex-col gap-3.5 md:gap-[22px]">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-2">
              <h2 id="xetm" className="m-0 text-lg md:text-xl font-bold text-ink">
                {khatmLabel(khatm)}{summary?.completedAt ? ` · tamamlandı ${formatIsoDateAz(summary.completedAt.slice(0, 10))}` : " · davam edir"}
              </h2>
              <div className="flex items-baseline gap-2.5">
                <div className="font-extrabold text-[34px] md:text-[44px] leading-none tabular-nums text-ink">{summary?.pagesRead || 0}</div>
                <div className="text-sm md:text-base text-muted">/ {summary?.totalPages || 604} səhifə · {Math.round(ratio * 100)}%</div>
              </div>
            </div>
          </div>
          <Bar ratio={ratio} color="done" height={14} label="Xətmin irəliləyişi" />
          <p className="m-0 text-sm md:text-[15px] leading-relaxed text-muted">
            {summary?.done || 0} / 30 cüz oxunub, {summary?.assigned || 0} cüz paylanıb · {participants.length} iştirakçı{completed.size > 0 ? ` · ${completed.size} xətm tamamlanıb` : ""}
          </p>
        </section>

        <div className="flex flex-wrap gap-5 md:gap-7 items-start">
          <div className="flex-[999_1_560px] min-w-0 flex flex-col gap-5 md:gap-7">
            <Card>
              <div className="flex flex-col gap-1">
                <h2 className="m-0 text-base md:text-lg font-bold text-ink">30 cüz üzrə vəziyyət · {khatmLabel(khatm)}</h2>
                <div className="text-sm text-muted hidden md:block">Hər kart bir cüzdür. İçindəki rəqəm oxunmuş səhifələrin sayıdır.</div>
              </div>
              <KhatmTabs khatms={khatms} selected={khatm} completed={completed} onSelect={setSelectedKhatm} />
              <JuzMap tiles={khatmJuzTiles(assignments, khatm)} holderName={nameByUid} />
            </Card>

            <Card className="!gap-2">
              <div className="flex items-center gap-2.5 pb-2">
                <h2 className="m-0 text-base md:text-lg font-bold text-ink">İştirakçılar</h2>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-sand text-muted">{participants.length} nəfər</span>
              </div>
              <div role="tablist" aria-label="İştirakçıların vəziyyəti" className="grid grid-cols-3 gap-1.5 pb-2">
                {READER_TABS.map((t) => {
                  const selected = readerTab === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => setReaderTab(t.key)}
                      className={`press min-h-[52px] px-1.5 rounded-[14px] border box-border flex flex-col items-center justify-center leading-tight ${selected ? t.on : t.off}`}
                    >
                      <span className="text-[12px] md:text-[13px] font-bold whitespace-nowrap">{t.label}</span>
                      <span className="text-base font-extrabold tabular-nums">{byState[t.key].length}</span>
                    </button>
                  );
                })}
              </div>
              {byState[readerTab].length === 0 ? (
                <p className="m-0 text-sm text-muted py-4">{READER_TABS.find((t) => t.key === readerTab)!.empty}</p>
              ) : (
                byState[readerTab].map((u) => {
                  const inKhatm = memberStats(assignments, u.uid).perKhatm.find((k) => k.khatm === khatm);
                  return (
                    <ParticipantRow
                      key={u.uid}
                      share={memberShare(assignments, u.uid)}
                      note={inKhatm ? `${khatmLabel(khatm)}: ${inKhatm.juz.length} cüz · ${inKhatm.pagesRead} səhifə` : `${khatmLabel(khatm)}: cüz yoxdur`}
                      name={nameOf(u)}
                      isSelf={u.uid === user.uid}
                      isOwner={u.uid === groupCreatedBy}
                      role={roleOf(u.uid, user.uid, groupCreatedBy, adminUids)}
                    />
                  );
                })
              )}
            </Card>
          </div>

          <div className="flex-[1_1_300px] min-w-0 flex flex-col gap-5 md:gap-7">
            <Card>
              <h2 className="m-0 text-base md:text-[15px] font-bold text-ink">Son fəaliyyət</h2>
              {activities.length === 0 ? (
                <p className="m-0 text-sm text-muted">Hələ oxunmuş səhifə yoxdur.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {activities.map((a, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${i === 0 ? "bg-accent" : "bg-done"}`} />
                      <div className="flex flex-col gap-0.5">
                        <div className="text-sm font-semibold">{a.name} {a.count} səhifə oxuyub</div>
                        <div className="text-[13px] text-muted">{relativeTimeAz(a.time)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

