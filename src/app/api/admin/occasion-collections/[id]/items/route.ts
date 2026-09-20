import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { resolveTrendyolProductSnapshot } from "@/lib/trendyolAdminResolve";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const addItemSchema = z
  .object({
    productId: z.string().min(1).optional(),
    trendyolInput: z.string().min(1).optional(),
  })
  .refine((d) => Boolean(d.productId) !== Boolean(d.trendyolInput), {
    message: "دقیقاً یکی از محصولِ مزون یا محصولِ ترندیول باید انتخاب شود",
  });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok } = await requireAdmin("PRODUCTS");
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  const collection = await prisma.occasionCollection.findUnique({ where: { id } });
  if (!collection) return NextResponse.json({ error: "مجموعه یافت نشد" }, { status: 404 });

  const body = await req.json();
  const parsed = addItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "داده نامعتبر" }, { status: 400 });
  }

  try {
    if (parsed.data.productId) {
      const product = await prisma.product.findUnique({ where: { id: parsed.data.productId } });
      if (!product) return NextResponse.json({ error: "محصول یافت نشد" }, { status: 404 });

      const item = await prisma.occasionCollectionItem.create({
        data: {
          collectionId: id,
          source: "MAZON",
          productKey: `mazon:${product.id}`,
          productId: product.id,
        },
      });
      return NextResponse.json(item, { status: 201 });
    }

    const snapshot = await resolveTrendyolProductSnapshot(parsed.data.trendyolInput!);
    const item = await prisma.occasionCollectionItem.create({
      data: {
        collectionId: id,
        source: "TRENDYOL",
        productKey: `trendyol:${snapshot.contentId}`,
        externalId: snapshot.contentId,
        title: snapshot.title,
        image: snapshot.image,
        price: snapshot.price,
        originalPrice: snapshot.originalPrice,
        productUrl: snapshot.productUrl,
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "این محصول قبلاً به این مجموعه اضافه شده است" }, { status: 400 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "خطا در افزودن محصول" }, { status: 400 });
  }
}
