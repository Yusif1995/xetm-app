"use client";

// Live group sub-collections: full names (owner only), manager <-> member threads, the archive
import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "./firebase";
import { assignmentsCol, messageDocRef, type GroupMessage } from "./db";
import type { Assignment } from "./khatm.ts";
import type { ThreadMessage, ThreadSummary } from "./threads";
import type { ArchiveEntry } from "./archive";

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

// Thread summaries of every member of the group, keyed by member uid (group creator only)
export function useGroupThreads(groupId: string, enabled: boolean): Record<string, ThreadSummary> {
  const [threads, setThreads] = useState<Record<string, ThreadSummary>>({});
  useEffect(() => {
    setThreads({});
    if (!enabled || !groupId || groupId === "default") return;
    const unsub = onSnapshot(collection(db, "groups", groupId, "threads"), (snap) => {
      const map: Record<string, ThreadSummary> = {};
      snap.forEach((d) => { map[d.id] = d.data() as ThreadSummary; });
      setThreads(map);
    }, (err) => console.error("Error loading threads:", err));
    return () => unsub();
  }, [groupId, enabled]);
  return threads;
}

// One member's thread summary (the member themselves or the group creator)
export function useThreadSummary(groupId: string, memberUid: string | undefined): ThreadSummary | null {
  const [summary, setSummary] = useState<ThreadSummary | null>(null);
  useEffect(() => {
    setSummary(null);
    if (!memberUid || !groupId || groupId === "default") return;
    const unsub = onSnapshot(doc(db, "groups", groupId, "threads", memberUid), (snap) => {
      setSummary(snap.exists() ? (snap.data() as ThreadSummary) : null);
    }, (err) => console.error("Error loading thread:", err));
    return () => unsub();
  }, [groupId, memberUid]);
  return summary;
}

// The messages of one member's thread, oldest first
export function useThreadMessages(groupId: string, memberUid: string | undefined, enabled = true): { messages: ThreadMessage[]; loaded: boolean } {
  const [state, setState] = useState<{ messages: ThreadMessage[]; loaded: boolean }>({ messages: [], loaded: false });
  useEffect(() => {
    setState({ messages: [], loaded: false });
    if (!enabled || !memberUid || !groupId || groupId === "default") {
      setState({ messages: [], loaded: true });
      return;
    }
    const q = query(collection(db, "groups", groupId, "threads", memberUid, "messages"), orderBy("sentAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setState({ messages: snap.docs.map((d) => ({ id: d.id, ...d.data() } as ThreadMessage)), loaded: true });
    }, (err) => {
      console.error("Error loading thread messages:", err);
      setState({ messages: [], loaded: true });
    });
    return () => unsub();
  }, [groupId, memberUid, enabled]);
  return state;
}

// Archived khatms and distributions of the group (group managers only)
export function useGroupArchive(groupId: string, enabled: boolean): { entries: ArchiveEntry[]; loaded: boolean } {
  const [state, setState] = useState<{ entries: ArchiveEntry[]; loaded: boolean }>({ entries: [], loaded: false });
  useEffect(() => {
    setState({ entries: [], loaded: false });
    if (!enabled || !groupId || groupId === "default") {
      setState({ entries: [], loaded: true });
      return;
    }
    const unsub = onSnapshot(collection(db, "groups", groupId, "archive"), (snap) => {
      setState({ entries: snap.docs.map((d) => d.data() as ArchiveEntry), loaded: true });
    }, (err) => {
      console.error("Error loading archive:", err);
      setState({ entries: [], loaded: true });
    });
    return () => unsub();
  }, [groupId, enabled]);
  return state;
}

// The signed-in member's own (legacy, single) message from the group owner
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
