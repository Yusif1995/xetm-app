"use client";
// Conversations of a group (see src/lib/threads.ts for the kinds and who may do what).
//  - Member: their bulk conversation ("Toplu mesajlar", answered by the leader), the leader, and the
//    app owner if the owner wrote to them.
//  - Leader, group admins and the app owner get two tabs: "Şəxsi" (the leader with members, admins
//    with the leader and the owner, the owner privately with anyone) and "Toplu mesajlar" (send to
//    many, every reply; only the leader answers).
// Your own conversations update live; the ones only the server may show you refresh every few seconds.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  loadConversation, loadInbox, markConversationRead, sendMessage,
  type Inbox, type InboxSummary,
} from "@/lib/db";
import { relativeTimeAz } from "@/lib/dates";
import { isAppOwner, listAllGroups, type OwnerGroup } from "@/lib/ownerApi";
import type { ConversationKind, ThreadMessage, ThreadSummary } from "@/lib/threads";
import { useGroupThreads, useThreadMessages, useThreadSummary } from "@/lib/useGroupData";
import AppLayout from "@/components/AppLayout";
import ThreadView from "@/components/ThreadView";
import { BroadcastDialog, Dialog } from "@/components/MemberMessaging";
import { Avatar, Card, LoadingScreen, PageHeader, button, inputCls } from "@/components/ui";

const INBOX_REFRESH_MS = 20000;
const CONVERSATION_REFRESH_MS = 6000;
const LOCKED_REPLY = "Cavabı yalnız qrup rəhbəri yaza bilər. Sən oxuya bilərsən.";

type Tone = "owner" | "admin" | "leader" | "member" | "bulk";

interface Row {
  id: string;
  kind: ConversationKind;
  key: string;                  // the member / person the conversation belongs to
  title: string;
  tag?: string;                 // "Admin", "Qrup rəhbəri"
  tone: Tone;
  mySide: "manager" | "member";
  summary: ThreadSummary | null;
  live: boolean;                // readable from Firestore by the caller (else through the API)
  sendTo?: string;              // the person written to, when the caller is the manager side
  canSend: boolean;
  locked?: string;
  subtitle?: string;            // privacy note under the title
}

export default function MessagesPage() {
  const { user, loading, activeGroupId, activeGroupLoaded } = useAuth();
  const [owner, setOwner] = useState<boolean | null>(null);
  const [groups, setGroups] = useState<OwnerGroup[] | null>(null);
  const [groupId, setGroupId] = useState("");

  useEffect(() => {
    if (!user) return;
    isAppOwner().then((o) => {
      setOwner(o);
      if (o) listAllGroups().then((res) => setGroups(res.ok && res.data.groups ? res.data.groups : []));
    });
  }, [user]);

  useEffect(() => {
    if (activeGroupId && activeGroupId !== "default") setGroupId((g) => g || activeGroupId);
  }, [activeGroupId]);

  useEffect(() => {
    if (owner && groups && !groupId && groups[0]) setGroupId(groups[0].id);
  }, [owner, groups, groupId]);

  if (loading || !user || !activeGroupLoaded || owner === null) return <LoadingScreen text="Mesajlar yüklənir..." />;

  return (
    <AppLayout activeTab="messages">
      <div className="max-w-[720px] w-full mx-auto flex flex-col gap-5 md:gap-7">
        <PageHeader title="Mesajlar" />
        {owner && groups && groups.length > 0 && (
          <label className="flex flex-col gap-2 text-sm font-semibold text-ink -mt-2">
            <span className="sr-only">Qrup</span>
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={`${inputCls} font-semibold`}>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </label>
        )}
        {groupId ? <GroupMessages key={groupId} groupId={groupId} /> : (
          <Card><p className="m-0 text-sm text-muted">Hələ qrupun yoxdur. Qrupa qoşulandan sonra mesajlar burada görünəcək.</p></Card>
        )}
      </div>
    </AppLayout>
  );
}

