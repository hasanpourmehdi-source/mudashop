import type { Prisma } from "@prisma/client";
import { GIFT_WRAP_COST } from "@/lib/shipping";

// وقتی ادمین اقلام یه سفارش رو ویرایش می‌کنه (تعداد/قیمت/افزودن/حذف)، subtotal و
// total باید دوباره از روی اقلام فعلی محاسبه بشن -- دقیقاً همون فرمول لحظه‌ی
// ثبت سفارش (src/app/api/orders/route.ts)، با این تفاوت که discountTotal
// (کوپن) دست‌نخورده می‌مونه چون اعتبارسنجی مجدد کوپن روی مبلغ ویرایش‌شده خارج
// از scope این عملیاته
export async function recomputeOrderTotals(tx: Prisma.TransactionClient, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = subtotal - order.discountTotal + (order.giftWrap ? GIFT_WRAP_COST : 0);
  return tx.order.update({ where: { id: orderId }, data: { subtotal, total } });
}
