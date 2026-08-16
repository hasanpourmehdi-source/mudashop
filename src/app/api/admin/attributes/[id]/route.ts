import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1, "نام ویژگی الزامی است").optional(),
  values: z.array(z.string().min(1)).optional(),
  groupId: z.string().nullable().optional(),
});

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
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "داده نامعتبر" },
      { status: 400 }
    );
  }

  try {
    const attribute = await prisma.$transaction(async (tx) => {
      if (parsed.data.name || parsed.data.groupId !== undefined) {
        await tx.attribute.update({
          where: { id },
          data: {
            ...(parsed.data.name ? { name: parsed.data.name } : {}),
            ...(parsed.data.groupId !== undefined ? { groupId: parsed.data.groupId || null } : {}),
          },
        });
      }

      // اگه لیست مقادیر جدید داده شده، sync کامل می‌کنیم: هم حذف/اضافه، هم ترتیب رو
      // دقیقاً مطابق چیزی که ادمین وارد کرده به‌روز می‌کنیم (حتی اگه فقط جابه‌جا شده باشن)
      if (parsed.data.values) {
        const uniqueValues = Array.from(
          new Set(parsed.data.values.map((v) => v.trim()).filter(Boolean))
        );
        const existing = await tx.attributeValue.findMany({ where: { attributeId: id } });
        const existingByValue = new Map(existing.map((v) => [v.value, v]));
        const newValueSet = new Set(uniqueValues);

        const toDelete = existing.filter((v) => !newValueSet.has(v.value));
        if (toDelete.length > 0) {
          await tx.attributeValue.deleteMany({
            where: { id: { in: toDelete.map((v) => v.id) } },
          });
        }

        for (let order = 0; order < uniqueValues.length; order++) {
          const value = uniqueValues[order];
          const existingRow = existingByValue.get(value);
          if (existingRow) {
            // مقدار از قبل بود -- فقط ترتیبش رو (اگه عوض شده) به‌روز می‌کنیم
            if (existingRow.order !== order) {
              await tx.attributeValue.update({ where: { id: existingRow.id }, data: { order } });
            }
          } else {
            await tx.attributeValue.create({ data: { attributeId: id, value, order } });
          }
        }
      }

      return tx.attribute.findUnique({
        where: { id },
        include: { values: { orderBy: { order: "asc" } }, group: true },
      });
    });

    return NextResponse.json(attribute);
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
  try {
    await prisma.attribute.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "این ویژگی در محصولاتی استفاده شده و قابل حذف نیست" },
      { status: 409 }
    );
  }
}
