import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { z } from "zod";

const sizeGuideSchema = z.object({
  categoryId: z.string().min(1, "انتخاب دسته‌بندی الزامی است"),
  brandId: z.string().min(1, "انتخاب برند الزامی است"),
  imageUrl: z.string().min(1, "آپلود عکس الزامی است"),
});

export async function GET() {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const sizeGuides = await prisma.sizeGuide.findMany({
    include: { category: true, brand: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(sizeGuides);
}

export async function POST(req: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const body = await req.json();
  const parsed = sizeGuideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "داده نامعتبر" },
      { status: 400 }
    );
  }

  // برای هر ترکیب دسته‌بندی+برند فقط یک راهنما مجاز است -- اگه از قبل بود، عکسش آپدیت می‌شه
  const sizeGuide = await prisma.sizeGuide.upsert({
    where: {
      categoryId_brandId: {
        categoryId: parsed.data.categoryId,
        brandId: parsed.data.brandId,
      },
    },
    update: { imageUrl: parsed.data.imageUrl },
    create: parsed.data,
    include: { category: true, brand: true },
  });

  return NextResponse.json(sizeGuide, { status: 201 });
}
