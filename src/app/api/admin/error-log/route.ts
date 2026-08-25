import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

// لیستِ خطاهای ثبت‌شده -- پیش‌فرض فقط حل‌نشده‌ها، جدیدترین اول
export async function GET(req: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const url = new URL(req.url);
  const showResolved = url.searchParams.get("resolved") === "true";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 100), 1), 300);

  const [logs, unresolvedCount] = await Promise.all([
    prisma.errorLog.findMany({
      where: showResolved ? undefined : { resolvedAt: null },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.errorLog.count({ where: { resolvedAt: null } }),
  ]);

  return NextResponse.json({ logs, unresolvedCount });
}
