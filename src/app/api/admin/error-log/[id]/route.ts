import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";

// علامت‌زدنِ یک خطا به‌عنوان بررسی‌شده -- فقط برای جمع‌وجورنگه‌داشتنِ لیست،
// خودِ ردیف پاک نمی‌شه
export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  const log = await prisma.errorLog.findUnique({ where: { id } });
  if (!log) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });

  const updated = await prisma.errorLog.update({
    where: { id },
    data: { resolvedAt: log.resolvedAt ? null : new Date() },
  });

  return NextResponse.json(updated);
}
