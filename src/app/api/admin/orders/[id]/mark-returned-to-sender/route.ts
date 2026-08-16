import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { z } from "zod";

const schema = z.object({
  reason: z.string().trim().min(1, "دلیل رو بنویسید").max(500),
});

// اگه پست/پیک نتونه بسته رو تحویل بده و برش گردونه -- برای مزون و خارجی هر دو.
// سفارش به «در حال پردازش» برمی‌گرده و باید هزینه‌ی ارسال دوباره از مشتری
// گرفته بشه؛ این با ساختن/برگرداندنِ ShippingPayment به FAILED انجام می‌شه --
// همون مکانیزمی که ریترای بعد از رد فیش رو فعال می‌کنه (set-shipping-cost)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "داده نامعتبر" },
      { status: 400 }
    );
  }

  const order = await prisma.order.findUnique({ where: { id }, include: { shippingPayment: true } });
  if (!order) return NextResponse.json({ error: "سفارش یافت نشد" }, { status: 404 });
  if (order.status !== "SHIPPED") {
    return NextResponse.json(
      { error: "فقط سفارش‌های ارسال‌شده می‌توانند برگشت‌خورده علامت بخورند" },
      { status: 400 }
    );
  }

  const { reason } = parsed.data;

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id },
      data: { status: "PROCESSING", returnedToSenderCount: { increment: 1 } },
    });

    if (order.shippingPayment) {
      await tx.shippingPayment.update({ where: { orderId: id }, data: { status: "FAILED" } });
    } else {
      // سفارش مزون که تا حالا هیچ ShippingPayment نداشته -- یه ردیف جای‌گزین
      // با status=FAILED می‌سازیم فقط برای فعال‌کردن مسیر ریترای موجود
      await tx.shippingPayment.create({
        data: { orderId: id, amount: 0, shippingCost: 0, cargoCost: 0, status: "FAILED" },
      });
    }

    await tx.orderStatusHistory.create({
      data: {
        orderId: id,
        status: "PROCESSING",
        note: `بسته توسط پست/پیک برگشت خورد -- ${reason} (نیاز به تعیین و پرداخت مجدد هزینه ارسال)`,
      },
    });
  });

  await prisma.notification.create({
    data: {
      userId: order.userId,
      message: `بسته‌ی سفارش #${id.slice(-8)} توسط پست/پیک برگشت خورد -- ${reason}. هزینه ارسال به‌زودی دوباره مشخص می‌شود.`,
      link: `/orders/${id}`,
    },
  });

  const updated = await prisma.order.findUnique({ where: { id }, include: { shippingPayment: true } });
  return NextResponse.json(updated);
}
