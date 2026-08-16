import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";

export async function GET(request: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);

  const logs = await prisma.trendyolFetchLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  const total = await prisma.trendyolFetchLog.count();

  return NextResponse.json({ logs, total });
}

// پاک کردن همه‌ی لاگ‌ها (وقتی مثلاً مشکلات قبلی رو حل کردی و می‌خوای از نو شروع کنی)
export async function DELETE() {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const result = await prisma.trendyolFetchLog.deleteMany({});
  return NextResponse.json({ deleted: result.count });
}
