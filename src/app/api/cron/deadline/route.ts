import { NextRequest, NextResponse } from "next/server";
import { runDeadlineRemindersIfDue } from "@/lib/deadlineReminder";

// External trigger for the 18:00 last-day reminder (e.g. a cron service), in case the server
// was asleep at that time. Needs CRON_SECRET; sending twice is prevented per assignment.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  const given = auth.startsWith("Bearer ") ? auth.slice(7) : req.nextUrl.searchParams.get("key");
  if (!secret || given !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runDeadlineRemindersIfDue());
  } catch (error) {
    console.error("Error in deadline cron route:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