function GroupMessages({ groupId }: { groupId: string }) {
  const { user } = useAuth();
  const uid = user?.uid || "";
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"bulk" | "private">("private");
  const [open, setOpen] = useState<string | null>(null);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const closePicker = useCallback(() => setPickerOpen(false), []);

  const refresh = useCallback(() => loadInbox(groupId).then((x) => { setInbox(x); setError(null); }).catch((e) => setError(e.message)), [groupId]);
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, INBOX_REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const role = inbox?.role;
  const isMember = !!role?.member;
  const isCreator = !!role?.creator;
  const isManager = !!role && (role.creator || role.admin || role.owner);
  const ownerOutside = !!role?.owner && !role.creator && !role.member;

  // Live summaries of the caller's own conversations, and the leader's threads with members
  const myBulk = useThreadSummary(groupId, isMember ? uid : undefined, "broadcasts");
  const myLeader = useThreadSummary(groupId, isMember ? uid : undefined, "threads");
  const myOwnerChat = useThreadSummary(groupId, role && !role.owner ? uid : undefined, "ownerChats");
  const leaderThreads = useGroupThreads(groupId, isCreator);

  const rows = useMemo<{ bulk: Row[]; private: Row[] }>(() => {
    if (!inbox || !role) return { bulk: [], private: [] };
    const nameOf = (u: string) => inbox.members?.find((m) => m.uid === u)?.name || (inbox.leader?.uid === u ? inbox.leader.name : "İştirakçı");
    const isAdmin = (u: string) => !!inbox.members?.find((m) => m.uid === u)?.admin;
    const priv: Row[] = [];

    if (isMember) {
      if (myBulk) priv.push({
        id: "my-bulk", kind: "broadcast", key: uid, title: "Toplu mesajlar", tone: "bulk", mySide: "member",
        summary: myBulk, live: true, canSend: true, subtitle: "Cavabını qrup rəhbəri verir",
      });
      if (inbox.leader) priv.push({
        id: "my-leader", kind: "thread", key: uid, title: inbox.leader.name, tag: "Qrup rəhbəri", tone: "leader", mySide: "member",
        summary: myLeader, live: true, canSend: true, subtitle: `Yalnız sən və ${inbox.leader.name} görür`,
      });
    }
    // The owner, for everyone else: the leader and group admins may write first, a member answers
    if (inbox.ownerContact && (myOwnerChat || role.creator || role.admin)) priv.push({
      id: "my-owner", kind: "ownerChat", key: uid, title: inbox.ownerContact.name, tag: "Admin", tone: "owner", mySide: "member",
      summary: myOwnerChat, live: true, canSend: true, subtitle: `Yalnız sən və ${inbox.ownerContact.name} görür`,
    });
    if (isCreator) {
      for (const m of inbox.members || []) priv.push({
        id: `thread-${m.uid}`, kind: "thread", key: m.uid, title: m.name, tag: m.admin ? "Admin" : undefined, tone: m.admin ? "admin" : "member",
        mySide: "manager", summary: leaderThreads[m.uid] || null, live: true, sendTo: m.uid, canSend: true,
        subtitle: `Yalnız sən və ${m.name} görür`,
      });
    }
    if (role.owner && !isCreator) {
      const chats = new Map((inbox.ownerChats || []).map((c) => [c.uid, c]));
      const people = [
        ...(ownerOutside && inbox.leader ? [{ uid: inbox.leader.uid, name: inbox.leader.name, leader: true }] : []),
        ...(inbox.members || []).filter((m) => m.uid !== uid).map((m) => ({ uid: m.uid, name: m.name, leader: false })),
      ];
      for (const p of people) priv.push({
        id: `owner-${p.uid}`, kind: "ownerChat", key: p.uid, title: p.name,
        tag: p.leader ? "Qrup rəhbəri" : isAdmin(p.uid) ? "Admin" : undefined,
        tone: p.leader ? "leader" : isAdmin(p.uid) ? "admin" : "member",
        mySide: "manager", summary: chats.get(p.uid) || null, live: false, sendTo: p.uid, canSend: true,
        subtitle: `Yalnız sən və ${p.name} görür`,
      });
    }

    const bulk: Row[] = (inbox.bulk || []).filter((b) => b.uid !== uid).map((b: InboxSummary) => ({
      id: `bulk-${b.uid}`, kind: "broadcast", key: b.uid, title: b.name || nameOf(b.uid), tone: "member", mySide: "manager",
      summary: b, live: isCreator, sendTo: isCreator ? b.uid : undefined, canSend: isCreator,
      locked: isCreator ? undefined : LOCKED_REPLY, subtitle: "Toplu mesajlara cavab",
    }));
    return { bulk, private: sortRows(priv) };
  }, [inbox, role, isMember, isCreator, ownerOutside, myBulk, myLeader, myOwnerChat, leaderThreads, uid]);

  const openRow = [...rows.bulk, ...rows.private].find((r) => r.id === open) || null;
  const closeBroadcast = useCallback(() => { setBroadcastOpen(false); refresh(); }, [refresh]);

  if (!inbox) {
    return error
      ? <Card><p role="alert" className="m-0 text-sm font-semibold text-danger">{error}</p></Card>
      : <Card><p className="m-0 text-sm text-muted">Yüklənir...</p></Card>;
  }

  if (openRow) {
    return <Conversation groupId={groupId} row={openRow} onBack={() => { setOpen(null); refresh(); }} onSent={refresh} />;
  }

  const unread = (list: Row[]) => list.some((r) => isUnread(r));

  return (
    <>
      {isManager && (
        <div role="tablist" aria-label="Mesajlar" className="grid grid-cols-2 gap-1 p-1 rounded-[14px] bg-sand">
          {([["private", "Şəxsi", unread(rows.private)], ["bulk", "Toplu mesajlar", unread(rows.bulk)]] as const).map(([v, label, dot]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={tab === v}
              onClick={() => setTab(v)}
              className={`press relative min-h-[44px] px-3 rounded-[11px] text-[14px] ${tab === v ? "bg-white text-forest font-extrabold shadow-card" : "text-muted font-bold"}`}
            >
              {label}
              {dot && <span aria-label="yeni" className="absolute top-2.5 right-3 w-2 h-2 rounded-full bg-accent" />}
            </button>
          ))}
        </div>
      )}

      {isManager && tab === "bulk" ? (
        <Card className="!gap-0">
          <button type="button" onClick={() => setBroadcastOpen(true)} className={`${button("primary")} w-full`} disabled={!inbox.members?.length}>
            Toplu mesaj göndər
          </button>
          {(inbox.feed || []).length > 0 && (
            <div className="flex flex-col gap-2 pt-4">
              {inbox.feed!.slice(0, 5).map((f) => (
                <div key={f.id} className="rounded-[14px] bg-vellum border border-line border-l-[3px] border-l-leaf px-3.5 py-2.5">
                  <div className="flex items-baseline justify-between gap-2 text-[12px]">
                    <span className="font-bold text-goldtext truncate">{f.senderLabel}</span>
                    <span className="shrink-0 text-muted">{relativeTimeAz(new Date(f.sentAt).getTime())}</span>
                  </div>
                  <p className="m-0 mt-0.5 text-[14px] text-ink whitespace-pre-line break-words line-clamp-3">{f.text}</p>
                  <div className="mt-1 text-[12px] text-muted">{f.count} nəfərə</div>
                </div>
              ))}
            </div>
          )}
          <h2 className="m-0 pt-5 pb-2 text-[13px] font-bold text-muted">İştirakçıların cavabları</h2>
          <RowList rows={rows.bulk} empty="Hələ cavab yoxdur." onOpen={setOpen} />
          {!isCreator && <p className="m-0 pt-3 text-[12px] text-muted">Cavablara yalnız qrup rəhbəri cavab yazır. Sən hamısını oxuya bilərsən.</p>}
        </Card>
      ) : (
        <Card className="!gap-0">
          <div className="flex items-center justify-between gap-3 pb-2">
            <h2 className="m-0 text-base font-bold text-ink">Söhbətlər</h2>
            <button type="button" onClick={() => setPickerOpen(true)} className={button("primary", "sm")} disabled={!rows.private.some((r) => r.canSend)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              Yeni mesaj
            </button>
          </div>
          <PrivateRows rows={rows.private.filter(hasChat)} onOpen={setOpen} empty="Hələ yazışma yoxdur. Yazmaq üçün “Yeni mesaj” düyməsinə toxun." />
        </Card>
      )}

      {pickerOpen && (
        <ContactPicker
          rows={rows.private.filter((r) => r.canSend && r.tone !== "bulk")}
          onPick={(id) => { setPickerOpen(false); setOpen(id); }}
          onClose={closePicker}
        />
      )}
      {broadcastOpen && (
        <BroadcastDialog
          groupId={groupId}
          groupName={inbox.groupName}
          members={(inbox.members || []).filter((m) => m.uid !== uid).map((m) => ({ uid: m.uid, name: m.name, openJuz: m.openJuz || 0 }))}
          onClose={closeBroadcast}
        />
      )}
    </>
  );
}

// Only conversations with at least one message are listed, as in a messenger
const hasChat = (r: Row) => !!r.summary?.lastAt;

// "Yeni mesaj": everyone the caller may write to, searchable, staff first; picking one opens the
// conversation, and it joins the list once the first message is sent
function ContactPicker({ rows, onPick, onClose }: { rows: Row[]; onPick: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLocaleLowerCase("az");
  const shown = rows
    .filter((r) => !needle || r.title.toLocaleLowerCase("az").includes(needle))
    .sort((a, b) => a.title.localeCompare(b.title, "az"));
  const staff = shown.filter((r) => r.tone !== "member");
  const members = shown.filter((r) => r.tone === "member");
  const list = (items: Row[]) => (
    <div className="flex flex-col divide-y divide-line">
      {items.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => onPick(r.id)}
          className="press text-left min-h-[56px] py-2.5 -mx-2 px-2 rounded-xl flex items-center gap-3 hover:bg-cream"
        >
          <RowAvatar row={r} />
          <span className="flex-1 min-w-0 text-[15px] font-bold text-ink truncate">{r.title}{r.tag && <Tag text={r.tag} tone={r.tone} />}</span>
          {hasChat(r) && <span className="shrink-0 text-xs text-muted">söhbət var</span>}
        </button>
      ))}
    </div>
  );
  return (
    <Dialog title="Yeni mesaj" subtitle="Kimə yazmaq istəyirsən?" onClose={onClose}>
      <label className="sr-only" htmlFor="contact-search">Ad ilə axtar</label>
      <input
        id="contact-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Ad ilə axtar"
        className={`${inputCls} text-[16px]`}
      />
      {shown.length === 0 ? (
        <p className="m-0 text-sm text-muted py-2">Heç kim tapılmadı.</p>
      ) : (
        <div className="flex flex-col">
          {staff.length > 0 && <><h3 className="m-0 pb-1 text-[13px] font-bold text-muted">Rəhbər və adminlər</h3>{list(staff)}</>}
          {members.length > 0 && <><h3 className={`m-0 pb-1 text-[13px] font-bold text-muted ${staff.length ? "pt-4" : ""}`}>İştirakçılar</h3>{list(members)}</>}
        </div>
      )}
    </Dialog>
  );
}

