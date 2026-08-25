import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

// لیستِ اقدام‌های حساسِ ثبت‌شده (کی، چه‌کاری، روی چی) -- فقط ADMIN کامل می‌بیند،
// نه STAFF (حتی STAFFای که خودش این اقدام‌ها را انجام داده)
export async function GET(req: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 100), 1), 300);

  const logs = await prisma.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ logs });
}
