import { NextRequest, NextResponse } from "next/server";
import { verifyRequestUser, isRateLimited } from "@/lib/serverAuth";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { getGroupInfo, isApprovedMember } from "@/lib/privateData";

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

// Which members of a group are app admins (admins/{uid}), so the group screens can label them.
// Only approved members may ask, and only admins who belong to that group are returned:
// the full admin list stays unreadable from the client (firestore.rules).
export async function POST(req: NextRequest) {
  try {
    const uid = await verifyRequestUser(req);
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (isRateLimited(`admins:${uid}`, 60, 10 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { groupId } = await req.json();
    if (typeof groupId !== "string" || !ID_PATTERN.test(groupId)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server is not configured" }, { status: 500 });
    }

    const group = await getGroupInfo(db, groupId);
    if (!group || !isApprovedMember(group, uid)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const memberUids = Array.from(new Set([
      group.createdBy,
      ...Object.entries(group.members)
        .filter(([, status]) => status === "owner" || status === "member")
        .map(([memberUid]) => memberUid),
    ].filter((m) => ID_PATTERN.test(m))));

    const refs = memberUids.map((m) => db.collection("admins").doc(m));
    const snaps = refs.length > 0 ? await db.getAll(...refs) : [];
    const adminUids = snaps.filter((s) => s.exists).map((s) => s.id);

    return NextResponse.json({ adminUids });
  } catch (error) {
    console.error("Error in group-admins API route:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