const isUnread = (r: Row) => !!r.summary && (r.mySide === "member" ? r.summary.memberUnread : r.summary.managerUnread && r.canSend);

function sortRows(rows: Row[]): Row[] {
  return rows.slice().sort((a, b) =>
    Number(isUnread(b)) - Number(isUnread(a)) ||
    (b.summary?.lastAt || "").localeCompare(a.summary?.lastAt || "") ||
    a.title.localeCompare(b.title, "az")
  );
}

const TONE: Record<Tone, string> = {
  owner: "bg-ink text-gold",
  admin: "bg-donebg text-lapis",
  leader: "bg-mint text-forest",
  member: "bg-progress text-goldtext",
  bulk: "bg-vellum text-leaf border border-leaf",
};

function RowAvatar({ row }: { row: Row }) {
  if (row.tone === "member") return <Avatar name={row.title} gold />;
  return (
    <div className={`w-10 h-10 rounded-full grid place-items-center font-bold text-sm shrink-0 ${TONE[row.tone]}`}>
      {row.tone === "bulk" ? "✦" : row.title.trim().charAt(0).toLocaleUpperCase("az")}
    </div>
  );
}

function Tag({ text, tone }: { text: string; tone: Tone }) {
  return <span className={`ml-1.5 px-1.5 py-px rounded-md text-[11px] font-bold align-[1px] ${TONE[tone]}`}>{text}</span>;
}

