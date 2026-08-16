import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { z } from "zod";

const schema = z.object({
  categoryId: z.string().min(1, "دسته‌بندی الزامی است"),
  param: z.string().min(1, "پارامتر الزامی است (مثلاً wc=82)"),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id: siteId } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "داده نامعتبر" }, { status: 400 });
  }

  try {
    const created = await prisma.externalSiteCategoryParam.upsert({
      where: { siteId_categoryId: { siteId, categoryId: parsed.data.categoryId } },
      update: { param: parsed.data.param },
      create: { siteId, categoryId: parsed.data.categoryId, param: parsed.data.param },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "خطا در ذخیره‌سازی" }, { status: 400 });
  }
}
