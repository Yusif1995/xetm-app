// Server-side khatm bookkeeping. Members cannot write the group's counters, so the server
// recomputes them from the members' progress after pages are marked.
import type { Firestore } from "firebase-admin/firestore";

export interface KhatmResult {
  completedPages: number;
  completedKhatms: number;
  isCurrentKhatmCompleted: boolean;
}

export async function recomputeKhatm(db: Firestore, groupId: string): Promise<KhatmResult | null> {
  const groupRef = db.collection("groups").doc(groupId);
  const membersSnap = await db.collection("users").where("groupIds", "array-contains", groupId).get();

  return db.runTransaction(async (tx) => {
    const groupSnap = await tx.get(groupRef);
    if (!groupSnap.exists) return null;
    const group = groupSnap.data() || {};
    const members = (group.members || {}) as Record<string, string>;
    const isApproved = (uid: string) =>
      uid === group.createdBy || members[uid] === "owner" || members[uid] === "member";

    // Unique pages read by approved members, counting only pages assigned to the reader
    const done = new Set<number>();
    membersSnap.docs.forEach((d) => {
      if (!isApproved(d.id)) return;
      const entry = d.data().groupData?.[groupId] || {};
      const assigned: number[] = Array.isArray(entry.assignedPages) ? entry.assignedPages : [];
      const completed: number[] = Array.isArray(entry.completedPages) ? entry.completedPages : [];
      completed.forEach((p) => {
        if (Number.isInteger(p) && p >= 1 && p <= 604 && assigned.includes(p)) done.add(p);
      });
    });

    const isCompleted = done.size === 604;
    let completedKhatms = typeof group.completedKhatms === "number" ? group.completedKhatms : 0;
    const wasCompleted = group.isCurrentKhatmCompleted === true;

    if (isCompleted && !wasCompleted) {
      completedKhatms += 1;
      tx.update(groupRef, { completedKhatms, isCurrentKhatmCompleted: true });
    } else if (!isCompleted && wasCompleted) {
      tx.update(groupRef, { isCurrentKhatmCompleted: false });
    }
    return { completedPages: done.size, completedKhatms, isCurrentKhatmCompleted: isCompleted };
  });
}
