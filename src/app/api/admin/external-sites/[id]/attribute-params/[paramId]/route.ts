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

  const target = await prisma.externalSiteAttributeParam.findUnique({ where: { id: paramId } });
  if (!target) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });
  if (parsed.data.isDefault && target.value === null) {
    return NextResponse.json(
      { error: "قالب عمومی (بدون مقدار مشخص) نمی‌تونه پیش‌فرض باشه" },
      { status: 400 }
    );
  }

  // فقط یه مقدار از هر ویژگی می‌تونه «پیش‌فرض» این سایت باشه (مثلاً فقط یکی از
  // مقادیر جنسیت)، ولی ویژگی‌های مختلف (جنسیت و سایز) هر کدوم پیش‌فرض جدا دارن
  await prisma.$transaction(async (tx) => {
    if (parsed.data.isDefault) {
      await tx.externalSiteAttributeParam.updateMany({
        where: { siteId, attributeId: target.attributeId, isDefault: true },
        data: { isDefault: false },
      });
    }
    await tx.externalSiteAttributeParam.update({
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
  await prisma.externalSiteAttributeParam.delete({ where: { id: paramId } });
  return NextResponse.json({ success: true });
}