function RowList({ rows, empty, onOpen }: { rows: Row[]; empty: string; onOpen: (id: string) => void }) {
  if (rows.length === 0) return <p className="m-0 text-sm text-muted py-3">{empty}</p>;
  return (
    <div className="flex flex-col divide-y divide-line">
      {rows.map((r) => {
        const s = r.summary;
        const unread = isUnread(r);
        const preview = s?.lastAt ? `${s.lastFrom === r.mySide ? "Sən: " : ""}${s.lastText}` : "Hələ yazışma yoxdur";
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onOpen(r.id)}
            className="press text-left min-h-[64px] py-3 -mx-2 px-2 rounded-xl flex items-center gap-3 hover:bg-cream"
          >
            <RowAvatar row={r} />
            <span className="flex-1 min-w-0 flex flex-col gap-0.5">
              <span className="flex items-baseline justify-between gap-2">
                <span className={`text-[15px] text-ink truncate ${unread ? "font-extrabold" : "font-bold"}`}>
                  {r.title}{r.tag && <Tag text={r.tag} tone={r.tone} />}
                </span>
                {s?.lastAt && <span className="shrink-0 text-xs text-muted">{relativeTimeAz(new Date(s.lastAt).getTime())}</span>}
              </span>
              <span className={`text-[13px] truncate ${unread ? "font-semibold text-ink" : "text-muted"}`}>{preview}</span>
            </span>
            {unread && <span aria-label="Yeni mesaj" className="shrink-0 w-2.5 h-2.5 rounded-full bg-accent" />}
          </button>
        );
      })}
    </div>
  );
}

