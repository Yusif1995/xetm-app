import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { verifyRequestOwner, verifyRequestUser, isRateLimited } from "@/lib/serverAuth";
import { getAdminDb } from "@/lib/firebaseAdmin";

const MAX_NAME_LENGTH = 60;

// Only app admins (admins/{uid}) and the app owner may create groups. Created here with the Admin
// SDK; firestore.rules no longer let clients create groups themselves.
export async function POST(req: NextRequest) {
  try {
    const uid = await verifyRequestUser(req);
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (isRateLimited(`create-group:${uid}`, 10, 10 * 60 * 1000)) {
      return NextResponse.json({ error: "Çox qrup yaradıldı. Bir az sonra yenidən cəhd et." }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name || name.length > MAX_NAME_LENGTH) {
      return NextResponse.json({ error: `Qrupun adı 1–${MAX_NAME_LENGTH} simvol olmalıdır.` }, { status: 400 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server is not configured" }, { status: 500 });
    }

    const isAdmin = (await db.collection("admins").doc(uid).get()).exists || (await verifyRequestOwner(req)) === uid;
    if (!isAdmin) {
      return NextResponse.json({ error: "Qrupu yalnız adminlər yarada bilər." }, { status: 403 });
    }

    const groupRef = db.collection("groups").doc();
    const userRef = db.collection("users").doc(uid);
    const batch = db.batch();
    batch.set(groupRef, {
      name,
      createdBy: uid,
      createdAt: new Date().toISOString(),
      lastDistributedJuz: 0,
      cycleStartJuz: 1,
      isCurrentKhatmCompleted: false,
      completedKhatms: 0,
      members: { [uid]: "owner" },
      membersBackfilled: true,
    });
    batch.set(userRef, {
      groupIds: FieldValue.arrayUnion(groupRef.id),
      groupData: {
        [groupRef.id]: {
          approved: true,
          assignedPages: [],
          completedPages: [],
          completedAt: {},
          assignedJuz: null,
          assignedJuzs: [],
          previousAssignedPages: [],
          previousCompletedPages: [],
          previousStartDate: "",
          previousEndDate: "",
          totalCompletedPages: 0,
        },
      },
    }, { merge: true });
    await batch.commit();

    return NextResponse.json({ success: true, groupId: groupRef.id });
  } catch (error) {
    console.error("Error in create-group API route:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
