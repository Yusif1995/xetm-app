"use client";
// Conversations in the active group, one tap from the tab bar.
//  - A member sees only their own thread with the group's managers and can write to them.
//  - The group creator sees every member, newest replies first, and opens a conversation or
//    writes to many members at once.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getGroupMembers, isUserApprovedInGroup, markThreadRead, replyToManagers, type UserDoc } from "@/lib/db";
import { relativeTimeAz } from "@/lib/dates";
import { openAssignmentsOf } from "@/lib/khatm";
import { useGroupAssignments, useGroupFullNames, useGroupThreads, useThreadMessages, useThreadSummary } from "@/lib/useGroupData";
import AppLayout from "@/components/AppLayout";
import ThreadView from "@/components/ThreadView";
import { BroadcastDialog, ThreadDialog } from "@/components/MemberMessaging";
import { participantName } from "@/components/GroupWidgets";
import { Avatar, Card, LoadingScreen, PageHeader, button } from "@/components/ui";

export default function MessagesPage() {
  const { user, loading, activeGroupId, activeGroup, activeGroupLoaded } = useAuth();
  const isCreator = !!user && activeGroup?.createdBy === user.uid;
  const summary = useThreadSummary(activeGroupId, isCreator ? undefined : user?.uid);
  const { messages, loaded } = useThreadMessages(activeGroupId, user?.uid, !!user && !isCreator);

  // Opening the conversation reads it
  useEffect(() => {
    if (!user || !summary?.memberUnread) return;
    markThreadRead(activeGroupId, user.uid, "member").catch((err) => console.error("Error marking thread read:", err));
  }, [user, summary?.memberUnread, activeGroupId]);

  if (loading || !user || !activeGroupLoaded || (!isCreator && !loaded)) return <LoadingScreen text="Mesajlar yüklənir..." />;

  return (
    <AppLayout activeTab="messages">
      <div className="max-w-[720px] w-full mx-auto flex flex-col gap-5 md:gap-7">
        <PageHeader title="Mesajlar" subtitle={activeGroup?.name} />
        {isCreator ? (
          <Inbox />
        ) : (
          <Card>
            <div className="flex items-center gap-3">
              <Avatar name="Qrup rəhbəri" gold />
              <div className="min-w-0 flex flex-col">
                <span className="text-[15px] font-bold text-ink">Qrup rəhbəri</span>
                <span className="flex items-center gap-1 text-[12px] text-muted">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                    <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" />
                  </svg>
                  Yalnız sən və qrup rəhbəri görür
                </span>
              </div>
            </div>
            <ThreadView
              messages={messages}
              mySide="member"
              receipt={summary ? { unread: summary.managerUnread, readAt: summary.managerReadAt } : undefined}
              emptyText="Hələ mesaj yoxdur. Qrup rəhbərinə ilk mesajı sən yaza bilərsən."
              placeholder="Qrup rəhbərinə yaz"
              onSend={(text) => replyToManagers(activeGroupId, text)}
            />
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

// The group creator's list of conversations: unread replies first, then the latest, then members
// nobody has written to yet
function Inbox() {
  const { user, activeGroupId, activeGroup } = useAuth();
  const [members, setMembers] = useState<UserDoc[] | null>(null);
  const [open, setOpen] = useState<UserDoc | null>(null);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const threads = useGroupThreads(activeGroupId, true);
  const fullNames = useGroupFullNames(activeGroupId, true);
  const { assignments } = useGroupAssignments(activeGroupId, true);
  const closeThread = useCallback(() => setOpen(null), []);
  const closeBroadcast = useCallback(() => setBroadcastOpen(false), []);

  useEffect(() => {
    setMembers(null);
    getGroupMembers(activeGroupId).then((list) => setMembers(
      list.filter((u) => u.uid !== activeGroup?.createdBy && isUserApprovedInGroup(u, activeGroupId, activeGroup))
    ));
  }, [activeGroupId, activeGroup]);

  const nameOf = useCallback((u: UserDoc) => participantName(u, user, fullNames), [user, fullNames]);
  const rows = useMemo(() => (members || []).map((u) => ({ u, t: threads[u.uid] })).sort((a, b) =>
    Number(!!b.t?.managerUnread) - Number(!!a.t?.managerUnread) ||
    (b.t?.lastAt || "").localeCompare(a.t?.lastAt || "") ||
    nameOf(a.u).localeCompare(nameOf(b.u), "az")
  ), [members, threads, nameOf]);
  const groupName = activeGroup?.name || "Qrup";

  if (!user) return null;
  return (
    <>
      <Card className="!gap-0">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
          <h2 className="m-0 text-base md:text-lg font-bold text-ink">İştirakçılar</h2>
          <button type="button" onClick={() => setBroadcastOpen(true)} className={button("primary", "sm")} disabled={!members?.length}>
            Hamıya yaz
          </button>
        </div>
        {members === null ? (
          <p className="m-0 text-sm text-muted py-3">Yüklənir...</p>
        ) : rows.length === 0 ? (
          <p className="m-0 text-sm text-muted py-3">Qrupda hələ təsdiqlənmiş iştirakçı yoxdur.</p>
        ) : (
          <div className="flex flex-col divide-y divide-line border-t border-line">
            {rows.map(({ u, t }) => (
              <button
                key={u.uid}
                type="button"
                onClick={() => setOpen(u)}
                className="press text-left min-h-[64px] py-3 -mx-2 px-2 rounded-xl flex items-center gap-3 hover:bg-cream"
              >
                <Avatar name={nameOf(u)} gold />
                <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={`text-[15px] truncate ${t?.managerUnread ? "font-extrabold text-ink" : "font-bold text-ink"}`}>{nameOf(u)}</span>
                    {t?.lastAt && <span className="shrink-0 text-xs text-muted">{relativeTimeAz(new Date(t.lastAt).getTime())}</span>}
                  </span>
                  <span className={`text-[13px] truncate ${t?.managerUnread ? "font-semibold text-ink" : "text-muted"}`}>
                    {t ? `${t.lastFrom === "member" ? "" : "Sən: "}${t.lastText}` : "Hələ yazışma yoxdur"}
                  </span>
                </span>
                {t?.managerUnread && <span aria-label="Yeni cavab" className="shrink-0 w-2.5 h-2.5 rounded-full bg-accent" />}
              </button>
            ))}
          </div>
        )}
      </Card>
      {open && (
        <ThreadDialog
          groupId={activeGroupId}
          groupName={groupName}
          memberUid={open.uid}
          memberName={nameOf(open)}
          canRead
          summary={threads[open.uid]}
          onClose={closeThread}
        />
      )}
      {broadcastOpen && members && (
        <BroadcastDialog
          groupId={activeGroupId}
          groupName={groupName}
          members={members.map((u) => ({ uid: u.uid, name: nameOf(u), openJuz: openAssignmentsOf(assignments, u.uid).length }))}
          onClose={closeBroadcast}
        />
      )}
    </>
  );
}
