"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { getUserGroupIds, isUserApprovedInGroup, type UserDoc } from "@/lib/db";
import { khatmSummaries, memberStats, pagesPerWeek } from "@/lib/khatm";
import { khatmLabel } from "@/lib/quran";
import { formatIsoDateAz } from "@/lib/dates";
import { useGroupAssignments, useGroupFullNames } from "@/lib/useGroupData";
import { participantName } from "@/components/GroupWidgets";
import AppLayout from "@/components/AppLayout";
import { Avatar, Bar, Card, Chip, LoadingScreen, PageHeader } from "@/components/ui";

const DAY = 24 * 60 * 60 * 1000;

function daysBetween(fromIso: string, toIso: string): number {
  return Math.max(1, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / DAY));
}

export default function AnalyticsPage() {
  const { user, activeGroupId, activeGroup, isSuperAdmin } = useAuth();
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [openMember, setOpenMember] = useState<string | null>(null);
  const canSeeNames = !!user && (isSuperAdmin || activeGroup?.createdBy === user.uid);
  const fullNames = useGroupFullNames(activeGroupId, canSeeNames);
  const approvedHere = !!user && (isSuperAdmin || isUserApprovedInGroup(user, activeGroupId, activeGroup));
  const { assignments, loaded } = useGroupAssignments(activeGroupId, approvedHere);

  useEffect(() => {
    if (!user) return;
    if (!activeGroupId) {
      setUsers([]);
      setUsersLoading(false);
      return;
    }
    const membersQuery = query(collection(db, "users"), where("groupIds", "array-contains", activeGroupId));
    const unsub = onSnapshot(membersQuery, (snap) => {
      setUsers(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserDoc)));
      setUsersLoading(false);
    }, (err) => {
      console.error("Error loading members:", err);
      setUsersLoading(false);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, activeGroupId]);

  if (!user || usersLoading || (approvedHere && !loaded)) {
    return <LoadingScreen text="Analitika hazırlanır..." />;
  }

  const groupCreatedBy = activeGroup?.createdBy || null;
  const members = users.filter((u) =>
    (getUserGroupIds(u).includes(activeGroupId) || u.uid === groupCreatedBy)
    && isUserApprovedInGroup(u, activeGroupId, activeGroup)
  );
  const nameOf = (u: UserDoc) => participantName(u, user, fullNames);

  const summaries = khatmSummaries(assignments);
  const completedKhatms = summaries.filter((k) => k.completedAt);
  const totalPages = assignments.reduce((s, a) => s + a.completedPages.length, 0);
  const totalJuzDone = assignments.filter((a) => a.done).length;
  const weekly = pagesPerWeek(assignments, 12);
  const maxWeek = Math.max(1, ...weekly.map((w) => w.pages));

  // Members ranked by pages read
  const rows = members
    .map((u) => ({ user: u, stats: memberStats(assignments, u.uid) }))
    .sort((a, b) => b.stats.pagesRead - a.stats.pagesRead || nameOf(a.user).localeCompare(nameOf(b.user)));

  return (
    <AppLayout activeTab="analytics">
      <div className="flex flex-col gap-5 md:gap-7">
        <PageHeader
          title="Analitika"
          subtitle={`${activeGroup?.name || "Qrup"} · xətmlər, cüzlər və iştirakçıların oxuması`}
        />

        {/* Group totals */}
        <section aria-label="Qrup üzrə ümumi göstəricilər" className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-5">
          <Tile label="Tamamlanan xətm" value={completedKhatms.length} />
          <Tile label="Oxunan səhifə" value={totalPages} />
          <Tile label="Bitirilən cüz" value={totalJuzDone} />
          <Tile label="Bölgü sayı" value={activeGroup?.distributionCount || 0} />
        </section>

        <div className="flex flex-wrap gap-5 md:gap-7 items-start">
          <div className="flex-[999_1_560px] min-w-0 flex flex-col gap-5 md:gap-7">

            {/* Khatms */}
            <Card>
              <h2 className="m-0 text-base md:text-lg font-bold text-forest">Xətmlər</h2>
              {summaries.length === 0 ? (
                <p className="m-0 text-sm text-muted">Hələ cüz paylanmayıb.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {[...summaries].reverse().map((k) => (
                    <div key={k.khatm} className="flex flex-col gap-2 px-4 py-3.5 rounded-2xl bg-cream">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[15px] font-bold text-forest">{khatmLabel(k.khatm)}</div>
                        {k.completedAt
                          ? <Chip tone="done">Tamamlanıb</Chip>
                          : <Chip tone="progress">Davam edir</Chip>}
                      </div>
                      <Bar ratio={k.pagesRead / k.totalPages} color={k.completedAt ? "done" : "accent"} />
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                        <span>{k.pagesRead} / 604 səhifə</span>
                        <span>{k.done} / 30 cüz oxunub</span>
                        <span>{k.assigned} / 30 cüz paylanıb</span>
                        {k.startedAt && <span>Başlama: {formatIsoDateAz(k.startedAt.slice(0, 10))}</span>}
                        {k.completedAt && k.startedAt && (
                          <span>Bitmə: {formatIsoDateAz(k.completedAt.slice(0, 10))} · {daysBetween(k.startedAt, k.completedAt)} gün</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Members */}
            <Card className="!gap-2">
              <div className="flex items-center gap-2.5 pb-2">
                <h2 className="m-0 text-base md:text-lg font-bold text-forest">İştirakçılar</h2>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-sand text-muted">{rows.length} nəfər</span>
              </div>
              {rows.length === 0 ? (
                <p className="m-0 text-sm text-muted py-4">Hələ iştirakçı yoxdur.</p>
              ) : rows.map(({ user: u, stats }, index) => {
                const expanded = openMember === u.uid;
                return (
                  <div key={u.uid} className="border-t border-sand py-3.5 flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => setOpenMember(expanded ? null : u.uid)}
                      aria-expanded={expanded}
                      className="flex flex-wrap items-center gap-3 text-left w-full"
                    >
                      <span className="w-6 text-sm font-bold text-muted text-center shrink-0">{index + 1}</span>
                      <Avatar name={nameOf(u)} gold={u.uid !== user.uid} />
                      <div className="flex-[1_1_160px] min-w-0">
                        <div className="text-[15px] font-bold truncate">
                          {nameOf(u)} {u.uid === user.uid && <span className="font-medium text-muted">(sən)</span>}
                        </div>
                        <div className="text-xs text-muted">
                          {stats.open > 0 ? `${stats.open} bitməmiş cüz` : "Bitməmiş cüz yoxdur"}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center shrink-0">
                        <Mini value={stats.pagesRead} label="səhifə" />
                        <Mini value={stats.juzDone.length} label="cüz" />
                        <Mini value={stats.personalKhatms} label="xətm" />
                      </div>
                    </button>

                    {expanded && (
                      <div className="flex flex-col gap-3 pl-9">
                        <div className="text-sm">
                          <span className="font-semibold text-ink">Şəxsi xətm: </span>
                          <span className="text-muted">
                            {stats.personalKhatms} dəfə 1–30 bütün cüzləri özü bitirib.
                            {stats.juzDone.length > 0 && ` Növbəti şəxsi xətm üçün qalan cüzlər: ${stats.missingForNextPersonalKhatm.length}.`}
                          </span>
                        </div>
                        {stats.perKhatm.length > 0 && (
                          <div className="flex flex-col gap-1.5">
                            <div className="text-sm font-semibold text-ink">Xətmlər üzrə pay</div>
                            {stats.perKhatm.map((k) => (
                              <div key={k.khatm} className="flex flex-wrap justify-between gap-2 text-sm bg-cream rounded-xl px-3 py-2">
                                <span className="font-semibold text-forest">{khatmLabel(k.khatm)}</span>
                                <span className="text-muted">
                                  {k.juz.length > 0 ? `Cüz ${k.juz.join(", ")} · ` : ""}{k.juzDone} bitib · {k.pagesRead} səhifə
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {stats.juzDone.length > 0 && (
                          <div className="flex flex-col gap-1.5">
                            <div className="text-sm font-semibold text-ink">Bitirdiyi cüzlər</div>
                            <div className="flex flex-wrap gap-1.5">
                              {stats.juzDone.map((d) => (
                                <span key={`${d.khatm}-${d.juz}`} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-donebg text-done">
                                  Cüz {d.juz} · {khatmLabel(d.khatm)}{d.doneAt ? ` · ${formatIsoDateAz(d.doneAt.slice(0, 10))}` : ""}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </Card>
          </div>

          <div className="flex-[1_1_300px] min-w-0 flex flex-col gap-5 md:gap-7">
            {/* Weekly pages */}
            <Card>
              <h2 className="m-0 text-[15px] font-bold text-muted">Həftəlik oxuma (son 12 həftə)</h2>
              <div className="flex items-end gap-1.5 h-36" role="img" aria-label="Həftəlik oxunan səhifələr">
                {weekly.map((w) => (
                  <div key={w.weekStart} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                    <div className="text-[10px] text-muted">{w.pages > 0 ? w.pages : ""}</div>
                    <div
                      className="w-full rounded-t-md bg-forest"
                      style={{ height: `${(w.pages / maxWeek) * 100}%`, minHeight: w.pages > 0 ? 4 : 0 }}
                      title={`${formatIsoDateAz(w.weekStart)} həftəsi: ${w.pages} səhifə`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[11px] text-muted">
                <span>{formatIsoDateAz(weekly[0].weekStart)}</span>
                <span>bu həftə</span>
              </div>
            </Card>

            <Card>
              <h2 className="m-0 text-[15px] font-bold text-muted">Necə hesablanır?</h2>
              <ul className="m-0 pl-4 flex flex-col gap-1.5 text-sm text-muted leading-relaxed">
                <li>Xətm o xətmin 30 cüzünün hamısı oxunanda tamamlanır.</li>
                <li>Şəxsi xətm: iştirakçı 1-dən 30-a qədər bütün cüzləri (fərqli bölgülərdə olsa da) özü bitirəndə sayılır.</li>
                <li>Başqasına ötürülən cüzdə hər kəsin oxuduğu səhifələr özünə yazılır.</li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-line rounded-2xl md:rounded-card px-3 py-3.5 md:p-[22px] flex flex-col gap-1 md:gap-2">
      <div className="font-display font-bold text-[26px] md:text-[40px] leading-none text-forest">{value}</div>
      <div className="text-[11px] md:text-sm font-semibold text-muted">{label}</div>
    </div>
  );
}

function Mini({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-[52px] rounded-xl bg-cream px-2 py-1.5">
      <div className="font-display font-bold text-lg leading-none text-forest">{value}</div>
      <div className="text-[10px] text-muted mt-0.5">{label}</div>
    </div>
  );
}
