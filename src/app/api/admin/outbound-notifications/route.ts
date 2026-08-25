import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

// لیست اعلان‌های خروجی (ایمیل/پیامک) به تفکیک وضعیت -- برای ادمین تا ببیند
// چه چیزی ارسال/لاگ/شکست‌خورده است. ترتیب: جدیدترین اول.
export async function GET(req: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const url = new URL(req.url);
  const status = url.searchParams.get("status"); // SENT | LOGGED | FAILED | null
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 200);

  const logs = await prisma.outboundNotification.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      channel: true,
      eventType: true,
      to: true,
      subject: true,
      body: true,
      status: true,
      error: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  });

  const counts = await prisma.outboundNotification.groupBy({
    by: ["status"],
    _count: true,
  });

  return NextResponse.json({
    logs,
    counts: counts.reduce<Record<string, number>>((acc, c) => {
      acc[c.status] = c._count;
      return acc;
    }, {}),
  });
}