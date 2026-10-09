import { NextRequest, NextResponse } from "next/server";
import { verifyRequestUser, isRateLimited } from "@/lib/serverAuth";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { getGroupInfo, isApprovedMember } from "@/lib/privateData";
import { recomputeKhatm } from "@/lib/groupProgress";

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

// Recompute the group's khatm counters after a member marked pages. Any approved member may
// trigger it; the result only depends on the stored progress, so it cannot be inflated.
export async function POST(req: NextRequest) {
  try {
    const uid = await verifyRequestUser(req);
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (isRateLimited(`progress:${uid}`, 120, 10 * 60 * 1000)) {
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

    const result = await recomputeKhatm(db, groupId);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Error in group-progress API route:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
