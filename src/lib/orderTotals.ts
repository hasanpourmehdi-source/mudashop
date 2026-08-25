import type { Prisma } from "@prisma/client";
import { GIFT_WRAP_COST } from "@/lib/shipping";

export type TotalsItem = { price: number; quantity: number };

// فرمولِ محاسبه‌ی subtotal و total یه سفارش -- جدا و تست‌پذیر، چون پولِ
// واقعی درگیره و هم لحظه‌ی ثبت سفارش و هم ویرایشِ اقلامِ ادمین باید دقیقاً
// یه فرمول باشن: subtotal = جمع(قیمت × تعداد)، total = subtotal - تخفیف کوپن
// (+ هزینه‌ی کادوپچ اگه خواسته شده)
export function computeOrderTotals(
  items: TotalsItem[],
  discountTotal: number,
  giftWrap: boolean
): { subtotal: number; total: number } {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = subtotal - discountTotal + (giftWrap ? GIFT_WRAP_COST : 0);
  return { subtotal, total };
}

// وقتی ادمین اقلام یه سفارش رو ویرایش می‌کنه (تعداد/قیمت/افزودن/حذف)، subtotal و
// total باید دوباره از روی اقلام فعلی محاسبه بشن -- دقیقاً همون فرمول لحظه‌ی
// ثبت سفارش (src/app/api/orders/route.ts)، با این تفاوت که discountTotal
// (کوپن) دست‌نخورده می‌مونه چون اعتبارسنجی مجدد کوپن روی مبلغ ویرایش‌شده خارج
// از scope این عملیاته
export async function recomputeOrderTotals(tx: Prisma.TransactionClient, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  const { subtotal, total } = computeOrderTotals(order.items, order.discountTotal, order.giftWrap);
  return tx.order.update({ where: { id: orderId }, data: { subtotal, total } });
}