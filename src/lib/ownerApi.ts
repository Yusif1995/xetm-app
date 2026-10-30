"use client";
// Client side of /api/owner (app owner tools). Every call is checked on the server.
import { auth } from "./firebase";

export interface OwnerAdminGroup {
  id: string;
  name: string;
  members: number;
  pending: number;
}

export interface OwnerAdmin {
  uid: string;
  nickname: string;
  name: string;
  email: string;
  isSelf: boolean;
  groups: OwnerAdminGroup[];
}

async function call<T>(body: Record<string, unknown>): Promise<{ ok: boolean; status: number; data: T }> {
  const idToken = await auth.currentUser?.getIdToken();
  const res = await fetch("/api/owner", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken || ""}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: data as T };
}

export async function isAppOwner(): Promise<boolean> {
  try {
    return (await call<{ owner?: boolean }>({ action: "check" })).data.owner === true;
  } catch {
    return false;
  }
}

export interface OwnerUser {
  uid: string;
  nickname: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

export const listAdmins = () => call<{ admins?: OwnerAdmin[]; error?: string }>({ action: "list" });
export const listUsers = () => call<{ users?: OwnerUser[]; error?: string }>({ action: "users" });
export const grantAdmin = (uid: string) => call<{ error?: string }>({ action: "grant", uid });
export const revokeAdmin = (uid: string) => call<{ error?: string }>({ action: "revoke", uid });
export const deleteGroupAsOwner = (groupId: string) => call<{ error?: string }>({ action: "deleteGroup", groupId });

export interface OwnerGroup {
  id: string;
  name: string;
}

export interface OwnerThread {
  memberUid: string;
  name: string;
  lastText: string;
  lastAt: string;
  lastFrom: "manager" | "member";
}

export interface OwnerThreadMessage {
  id: string;
  from: "manager" | "member";
  sender: string;
  text: string;
  sentAt: string;
}

export const listAllGroups = () => call<{ groups?: OwnerGroup[]; error?: string }>({ action: "groups" });
export const listThreads = (groupId: string) => call<{ threads?: OwnerThread[]; error?: string }>({ action: "threads", groupId });
export const getThread = (groupId: string, memberUid: string) => call<{ messages?: OwnerThreadMessage[]; error?: string }>({ action: "thread", groupId, memberUid });
