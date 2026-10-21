import { NextRequest, NextResponse } from "next/server";
import { verifyRequestUser, isRateLimited } from "@/lib/serverAuth";
import { ensureVapidConfigured, sendToSubscriptions } from "@/lib/pushServer";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { getGroupInfo, getPushSubscriptions, isApprovedMember, removePushSubscriptions } from "@/lib/privateData";
import { khatmLabel } from "@/lib/quran";

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_IDS = 120;
// Same rule the distribution uses: a member with this many unfinished juz gets no new one
const MAX_OPEN_ASSIGNMENTS = 2;

interface StoredAssignment {
  uid: string;
  khatm: number;
  juz: number;
  pages: number[];
}

// Members a distribution skipped also hear why, so they know to finish their juz first.
// After the owner hands out juz, tells every holder which juz they got:
// "Bismillah · Sizin üçün Cüz 7 təyin edildi". The text is built here from the stored
// assignments, so the caller cannot push arbitrary text; only the group owner or an app admin may call it.
export async function POST(req: NextRequest) {
  try {
    const uid = await verifyRequestUser(req);
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (isRateLimited(`assign-notify:${uid}`, 30, 10 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { groupId, assignmentIds, skippedUids = [] } = await req.json();
    if (
      typeof groupId !== "string" || !ID_PATTERN.test(groupId) ||
      !Array.isArray(assignmentIds) || assignmentIds.length > MAX_IDS ||
      !assignmentIds.every((id) => typeof id === "string" && ID_PATTERN.test(id)) ||
      !Array.isArray(skippedUids) || skippedUids.length > MAX_IDS ||
      !skippedUids.every((id) => typeof id === "string" && ID_PATTERN.test(id)) ||
      assignmentIds.length + skippedUids.length === 0
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server is not configured" }, { status: 500 });
    }

    const group = await getGroupInfo(db, groupId);
    if (!group) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const isAppAdmin = (await db.collection("admins").doc(uid).get()).exists;
    if (group.createdBy !== uid && !isAppAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!ensureVapidConfigured()) {
      return NextResponse.json({ success: true, count: 0, push: "not-configured" });
    }

    const col = db.collection("groups").doc(groupId).collection("assignments");
    const ids = Array.from(new Set(assignmentIds as string[]));
    const snaps = ids.length > 0 ? await db.getAll(...ids.map((id) => col.doc(id))) : [];
    const byHolder = new Map<string, StoredAssignment[]>();
    snaps.forEach((s) => {
      if (!s.exists) return;
      const a = s.data() as StoredAssignment;
      if (typeof a.uid !== "string" || !ID_PATTERN.test(a.uid)) return;
      if (!byHolder.has(a.uid)) byHolder.set(a.uid, []);
      byHolder.get(a.uid)!.push(a);
    });

    let sent = 0;
    for (const [holder, list] of Array.from(byHolder.entries())) {
      const subscriptions = await getPushSubscriptions(db, holder);
      if (subscriptions.length === 0) continue;
      list.sort((x, y) => x.khatm - y.khatm || x.juz - y.juz);
      const juzText = list.map((a) => `Cüz ${a.juz}`).join(" və ");
      const detail = list.length === 1
        ? ` · ${khatmLabel(list[0].khatm)}, səhifə ${Math.min(...list[0].pages)}–${Math.max(...list[0].pages)}`
        : "";
      const payload = JSON.stringify({
        title: "Bismillah",
        body: `Sizin üçün ${juzText} təyin edildi${detail}. Allah asan etsin.`,
        icon: "/icon.png",
        badge: "/favicon.ico",
        vibrate: [200, 100, 200],
        data: { url: "/dashboard" },
      });
      const result = await sendToSubscriptions(subscriptions, payload);
      await removePushSubscriptions(db, holder, result.expired);
      sent += result.attempted;
    }

    // Skipped members: only those who really are approved members with unfinished juz
    let skippedNotified = 0;
    for (const skippedUid of Array.from(new Set(skippedUids as string[]))) {
      if (byHolder.has(skippedUid) || !isApprovedMember(group, skippedUid)) continue;
      const open = await col.where("uid", "==", skippedUid).where("done", "==", false).get();
      if (open.size < MAX_OPEN_ASSIGNMENTS) continue;
      const subscriptions = await getPushSubscriptions(db, skippedUid);
      if (subscriptions.length === 0) continue;
      const juzList = open.docs.map((d) => `Cüz ${d.data().juz}`).join(" və ");
      const payload = JSON.stringify({
        title: "Cüz bölgüsü",
        body: `Bu bölgüdə sizə yeni cüz verilmədi, çünki ${juzList} hələ bitməyib. Əvvəlki cüzlərinizi bitirin, növbəti bölgüdə yeni cüz alacaqsınız.`,
        icon: "/icon.png",
        badge: "/favicon.ico",
        vibrate: [200, 100, 200],
        data: { url: "/readings" },
      });
      const result = await sendToSubscriptions(subscriptions, payload);
      await removePushSubscriptions(db, skippedUid, result.expired);
      sent += result.attempted;
      skippedNotified++;
    }

    return NextResponse.json({ success: true, members: byHolder.size, skipped: skippedNotified, count: sent });
  } catch (error) {
    console.error("Error in notify-assignments API route:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
