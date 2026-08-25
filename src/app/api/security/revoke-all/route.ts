import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { revokeOtherSessions, sessionSidFromRequest } from "@/lib/security";

// خروج از همه‌ی دستگاه‌های دیگر؛ دستگاه فعلی (همانی که با آن دکمه را زدی) می‌ماند
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }
  const currentSid = await sessionSidFromRequest(req);
  const revoked = await revokeOtherSessions(session.user.id, currentSid);
  return NextResponse.json({ success: true, revoked });
}