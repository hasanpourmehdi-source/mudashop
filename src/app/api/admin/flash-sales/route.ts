import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { z } from "zod";

const flashSaleSchema = z.object({
  productId: z.string().min(1, "انتخاب محصول الزامی است"),
  discountPercent: z.number().int().min(1, "درصد تخفیف باید حداقل ۱ باشد").max(90, "درصد تخفیف نمی‌تواند بیشتر از ۹۰ باشد"),
  stock: z.number().int().positive("موجودی باید عددی مثبت باشد"),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

export async function GET() {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const flashSales = await prisma.flashSale.findMany({
    include: { product: { select: { title: true, slug: true } } },
    orderBy: { startsAt: "desc" },
  });
  return NextResponse.json(flashSales);
}

export async function POST(req: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const body = await req.json();
  const parsed = flashSaleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "داده نامعتبر" },
      { status: 400 }
    );
  }

  const { startsAt, endsAt, ...rest } = parsed.data;
  if (new Date(endsAt) <= new Date(startsAt)) {
    return NextResponse.json(
      { error: "زمان پایان باید بعد از زمان شروع باشد" },
      { status: 400 }
    );
  }

  const flashSale = await prisma.flashSale.create({
    data: { ...rest, startsAt: new Date(startsAt), endsAt: new Date(endsAt) },
  });
  return NextResponse.json(flashSale, { status: 201 });
}
