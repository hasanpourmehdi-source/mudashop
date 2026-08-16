import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { z } from "zod";

const patchSchema = z.object({ isDefault: z.boolean() });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; paramId: string }> }
) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id: siteId, paramId } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "داده نامعتبر" }, { status: 400 });
  }

  // فقط یه دسته‌بندی می‌تونه «پیش‌فرض» این سایت باشه -- اول بقیه رو خاموش کن
  await prisma.$transaction(async (tx) => {
    if (parsed.data.isDefault) {
      await tx.externalSiteCategoryParam.updateMany({
        where: { siteId, isDefault: true },
        data: { isDefault: false },
      });
    }
    await tx.externalSiteCategoryParam.update({
      where: { id: paramId },
      data: { isDefault: parsed.data.isDefault },
    });
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; paramId: string }> }
) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { paramId } = await params;
  await prisma.externalSiteCategoryParam.delete({ where: { id: paramId } });
  return NextResponse.json({ success: true });
}
