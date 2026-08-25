import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

// باز کردن قفلِ brute-force قبل از اتمامِ خودکارِ ۱۵ دقیقه -- تنها راهِ دیگرِ
// باز شدنش، ریست کردن رمز از طریق ایمیل (که در reset-password/route.ts هم
// همین فیلدها رو صفر می‌کند)؛ این‌جا برای وقتی است که ادمین می‌خواهد فوراً و
// دستی بازش کند
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok, session } = await requireAdmin();
  if (!ok || !session) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id }, select: { email: true, lockedUntil: true } });
  if (!user) return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });

  await prisma.user.update({
    where: { id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });

  await logAdminAction({
    adminId: session.user.id,
    adminName: session.user.name ?? "",
    adminEmail: session.user.email ?? "",
    action: "ACCOUNT_UNLOCKED",
    targetType: "User",
    targetId: id,
    detail: user.email,
  });

  return NextResponse.json({ ok: true });
}
