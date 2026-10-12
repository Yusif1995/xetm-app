// Server-side khatm bookkeeping. Members cannot write the group's counters, so the server
// recomputes them from the juz assignments after pages are marked.
import type { Firestore } from "firebase-admin/firestore";
import { khatmSummaries, type Assignment } from "./khatm.ts";

export interface KhatmResult {
  completedKhatms: number;
  khatmCompletedAt: Record<string, string>;
}

export async function recomputeKhatm(db: Firestore, groupId: string): Promise<KhatmResult | null> {
  const groupRef = db.collection("groups").doc(groupId);
  const assignmentsSnap = await groupRef.collection("assignments").get();
  const assignments = assignmentsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Assignment));

  const summaries = khatmSummaries(assignments);
  const khatmCompletedAt: Record<string, string> = {};
  summaries.forEach((s) => {
    if (s.completedAt) khatmCompletedAt[String(s.khatm)] = s.completedAt;
  });
  const completedKhatms = Object.keys(khatmCompletedAt).length;

  return db.runTransaction(async (tx) => {
    const groupSnap = await tx.get(groupRef);
    if (!groupSnap.exists) return null;
    tx.update(groupRef, {
      completedKhatms,
      khatmCompletedAt,
      isCurrentKhatmCompleted: completedKhatms > 0 && summaries.every((s) => !!s.completedAt),
    });
    return { completedKhatms, khatmCompletedAt };
  });
}
