import { NextRequest, NextResponse } from "next/server";
import { verifyRequestUser } from "@/lib/serverAuth";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { migrateUserPrivateData } from "@/lib/privateData";

// Super admin only: move every user's email / push subscriptions into their private doc.
// Users are also migrated one by one when they log in; this covers everyone else.
export async function POST(req: NextRequest) {
  try {
    const uid = await verifyRequestUser(req);
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "FIREBASE_SERVICE_ACCOUNT is not configured" }, { status: 500 });
    }

    const adminSnap = await db.collection("admins").doc(uid).get();
    if (!adminSnap.exists) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const users = await db.collection("users").select().get();
    let migrated = 0;
    for (const userDoc of users.docs) {
      if (await migrateUserPrivateData(db, userDoc.id)) migrated++;
    }

    return NextResponse.json({ success: true, total: users.size, migrated });
  } catch (error) {
    console.error("Error in migrate-private API route:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
