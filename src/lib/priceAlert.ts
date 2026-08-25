import { prisma } from "@/lib/prisma";
import { notifyCustomerOutbound } from "@/lib/outboundNotify";

// ================= اخطار کاهش قیمت =================
// وقتی قیمت مؤثر محصول (با تخفیف/حراج فلش) به targetPrice یا کمتر برسد، یک‌بار
// به مشتری اعلام می‌شود (زنگوله + ایمیل/پیامک بر اساس تنظیمات). بررسی در
// لحظه‌ی ثبت عکس قیمت روزانه (بازدید صفحه) و تغییر قیمت توسط ادمین انجام
// می‌شود -- الگوی lazy بدون کرون‌جاب، مثل صف موجودی.

export type PriceAlertLike = {
  targetPrice: number;
  notifiedAt: Date | string | null;
};

// خالص: آیا این اخطار با قیمت فعلی باید آتش بزند؟ فقط اخطارهای فعال (هنوز
// اطلاع‌داده‌نشده) با targetPrice >= قیمت فعلی.
export function shouldTriggerPriceAlert(alert: PriceAlertLike, currentPrice: number): boolean {
  return alert.notifiedAt === null && currentPrice <= alert.targetPrice;
}

// خالص: ساخت پیام زنگوله‌ای/ایمیل/پیامک برای اطلاع کاهش قیمت
export function buildPriceDropMessage(opts: {
  productTitle: string;
  targetPrice: number;
  currentPrice: number;
  slug: string;
}): { message: string; body: string; link: string } {
  const text = `قیمت «${opts.productTitle}» به ${opts.currentPrice.toLocaleString(
    "fa-IR"
  )} تومان رسید — پایین‌تر از مبلغ ${opts.targetPrice.toLocaleString("fa-IR")} تومانی که انتظارش را داشتی!`;
  return { message: text, body: text, link: `/products/mazon/${opts.slug}` };
}

// بررسی همه‌ی اخطارهای فعال یک محصول و اطلاع‌رسانی یک‌باره به افرادی که قیمت
// به حد خواسته‌شان رسیده. تعداد اخطارهای آتش‌زده را برمی‌گرداند.
export async function checkPriceAlerts(productId: string, currentPrice: number): Promise<number> {
  const pending = await prisma.priceAlert.findMany({
    where: { productId, notifiedAt: null },
    select: { id: true, userId: true, targetPrice: true, notifiedAt: true },
  });
  if (pending.length === 0) return 0;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { title: true, slug: true },
  });
  if (!product) return 0;

  const triggered = pending.filter((a) => shouldTriggerPriceAlert(a, currentPrice));
  if (triggered.length === 0) return 0;

  for (const alert of triggered) {
    const { message, body, link } = buildPriceDropMessage({
      productTitle: product.title,
      targetPrice: alert.targetPrice,
      currentPrice,
      slug: product.slug,
    });

    // یک‌بارمصرف: علامت‌زدن + زنگوله + ایمیل/پیامک
    await prisma.$transaction([
      prisma.priceAlert.update({ where: { id: alert.id }, data: { notifiedAt: new Date() } }),
      prisma.notification.create({
        data: { userId: alert.userId, message, link },
      }),
    ]);
    await notifyCustomerOutbound({
      userId: alert.userId,
      eventType: "PRICE_DROP",
      title: "کاهش قیمت محصول",
      body,
    });
  }

  return triggered.length;
}