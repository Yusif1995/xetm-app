"use client";

// Live group sub-collections: full names (owner only) and owner -> member messages
import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { assignmentsCol, messageDocRef, type GroupMessage } from "./db";
import type { Assignment } from "./khatm.ts";

// Full names of the group's members; only the group owner (or a super admin) may read them
export function useGroupFullNames(groupId: string, enabled: boolean): Record<string, string> {
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    setNames({});
    if (!enabled || !groupId || groupId === "default") return;
    const unsub = onSnapshot(collection(db, "groups", groupId, "profiles"), (snap) => {
      const map: Record<string, string> = {};
      snap.forEach((d) => {
        const name = d.data().name;
        if (typeof name === "string" && name) map[d.id] = name;
      });
      setNames(map);
    }, (err) => console.error("Error loading member names:", err));
    return () => unsub();
  }, [groupId, enabled]);
  return names;
}

// Messages the owner sent to members of the group, keyed by member uid (owner only)
export function useGroupMessages(groupId: string, enabled: boolean): Record<string, GroupMessage> {
  const [messages, setMessages] = useState<Record<string, GroupMessage>>({});
  useEffect(() => {
    setMessages({});
    if (!enabled || !groupId || groupId === "default") return;
    const unsub = onSnapshot(collection(db, "groups", groupId, "messages"), (snap) => {
      const map: Record<string, GroupMessage> = {};
      snap.forEach((d) => { map[d.id] = d.data() as GroupMessage; });
      setMessages(map);
    }, (err) => console.error("Error loading messages:", err));
    return () => unsub();
  }, [groupId, enabled]);
  return messages;
}

// The signed-in member's own message from the group owner
export function useMyGroupMessage(groupId: string, uid: string | undefined): GroupMessage | null {
  const [message, setMessage] = useState<GroupMessage | null>(null);
  useEffect(() => {
    setMessage(null);
    if (!uid || !groupId || groupId === "default") return;
    const unsub = onSnapshot(messageDocRef(groupId, uid), (snap) => {
      setMessage(snap.exists() ? (snap.data() as GroupMessage) : null);
    }, (err) => console.error("Error loading my message:", err));
    return () => unsub();
  }, [groupId, uid]);
  return message;
}

// Live juz assignments of the group (approved members only)
export function useGroupAssignments(groupId: string, enabled: boolean): { assignments: Assignment[]; loaded: boolean } {
  const [state, setState] = useState<{ assignments: Assignment[]; loaded: boolean }>({ assignments: [], loaded: false });
  useEffect(() => {
    setState({ assignments: [], loaded: false });
    if (!enabled || !groupId || groupId === "default") {
      setState({ assignments: [], loaded: true });
      return;
    }
    const unsub = onSnapshot(assignmentsCol(groupId), (snap) => {
      setState({ assignments: snap.docs.map((d) => ({ id: d.id, ...d.data() } as Assignment)), loaded: true });
    }, (err) => {
      console.error("Error loading assignments:", err);
      setState({ assignments: [], loaded: true });
    });
    return () => unsub();
  }, [groupId, enabled]);
  return state;
}

// Members of the group who are app admins (admins/{uid}); asked from the server, which only
// answers approved members and only names admins inside this group
export function useGroupAdmins(groupId: string, enabled: boolean): string[] {
  const [adminUids, setAdminUids] = useState<string[]>([]);
  useEffect(() => {
    setAdminUids([]);
    if (!enabled || !groupId || groupId === "default") return;
    let cancelled = false;
    (async () => {
      try {
        const { auth } = await import("./firebase");
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) return;
        const res = await fetch("/api/group-admins", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ groupId }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.adminUids)) setAdminUids(data.adminUids);
      } catch (err) {
        console.error("Could not load group admins:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId, enabled]);
  return adminUids;
}
