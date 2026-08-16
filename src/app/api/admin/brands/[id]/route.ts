import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { z } from "zod";

const updateSchema = z.object({ name: z.string().min(1, "نام برند الزامی است") });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "داده نامعتبر" }, { status: 400 });
  }

  try {
    const brand = await prisma.brand.update({ where: { id }, data: parsed.data });
    return NextResponse.json(brand);
  } catch {
    return NextResponse.json({ error: "این نام قبلاً استفاده شده است" }, { status: 409 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  // حذف برند، محصولات وصل‌شده رو حذف نمی‌کنه -- فقط brandId شون null می‌شه (onDelete: SetNull)
  // راهنماهای سایز وصل به این برند هم به‌خاطر onDelete: Cascade حذف می‌شن
  await prisma.brand.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
