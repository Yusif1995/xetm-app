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

export const listAdmins = () => call<{ admins?: OwnerAdmin[]; error?: string }>({ action: "list" });
export const revokeAdmin = (uid: string) => call<{ error?: string }>({ action: "revoke", uid });
export const deleteGroupAsOwner = (groupId: string) => call<{ error?: string }>({ action: "deleteGroup", groupId });
