import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

// لیست گفتگوهای پشتیبانی برای پنل ادمین: هر کاربری که پیامی دارد + تعداد
// نخوانده (پیام‌های مشتری که ادمین هنوز ندیده) + آخرین زمان پیام
export async function GET() {
  const { ok } = await requireAdmin("SUPPORT");
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const grouped = await prisma.supportMessage.groupBy({
    by: ["userId"],
    _count: { _all: true },
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: "desc" } },
  });

  if (grouped.length === 0) return NextResponse.json({ conversations: [] });

  const userIds = grouped.map((g) => g.userId);
  const [users, unreadGroups] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    }),
    prisma.supportMessage.groupBy({
      by: ["userId"],
      where: { sender: "CUSTOMER", adminRead: false },
      _count: { _all: true },
    }),
  ]);

  const userMap = new Map(users.map((u) => [u.id, u]));
  const unreadMap = new Map(unreadGroups.map((g) => [g.userId, g._count._all]));

  const conversations = grouped.map((g) => ({
    userId: g.userId,
    name: userMap.get(g.userId)?.name ?? null,
    email: userMap.get(g.userId)?.email ?? "",
    messageCount: g._count._all,
    unread: unreadMap.get(g.userId) ?? 0,
    lastAt: g._max.createdAt,
  }));

  return NextResponse.json({ conversations });
}