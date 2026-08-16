import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1, "نام دسته‌بندی الزامی است").optional(),
  slug: z.string().min(1, "اسلاگ الزامی است").optional(),
  imageUrl: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  attributeLinks: z
    .array(z.object({ attributeId: z.string(), fixedValue: z.string().nullable().optional() }))
    .optional(),
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

  if (parsed.data.parentId === id) {
    return NextResponse.json({ error: "یک دسته نمی‌تواند والد خودش باشد" }, { status: 400 });
  }

  const { attributeLinks, ...rest } = parsed.data;

  try {
    const category = await prisma.$transaction(async (tx) => {
      const updated = await tx.category.update({
        where: { id },
        data: { ...rest, ...(rest.parentId !== undefined ? { parentId: rest.parentId || null } : {}) },
      });

      // اگه لیست ویژگی‌های جدید داده شده، اتصال‌های قبلی رو کامل جایگزین می‌کنیم
      if (attributeLinks !== undefined) {
        await tx.categoryAttribute.deleteMany({ where: { categoryId: id } });
        if (attributeLinks.length > 0) {
          await tx.categoryAttribute.createMany({
            data: attributeLinks.map((l) => ({
              categoryId: id,
              attributeId: l.attributeId,
              fixedValue: l.fixedValue || null,
            })),
          });
        }
      }

      return updated;
    });
    return NextResponse.json(category);
  } catch {
    return NextResponse.json({ error: "این اسلاگ قبلاً استفاده شده است" }, { status: 409 });
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
    await prisma.category.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "این دسته‌بندی محصول یا زیردسته دارد و قابل حذف نیست" },
      { status: 409 }
    );
  }
}
