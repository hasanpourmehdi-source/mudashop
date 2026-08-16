import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { z } from "zod";

const categorySchema = z.object({
  name: z.string().min(1, "نام دسته‌بندی الزامی است"),
  slug: z.string().min(1, "اسلاگ الزامی است"),
  imageUrl: z.string().optional(),
  icon: z.string().optional(),
  parentId: z.string().optional(),
  // هر ویژگی وصل‌شده به این دسته + مقدار ثابت اختیاری‌ش (مثلا جنسیت: زنانه)
  attributeLinks: z
    .array(z.object({ attributeId: z.string(), fixedValue: z.string().nullable().optional() }))
    .optional(),
});

export async function GET() {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const categories = await prisma.category.findMany({
    include: {
      attributes: {
        include: {
          attribute: { include: { values: { orderBy: { order: "asc" } }, group: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(categories);
}

export async function POST(req: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const body = await req.json();
  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "داده نامعتبر" },
      { status: 400 }
    );
  }

  const { attributeLinks, ...rest } = parsed.data;

  try {
    const category = await prisma.category.create({
      data: {
        ...rest,
        parentId: rest.parentId || null,
        ...(attributeLinks && attributeLinks.length > 0
          ? {
              attributes: {
                create: attributeLinks.map((l) => ({
                  attributeId: l.attributeId,
                  fixedValue: l.fixedValue || null,
                })),
              },
            }
          : {}),
      },
      include: { attributes: { include: { attribute: true } } },
    });
    return NextResponse.json(category, { status: 201 });
  } catch {
    return NextResponse.json({ error: "این اسلاگ قبلاً استفاده شده است" }, { status: 409 });
  }
}
