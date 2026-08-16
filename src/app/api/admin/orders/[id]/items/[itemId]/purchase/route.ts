import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { computePurchaseSummary } from "@/lib/orderPurchaseStatus";
import { z } from "zod";

const schema = z.object({
  tag: z.string().trim().min(1, "تگ رو وارد کنید").max(200),
  actualPrice: z.number().int().nonnegative(),
});

// فاز اول خرید تک‌به‌تک اقلام خارجی («در صف خرید») -- ادمین می‌گه این قلم رو
// واقعاً خرید، با یه تگ برای ردیابی فیزیکی (بعداً وقتی کالا به انبار/نمایندگی
// می‌رسه، همین تگ برای پیدا کردن دوباره‌ی سفارش استفاده می‌شه) و قیمت واقعی
// خریداری‌شده (اگه با چیزی که مشتری پرداخت کرده فرق داشت، تسویه‌ش موکول به
// پرداخت باربری/ارسال می‌شه، نه فوری)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id, itemId } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "داده نامعتبر" },
      { status: 400 }
    );
  }

  const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) return NextResponse.json({ error: "سفارش یافت نشد" }, { status: 404 });

  const item = order.items.find((i) => i.id === itemId);
  if (!item) return NextResponse.json({ error: "قلم سفارش یافت نشد" }, { status: 404 });
  if (item.source !== "TRENDYOL") {
    return NextResponse.json({ error: "این عملیات فقط برای اقلام خارجی معنی دارد" }, { status: 400 });
  }
  if (order.paymentStatus !== "PAID") {
    return NextResponse.json(
      { error: "این عملیات فقط بعد از پرداخت اقلام سفارش انجام می‌شود" },
      { status: 400 }
    );
  }
  if (item.purchaseStatus !== "PENDING") {
    return NextResponse.json({ error: "وضعیت خرید این قلم قبلاً مشخص شده است" }, { status: 400 });
  }

  const existingTag = await prisma.orderItem.findUnique({ where: { purchaseTag: parsed.data.tag } });
  if (existingTag) {
    return NextResponse.json({ error: "این تگ قبلاً برای یه قلم دیگه استفاده شده است" }, { status: 409 });
  }

  const now = new Date();
  const updatedItem = await prisma.orderItem.update({
    where: { id: itemId },
    data: {
      purchaseStatus: "PURCHASED",
      purchaseTag: parsed.data.tag,
      purchasePriceActual: parsed.data.actualPrice,
      purchaseResolvedAt: now,
    },
  });

  const summary = computePurchaseSummary(
    order.items.map((i) => (i.id === itemId ? updatedItem : i))
  );

  await prisma.orderStatusHistory.create({
    data: {
      orderId: id,
      status: order.status,
      note: `قلم «${item.title}» خریداری شد (تگ: ${parsed.data.tag}) -- ${summary.purchased} از ${summary.total} کالای خارجی این سفارش خریداری شد`,
    },
  });

  await prisma.notification.create({
    data: {
      userId: order.userId,
      message: `${summary.purchased} از ${summary.total} کالای سفارش #${id.slice(-8)} خریداری شد`,
      link: `/orders/${id}`,
    },
  });

  return NextResponse.json(updatedItem);
}
