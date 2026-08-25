import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

// لیست اخطارهای کاهش قیمت برای پنل ادمین -- فعال و آتش‌زده، جدیدترین اول.
export async function GET() {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const alerts = await prisma.priceAlert.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true } },
      product: { select: { title: true, slug: true } },
    },
  });

  return NextResponse.json({
    active: alerts.filter((a) => a.notifiedAt === null),
    fired: alerts.filter((a) => a.notifiedAt !== null),
  });
}