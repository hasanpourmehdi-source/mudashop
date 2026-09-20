import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const reportSchema = z
  .object({
    productId: z.string().min(1).optional(),
    externalId: z.string().min(1).optional(),
    reportedPrice: z.number().int().positive("قیمت باید عددی مثبت باشد").max(1_000_000_000),
    note: z.string().max(500).optional(),
  })
  .refine((data) => Boolean(data.productId) !== Boolean(data.externalId), {
    message: "دقیقاً یکی از productId یا externalId باید مشخص باشد",
  });

// صرفاً یه کانالِ ارتباطیِ دستیِ مشتری->ادمین -- بدونِ هیچ مقایسه/اسکرپِ خودکار
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "داده نامعتبر" }, { status: 400 });
  }

  const { productId, externalId, reportedPrice, note } = parsed.data;

  const created = await prisma.cheaperPriceReport.create({
    data: {
      source: productId ? "MAZON" : "TRENDYOL",
      productId: productId ?? null,
      externalId: externalId ?? null,
      reportedPrice,
      note: note || null,
      userId: session.user.id,
    },
  });
  return NextResponse.json(created, { status: 201 });
}
