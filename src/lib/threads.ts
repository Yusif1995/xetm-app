// Conversations in a group. Three kinds, all with the same shape: a summary doc (last message,
// unread flags, read times) and a messages sub-collection. All writes go through /api/messages.
//
//  - threads/{memberUid}     the group leader (creator) <-> one member. "manager" = the leader.
//                            Read: the member, the leader; the app owner from Sistem idarəsi.
//  - broadcasts/{memberUid}  bulk messages to one member from the leader, the group's admins or the
//                            app owner, the member's replies, and the leader's answers.
//                            "manager" = whoever sent the bulk message or the leader answering.
//                            Read: the member, the leader (rules); group admins and the owner
//                            through the API. Only the leader answers replies.
//  - ownerChats/{uid}        the app owner <-> one person of the group (member, leader or admin),
//                            seen only by those two. "manager" = the owner.
//  - broadcastLog/{id}       every bulk message once, for the "Toplu mesajlar" feed (API only).

export type ThreadSide = "manager" | "member";
export type ConversationKind = "thread" | "broadcast" | "ownerChat";

export const KIND_COLLECTION: Record<ConversationKind, string> = {
  thread: "threads",
  broadcast: "broadcasts",
  ownerChat: "ownerChats",
};

export interface ThreadSummary {
  lastText: string;
  lastAt: string;          // ISO
  lastFrom: ThreadSide;
  memberUnread: boolean;   // the manager side wrote and the member has not opened it since
  managerUnread: boolean;  // the member wrote and the manager side has not opened it since
  memberReadAt?: string;   // ISO, when the member last opened it with unread messages
  managerReadAt?: string;  // ISO, the same for the manager side
}

export interface ThreadMessage {
  id: string;
  from: ThreadSide;
  senderUid: string;
  senderLabel?: string;    // "Yusif · Admin", "Rəşad · Qrup rəhbəri"; older messages have none
  text: string;
  sentAt: string;          // ISO
}

export const MAX_THREAD_MESSAGE_LENGTH = 1000;

// A broadcast reaches at most this many members in one request
export const MAX_BROADCAST_TARGETS = 300;
