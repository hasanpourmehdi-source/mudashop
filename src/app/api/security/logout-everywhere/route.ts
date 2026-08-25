import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logoutEverywhere } from "@/lib/security";

// خروج از همه‌جا: نسخه‌ی امنیتی عوض می‌شود و همه‌ی نشست‌ها باطل؛
// کلاینت باید بعدش signOut کند تا کوکی هم پاک شود.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }
  await logoutEverywhere(session.user.id);
  return NextResponse.json({ success: true });
}