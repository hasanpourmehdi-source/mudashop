import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { z } from "zod";

const brandSchema = z.object({
  name: z.string().min(1, "نام برند الزامی است"),
});

export async function GET() {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const brands = await prisma.brand.findMany({
    include: { _count: { select: { products: true, sizeGuides: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(brands);
}

export async function POST(req: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const body = await req.json();
  const parsed = brandSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "داده نامعتبر" },
      { status: 400 }
    );
  }

  try {
    const brand = await prisma.brand.create({ data: parsed.data });
    return NextResponse.json(brand, { status: 201 });
  } catch {
    return NextResponse.json({ error: "این برند قبلاً وجود دارد" }, { status: 409 });
  }
}