// The private list split in two: the leader, the owner and admins first, then members. The
// member's own bulk conversation stays on top without a heading.
function PrivateRows({ rows, onOpen, empty }: { rows: Row[]; onOpen: (id: string) => void; empty: string }) {
  const bulk = rows.filter((r) => r.tone === "bulk");
  const staff = rows.filter((r) => r.tone === "leader" || r.tone === "owner" || r.tone === "admin");
  const members = rows.filter((r) => r.tone === "member");
  if (rows.length === 0) return <RowList rows={rows} empty={empty} onOpen={onOpen} />;
  // Private chats first, the bulk conversation after them
  return (
    <>
      {staff.length > 0 && (
        <>
          <h2 className="m-0 pb-1 text-[13px] font-bold text-muted">Rəhbər və adminlər</h2>
          <RowList rows={staff} empty="" onOpen={onOpen} />
        </>
      )}
      {members.length > 0 && (
        <>
          <h2 className={`m-0 pb-1 text-[13px] font-bold text-muted ${staff.length ? "pt-4" : ""}`}>İştirakçılar</h2>
          <RowList rows={members} empty="" onOpen={onOpen} />
        </>
      )}
      {bulk.length > 0 && (
        <>
          {(staff.length > 0 || members.length > 0) && <h2 className="m-0 pt-4 pb-1 text-[13px] font-bold text-muted">Toplu mesajlar</h2>}
          <RowList rows={bulk} empty="" onOpen={onOpen} />
        </>
      )}
    </>
  );
}

const COL: Record<ConversationKind, "threads" | "broadcasts" | "ownerChats"> = { thread: "threads", broadcast: "broadcasts", ownerChat: "ownerChats" };

function Conversation({ groupId, row, onBack, onSent }: { groupId: string; row: Row; onBack: () => void; onSent: () => void }) {
  const live = useThreadMessages(groupId, row.key, row.live, COL[row.kind]);
  const liveSummary = useThreadSummary(groupId, row.live ? row.key : undefined, COL[row.kind]);
  const [polled, setPolled] = useState<{ summary: ThreadSummary | null; messages: ThreadMessage[] } | null>(null);

  const load = useCallback(() => loadConversation(groupId, row.kind, row.key).then(setPolled).catch(() => {}), [groupId, row.kind, row.key]);
  useEffect(() => {
    if (row.live) return;
    load();
    const timer = setInterval(load, CONVERSATION_REFRESH_MS);
    return () => clearInterval(timer);
  }, [row.live, load]);

  const summary = row.live ? liveSummary : polled?.summary ?? row.summary;
  const messages = row.live ? live.messages : polled?.messages || [];
  const loaded = row.live ? live.loaded : !!polled;

  // Opening it reads it, for the side that answers
  const myUnread = summary ? (row.mySide === "member" ? summary.memberUnread : summary.managerUnread) : false;
  useEffect(() => {
    if (!myUnread || !row.canSend) return;
    markConversationRead(groupId, row.kind, row.key).catch((err) => console.error("Error marking read:", err));
  }, [myUnread, row.canSend, groupId, row.kind, row.key]);

  const receipt = summary
    ? row.mySide === "manager"
      ? { unread: summary.memberUnread, readAt: summary.memberReadAt }
      : { unread: summary.managerUnread, readAt: summary.managerReadAt }
    : undefined;

  const send = async (text: string) => {
    await sendMessage(groupId, row.kind, text, row.sendTo);
    if (!row.live) await load();
    onSent();
  };

  return (
    <Card>
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} aria-label="Geri" className="press shrink-0 w-11 h-11 -ml-2 rounded-full grid place-items-center text-ink hover:bg-sand">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <RowAvatar row={row} />
        <div className="min-w-0 flex flex-col">
          <span className="text-[15px] font-bold text-ink truncate">{row.title}{row.tag && <Tag text={row.tag} tone={row.tone} />}</span>
          {row.subtitle && <span className="text-[12px] text-muted truncate">{row.subtitle}</span>}
        </div>
      </div>
      {loaded ? (
        <ThreadView
          messages={messages}
          mySide={row.mySide}
          receipt={row.canSend ? receipt : undefined}
          labels={row.kind === "broadcast"}
          locked={row.locked}
          emptyText="Hələ yazışma yoxdur. İlk mesajı yaz."
          placeholder="Mesaj yaz"
          onSend={row.canSend ? send : undefined}
        />
      ) : (
        <p className="m-0 text-sm text-muted">Yüklənir...</p>
      )}
    </Card>
  );
}
