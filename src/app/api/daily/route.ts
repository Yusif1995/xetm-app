import { NextResponse } from "next/server";
import { dailyContent } from "@/lib/dailyContent";

export const dynamic = "force-dynamic";

// Today's ayah and hadith, rotating every day (Baku time) through a verified list.
// Kept as an API for the sign-in screen; the dashboard computes the same item locally.
export async function GET() {
  const { ayah, hadith } = dailyContent();
  return NextResponse.json({
    ...ayah,
    type: "ayah",
    ayah,
    hadith,
  });
}
