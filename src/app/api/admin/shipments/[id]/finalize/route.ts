import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { splitCargoCostByWeight } from "@/lib/shipment";
import { z } from "zod";

const schema = z.object({
  totalCargoCost: z.number().int().nonnegative(),
  trackingCode: z.string().max(200).optional(),
});

// نهایی‌سازیِ محموله: هزینه‌ی باربریِ کل که ادمین از فاکتور واقعی وارد می‌کنه،
// بین اقلام بر اساسِ سهمِ وزنی تقسیم می‌شه (itemCargoCost هر قلم) -- سهمِ هر
// سفارش (جمعِ اقلامش) رو ادمین باید دستی توی فرمِ «تعیین هزینه ارسال» همون
// سفارش وارد کند؛ این‌جا فقط محاسبه/ثبتِ ریز هزینه‌هاست، نه پرداختِ واقعی.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "داده نامعتبر" }, { status: 400 });
  }

  const shipment = await prisma.shipment.findUnique({ where: { id }, include: { items: true } });
  if (!shipment) return NextResponse.json({ error: "محموله یافت نشد" }, { status: 404 });
  if (shipment.shippedAt) {
    return NextResponse.json({ error: "این محموله قبلاً نهایی شده است" }, { status: 400 });
  }
  if (shipment.items.length === 0) {
    return NextResponse.json({ error: "هیچ قلمی به این محموله اضافه نشده است" }, { status: 400 });
  }

  const itemsForSplit = shipment.items.map((i) => ({ id: i.id, weightGrams: i.itemWeightGrams ?? 0 }));
  const totalWeightGrams = itemsForSplit.reduce((sum, i) => sum + i.weightGrams, 0);
  if (totalWeightGrams <= 0) {
    return NextResponse.json({ error: "وزنِ هیچ‌کدام از اقلام ثبت نشده است" }, { status: 400 });
  }

  const split = splitCargoCostByWeight(itemsForSplit, parsed.data.totalCargoCost);

  await prisma.$transaction([
    ...Array.from(split.entries()).map(([itemId, cost]) =>
      prisma.orderItem.update({ where: { id: itemId }, data: { itemCargoCost: cost } })
    ),
    prisma.shipment.update({
      where: { id },
      data: {
        totalWeightGrams,
        totalCargoCost: parsed.data.totalCargoCost,
        trackingCode: parsed.data.trackingCode,
        shippedAt: new Date(),
      },
    }),
  ]);

  // خلاصه‌ی سهمِ هر سفارش -- برای این‌که ادمین بدونه توی فرمِ هزینه ارسالِ کدوم
  // سفارش، چه عددی وارد کند
  const byOrder = new Map<string, number>();
  for (const item of shipment.items) {
    const cost = split.get(item.id) ?? 0;
    byOrder.set(item.orderId, (byOrder.get(item.orderId) ?? 0) + cost);
  }

  return NextResponse.json({
    success: true,
    orderShares: Array.from(byOrder.entries()).map(([orderId, cargoCostShare]) => ({ orderId, cargoCostShare })),
  });
}
