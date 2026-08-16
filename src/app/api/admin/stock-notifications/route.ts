import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { advanceAllExpiredReservationQueues } from "@/lib/stockNotify";

export async function GET() {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  // قبل از نمایش لیست، صف‌هایی که مهلت اولویتشون تموم شده رو جلو می‌بریم
  await advanceAllExpiredReservationQueues();

  const notifications = await prisma.stockNotification.findMany({
    include: {
      user: { select: { name: true, email: true } },
      product: { select: { title: true, slug: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(notifications);
}
