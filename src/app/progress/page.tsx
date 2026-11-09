"use client";

import { useEffect, useState } from "react";
import { type UserDoc, getUserGroupIds, isUserApprovedInGroup } from "@/lib/db";
import AppLayout from "@/components/AppLayout";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from "@/lib/auth";
import { relativeTimeAz } from "@/lib/dates";
import { khatmLabel, ordinalAz } from "@/lib/quran";
import { activeDistributions, activeKhatms, khatmSummaries, readerStateInDistribution, type ReaderState } from "@/lib/khatm";
import { useGroupAssignments, useGroupFullNames, useGroupAdmins } from "@/lib/useGroupData";
import { JuzMap, KhatmTabs, khatmJuzTiles, ParticipantRow, participantName, roleOf, type ShareStats } from "@/components/GroupWidgets";
import { Card, LoadingScreen, PageHeader } from "@/components/ui";
import { StatStrip, Up } from "@/components/dash";

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
  const [selectedDist, setSelectedDist] = useState<number | null>(null);
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

  // Khatms on the 30-juz card: the unfinished ones (at most 3, the current one first). A khatm whose
  // 30 juz are all finished leaves this screen and is kept in the admin archive.
  const summaries = khatmSummaries(assignments);
  const completed = new Set(summaries.filter((k) => k.completedAt).map((k) => k.khatm));
  const khatms = activeKhatms(assignments);
  const khatm = selectedKhatm && khatms.includes(selectedKhatm) ? selectedKhatm : khatms[0] ?? 1;
  const summary = summaries.find((k) => k.khatm === khatm) || null;
  const ratio = summary ? summary.pagesRead / summary.totalPages : 0;

  // Participants card, per distribution: the unfinished ones (at most 3), newest first. A
  // distribution in which everyone has finished their juz is no longer shown.
  const distributions = activeDistributions(assignments);
  const distribution = selectedDist && distributions.includes(selectedDist) ? selectedDist : distributions[0] ?? null;
  const byState: Record<ReaderState, UserDoc[]> = { notStarted: [], reading: [], finished: [] };
  let withoutJuz = 0;
  if (distribution !== null) {
    participants.forEach((u) => {
      const state = readerStateInDistribution(assignments, u.uid, distribution);
      if (state) byState[state].push(u);
      else withoutJuz++;
    });
  }
  // Row figures for the selected distribution only
  const distShare = (uid: string): ShareStats => {
    const mine = assignments.filter((a) => a.uid === uid && a.distribution === distribution);
    const done = mine.reduce((s, a) => s + a.completedPages.length, 0);
    const total = mine.reduce((s, a) => s + a.pages.length, 0);
    const finished = mine.filter((a) => a.done).length;
    const state = distribution !== null ? readerStateInDistribution(assignments, uid, distribution) : null;
    return {
      label: mine.map((a) => `Cüz ${a.juz} · ${khatmLabel(a.khatm)}`).join(", "),
      done, total, ratio: total > 0 ? done / total : 0,
      open: mine.length - finished, finished,
      status: state === "finished" ? "done" : state === "reading" ? "progress" : "assigned",
    };
  };

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
          subtitle="Xətmlər, cüzlər və iştirakçıların oxuma gedişatı"
          tabs={[
            { id: "xulase", label: "Xülasə" },
            { id: "cuzler", label: "30 cüz" },
            { id: "fealiyyet", label: "Son fəaliyyət" },
            { id: "istirakcilar", label: "İştirakçılar" },
          ]}
        />

        <div id="xulase" className="scroll-mt-28">
          <StatStrip
            items={[
              {
                label: "Cari xətm",
                value: summary?.pagesRead || 0,
                unit: `/ ${summary?.totalPages || 604}`,
                note: <><Up>{Math.round(ratio * 100)}%</Up> · {khatmLabel(khatm)}</>,
              },
              {
                label: "Bitmiş cüzlər",
                value: summary?.done || 0,
                unit: "/ 30",
                note: `${summary?.assigned || 0} cüz paylanıb`,
              },
              {
                label: "İştirakçılar",
                value: participants.length,
                note: distribution !== null ? `${byState.reading.length} oxuyur, ${byState.notStarted.length} başlamayıb` : "Bölgü yoxdur",
              },
              {
                label: "Tamamlanmış xətmlər",
                value: completed.size,
                note: completed.size > 0 ? "Allah qəbul etsin" : "Birinci xətm davam edir",
              },
            ]}
          />
        </div>


        <div className="flex flex-wrap gap-5 md:gap-7 items-start">
          <div className="flex-[999_1_560px] min-w-0 flex flex-col gap-5 md:gap-7">
            <Card id="cuzler" className="scroll-mt-28">
              <div className="flex flex-col gap-1">
                <h2 className="m-0 text-base md:text-lg font-bold text-ink">30 cüz üzrə vəziyyət · {khatmLabel(khatm)}</h2>
                <div className="text-sm text-muted hidden md:block">Hər kart bir cüzdür. İçindəki rəqəm oxunmuş səhifələrin sayıdır.</div>
              </div>
              <KhatmTabs khatms={khatms} selected={khatm} completed={completed} onSelect={setSelectedKhatm} />
              <JuzMap tiles={khatmJuzTiles(assignments, khatm)} holderName={nameByUid} byDistribution />
            </Card>

          </div>

          <div className="flex-[1_1_300px] min-w-0 flex flex-col gap-5 md:gap-7">
            <Card id="fealiyyet" className="scroll-mt-28">
              <h2 className="m-0 text-base md:text-lg font-bold text-ink">Son fəaliyyət</h2>
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

            <Card className="!gap-2 scroll-mt-28" id="istirakcilar">
              <div className="flex items-center gap-2.5 pb-2">
                <h2 className="m-0 text-base md:text-lg font-bold text-ink">İştirakçılar</h2>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-sand text-muted">{participants.length} nəfər</span>
              </div>
              {distribution === null ? (
                <p className="m-0 text-sm text-muted py-4">
                  {assignments.length === 0 ? "Hələ cüz paylanmayıb." : "Bütün bölgülərdə hamı cüzünü bitirib. Növbəti bölgü burada görünəcək."}
                </p>
              ) : (
              <>
              {/* One tab per unfinished distribution, the current one first */}
              <div role="tablist" aria-label="Bölgü" className="flex flex-wrap gap-1.5 pb-2">
                {distributions.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    role="tab"
                    aria-selected={distribution === d}
                    onClick={() => setSelectedDist(d)}
                    className={`press min-h-[40px] px-3.5 rounded-xl text-sm font-semibold border ${
                      distribution === d ? "bg-forest text-white border-forest" : "bg-white text-ink border-field hover:bg-sand"
                    }`}
                  >
                    {ordinalAz(d)} bölgü{i === 0 ? " · cari" : ""}
                  </button>
                ))}
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
                  const share = distShare(u.uid);
                  return (
                    <ParticipantRow
                      key={u.uid}
                      share={share}
                      note={`${ordinalAz(distribution)} bölgü: ${share.done} / ${share.total} səhifə`}
                      name={nameOf(u)}
                      isSelf={u.uid === user.uid}
                      isOwner={u.uid === groupCreatedBy}
                      role={roleOf(u.uid, user.uid, groupCreatedBy, adminUids)}
                    />
                  );
                })
              )}
              {withoutJuz > 0 && (
                <p className="m-0 pt-3 text-xs text-muted border-t border-sand">
                  {withoutJuz} nəfərə bu bölgüdə cüz verilməyib.
                </p>
              )}
              </>
              )}
            </Card>
      </div>
    </AppLayout>
  );
}

