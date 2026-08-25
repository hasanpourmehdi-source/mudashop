import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listUserSessions } from "@/lib/security";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }
  const sessions = await listUserSessions(session.user.id);
  return NextResponse.json({ sessions });
}