import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { z } from "zod";

const updateSchema = z.object({ name: z.string().min(1, "نام گروه الزامی است") });

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
    const group = await prisma.attributeGroup.update({ where: { id }, data: parsed.data });
    return NextResponse.json(group);
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
  // حذف گروه، ویژگی‌های عضوش رو حذف نمی‌کنه -- فقط دیگه هم‌گروه نیستن
  await prisma.attribute.updateMany({ where: { groupId: id }, data: { groupId: null } });
  await prisma.attributeGroup.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
