import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { notifyCustomerOutbound } from "@/lib/outboundNotify";
import { finalizeItemsPayment } from "@/lib/orderFinalizePayment";
import { z } from "zod";

const schema = z.object({
  shippingCost: z.number().int().nonnegative().optional(),
  shippingMethod: z.string().optional(),
  bankCardId: z.string().optional(),
});

// ادمین بعد از محاسبه‌ی باربری، هزینه ارسال رو دستی وارد می‌کنه و (اگه لازم
// باشه) یه کارت بانکی برای پرداخت انتخاب می‌کنه -- هر دو تو یه اقدام واحد.
// اینجا اولین و تنها جایی‌ه که مبلغ نهایی سفارش کامل می‌شه: کیف‌پول (اگه
// مشتری موقع چک‌اوت خواسته بود) دقیقاً همین‌جا برای اولین‌بار اعمال می‌شه، چون
// قبل از این، به‌خاطر نامعلوم‌بودن هزینه ارسال، مبلغ نهایی معلوم نبود.
// منطقِ اصلی توی src/lib/orderFinalizePayment.ts هست -- چون همین دقیقاً همون
// کاریه که باید وقتی «تأییدِ اولیه‌ی ادمین» از تنظیمات خاموشه، خودِ سیستم
// موقعِ ثبتِ سفارش هم انجام بده
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
    return NextResponse.json({ error: "داده نامعتبر" }, { status: 400 });
  }

  const result = await finalizeItemsPayment(id, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const { order, finalTotal } = result;
  const isCashOnDelivery = order.paymentMethod === "CASH_ON_DELIVERY";

  const shortId = order.id.slice(-8);
  await prisma.notification.create({
    data: {
      userId: order.userId,
      message: isCashOnDelivery
        ? `سفارش #${shortId} تأیید شد -- مبلغ موقع تحویل نقدی دریافت می‌شود.`
        : finalTotal === 0
          ? `هزینه ارسال سفارش #${shortId} مشخص شد و کل مبلغ از کیف پول شما پرداخت شد.`
          : `هزینه ارسال و مبلغ نهایی سفارش #${shortId} مشخص شد -- برای پرداخت وارد صفحه‌ی سفارش خود شوید.`,
      link: `/orders/${order.id}`,
    },
  });
  await notifyCustomerOutbound({
    userId: order.userId,
    eventType: "PAYMENT_RECEIVED",
    title: isCashOnDelivery
      ? `سفارش #${shortId} تأیید شد (پرداخت‌درمحل)`
      : `هزینه ارسال سفارش #${shortId} مشخص شد`,
    body: isCashOnDelivery
      ? `سفارش #${shortId} تأیید شد و برای ارسال آماده می‌شود؛ مبلغ موقع تحویل نقدی دریافت خواهد شد.`
      : `هزینه ارسال سفارش #${shortId} مشخص شد و در صورت تسویه، سفارش ارسال می‌شود. جزئیات رهگیری را در صفحه‌ی سفارش ببینید.`,
  });

  return NextResponse.json(order);
}
