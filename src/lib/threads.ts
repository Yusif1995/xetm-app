// Conversations between a group's managers and each member: groups/{gid}/threads/{memberUid} holds
// a summary (last message, unread flags) and threads/{memberUid}/messages the history. The member,
// the group creator and (through /api/owner) the app owner can read a thread; other members and
// other app admins cannot. All writes go through /api/group-message.

export type ThreadSide = "manager" | "member";

export interface ThreadSummary {
  lastText: string;
  lastAt: string;          // ISO
  lastFrom: ThreadSide;
  memberUnread: boolean;   // a manager wrote and the member has not opened the thread since
  managerUnread: boolean;  // the member replied and the group creator has not opened it since
}

export interface ThreadMessage {
  id: string;
  from: ThreadSide;
  senderUid: string;
  text: string;
  sentAt: string;          // ISO
}

export const MAX_THREAD_MESSAGE_LENGTH = 1000;

// A broadcast reaches at most this many members in one request
export const MAX_BROADCAST_TARGETS = 300;
