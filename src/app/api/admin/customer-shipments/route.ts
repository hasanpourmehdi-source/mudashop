import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { z } from "zod";

const createSchema = z.object({
  image: z.string().min(1, "عکس الزامی است"),
  caption: z.string().max(300).optional(),
  productId: z.string().optional(),
  externalId: z.string().optional(),
  isPublished: z.boolean().optional(),
});

export async function GET() {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const items = await prisma.customerShipment.findMany({
    orderBy: { createdAt: "desc" },
    include: { product: { select: { title: true, slug: true } } },
  });
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "داده نامعتبر" }, { status: 400 });
  }

  const item = await prisma.customerShipment.create({
    data: {
      image: parsed.data.image,
      caption: parsed.data.caption || null,
      productId: parsed.data.productId || null,
      externalId: parsed.data.externalId || null,
      isPublished: parsed.data.isPublished ?? false,
    },
  });
  return NextResponse.json(item, { status: 201 });
}
