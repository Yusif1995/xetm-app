"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { type UserDoc, getUserGroupIds, getUserAssignment, isUserApprovedInGroup } from "@/lib/db";
import AppLayout from "@/components/AppLayout";
import { db } from "@/lib/firebase";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from "@/lib/auth";
import { relativeTimeAz } from "@/lib/dates";
import { useGroupFullNames } from "@/lib/useGroupData";
import { ParticipantRow, participantName, computeJuzStates, JuzMap } from "@/components/GroupWidgets";
import { Bar, Card, IconLink, LoadingScreen, PageHeader, btn, button } from "@/components/ui";

export default function ProgressPage() {
  const { user, activeGroupId, activeGroup, isSuperAdmin } = useAuth();
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [completedKhatms, setCompletedKhatms] = useState(0);
  const [loading, setLoading] = useState(true);
  const [groupCreatedBy, setGroupCreatedBy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const canSeeNames = !!user && (isSuperAdmin || activeGroup?.createdBy === user.uid);
  const fullNames = useGroupFullNames(activeGroupId, canSeeNames);

  // Members of the active group only
  useEffect(() => {
    if (!user) return;
    if (!activeGroupId) {
      setUsers([]);
      setLoading(false);
      return;
    }

    const membersQuery = query(collection(db, "users"), where("groupIds", "array-contains", activeGroupId));
    const unsubUsers = onSnapshot(membersQuery, (snapshot) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, activeGroupId]);

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
        setCompletedKhatms(data.completedKhatms || 0);
      }
    }, (err) => {
      console.error("Error in real-time settings listener:", err);
    });

    return () => unsubSettings();
  }, [activeGroupId]);

  if (loading || !user) {
    return <LoadingScreen text="Ümumi gedişat yüklənir..." />;
  }

  // Filter users by active group membership and approval
  const filteredUsers = users.filter((u) =>
    (getUserGroupIds(u).includes(activeGroupId) || (groupCreatedBy && u.uid === groupCreatedBy))
    && isUserApprovedInGroup(u, activeGroupId, activeGroup)
  );
  const nameOf = (u: UserDoc) => participantName(u, user, fullNames);
  const participants = [...filteredUsers].sort((a, b) =>
    a.uid === groupCreatedBy ? -1 : b.uid === groupCreatedBy ? 1 : nameOf(a).localeCompare(nameOf(b))
  );

  // Unique pages completed by the group out of 604 (only pages assigned to the reader)
  const completedPagesSet = new Set<number>();
  filteredUsers.forEach((u) => {
    const assignment = getUserAssignment(u, activeGroupId);
    const assigned = assignment.assignedPages || [];
    (assignment.completedPages || []).forEach((page) => {
      if (page >= 1 && page <= 604 && assigned.includes(page)) {
        completedPagesSet.add(page);
      }
    });
  });
  const totalUniqueCompleted = completedPagesSet.size;
  const ratio = totalUniqueCompleted / 604;

  const juzStates = computeJuzStates(filteredUsers, activeGroupId);
  const completedJuz = juzStates.filter((j) => j.state === "done").length;

  // Recent activity: pages read per member per day, newest first
  const activityMap = new Map<string, { name: string; count: number; time: number }>();
  filteredUsers.forEach((u) => {
    const a = getUserAssignment(u, activeGroupId);
    [...Object.values(a.completedAt || {}), ...Object.values(a.previousCompletedAt || {})].forEach((iso) => {
      const time = new Date(iso).getTime();
      if (Number.isNaN(time)) return;
      const key = `${u.uid}|${new Date(time).toDateString()}`;
      const entry = activityMap.get(key);
      if (entry) {
        entry.count++;
        entry.time = Math.max(entry.time, time);
      } else {
        activityMap.set(key, { name: nameOf(u), count: 1, time });
      }
    });
  });
  const activities = Array.from(activityMap.values()).sort((a, b) => b.time - a.time).slice(0, 5);

  const handleCopyInvite = () => {
    if (!activeGroupId) return;
    const inviteLink = `${window.location.origin}/?invite=${activeGroupId}`;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  };

  const groupName = activeGroup?.name || "Qrup";

  return (
    <AppLayout activeTab="progress">
      <div className="flex flex-col gap-5 md:gap-7">
        <PageHeader
          title={`Qrup · ${groupName}`}
          subtitle={<>
            <span className="md:hidden">{participants.length} iştirakçı</span>
            <span className="hidden md:inline">Xətm qrupundakı bütün iştirakçıların oxuma gedişatı</span>
          </>}
          actions={
            <div className="md:hidden"><Link href="/groups" className={button("outline", "sm")}>Qruplarım</Link></div>
          }
        />

        {/* Summary */}
        <section aria-labelledby="xetm" className="bg-forest text-cream rounded-[22px] md:rounded-hero p-5 md:p-8 flex flex-col gap-3.5 md:gap-[22px]">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-2">
              <h2 id="xetm" className="m-0 text-[13px] font-semibold text-gold">Cari xətm</h2>
              <div className="flex items-baseline gap-2.5">
                <div className="font-display font-bold text-[44px] md:text-[64px] leading-none">{totalUniqueCompleted}</div>
                <div className="text-sm md:text-lg text-onforest">/ 604 səhifə</div>
              </div>
            </div>
            <div className="font-display font-bold text-[28px] md:text-[40px] text-gold">{Math.round(ratio * 100)}%</div>
          </div>
          <Bar ratio={ratio} color="gold" height={14} dark />
          <div className="flex flex-wrap gap-6 md:gap-8 text-sm text-onforest">
            <Stat label="Tamamlanan xətm" value={String(completedKhatms)} />
            <Stat label="Tamamlanan cüz" value={`${completedJuz} / 30`} />
            <Stat label="İştirakçı" value={String(participants.length)} />
          </div>
        </section>

        <div className="flex flex-wrap gap-5 md:gap-7 items-start">
          <div className="flex-[999_1_560px] min-w-0 flex flex-col gap-5 md:gap-7">
            <Card>
              <div className="flex flex-col gap-1">
                <h2 className="m-0 text-base md:text-lg font-bold text-forest">30 cüz üzrə vəziyyət</h2>
                <div className="text-sm text-muted hidden md:block">Hər kart bir cüzdür. İçindəki rəqəm oxunmuş səhifələrin sayıdır.</div>
              </div>
              <JuzMap states={juzStates} />
            </Card>

            <Card className="!gap-2">
              <div className="flex items-center gap-2.5 pb-2">
                <h2 className="m-0 text-base md:text-lg font-bold text-forest">İştirakçılar</h2>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-sand text-muted">{participants.length} nəfər</span>
              </div>
              {participants.length === 0 ? (
                <p className="m-0 text-sm text-muted py-4">Siyahıda hələ heç bir iştirakçı yoxdur.</p>
              ) : (
                participants.map((u) => (
                  <ParticipantRow
                    key={u.uid}
                    user={u}
                    groupId={activeGroupId}
                    name={nameOf(u)}
                    isSelf={u.uid === user.uid}
                    isOwner={u.uid === groupCreatedBy}
                  />
                ))
              )}
            </Card>
          </div>

          <div className="flex-[1_1_300px] min-w-0 flex flex-col gap-5 md:gap-7">
            <Card>
              <h2 className="m-0 text-base md:text-[15px] font-bold text-forest md:text-muted">Son fəaliyyət</h2>
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

            <section className="bg-mint rounded-card p-[18px] md:p-6 flex flex-col gap-3.5">
              <h2 className="m-0 font-display font-semibold text-lg md:text-[22px] text-forest">Qrupa yeni iştirakçı əlavə et</h2>
              <div className="text-sm leading-relaxed text-[#2F4A3E]">Dəvət linkini paylaş, qoşulan şəxs qrup sahibinin təsdiqindən sonra qrupa daxil olsun.</div>
              <button type="button" onClick={handleCopyInvite} className={btn.primary}>
                <IconLink size={18} />
                {copied ? "Link kopyalandı" : "Dəvət linkini kopyala"}
              </button>
            </section>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span>{label}</span>
      <span className="text-[22px] font-bold text-cream">{value}</span>
    </div>
  );
}
