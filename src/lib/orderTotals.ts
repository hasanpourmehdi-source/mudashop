import type { Prisma } from "@prisma/client";
import { GIFT_WRAP_COST } from "@/lib/shipping";

export type TotalsItem = { price: number; quantity: number };

// فرمولِ محاسبه‌ی subtotal و total یه سفارش -- جدا و تست‌پذیر، چون پولِ
// واقعی درگیره و هم لحظه‌ی ثبت سفارش و هم ویرایشِ اقلامِ ادمین باید دقیقاً
// یه فرمول باشن: subtotal = جمع(قیمت × تعداد)، total = subtotal - تخفیف کوپن
// (+ هزینه‌ی کادوپچ اگه خواسته شده). discountTotal همیشه به subtotal
// جدید clamp می‌شه (نمی‌تونه بیشتر از قیمتِ چیزی که واقعاً خریداری می‌شه
// باشه) -- دقیقاً همون قانونی که لحظه‌ی ثبت سفارش برای کوپن FIXED اعمال
// می‌شه (Math.min(coupon.value, subtotal))، اینجا هم به‌عنوان یه اینورینتِ
// ریاضیِ سخت (نه یه تصمیمِ کسب‌وکاری) دوباره اجرا می‌شه؛ در غیر این صورت
// اگه ادمین بعداً یه قلمِ گرون رو از سفارشی با تخفیفِ ثابت حذف/کم کنه،
// total می‌تونست منفی بشه و سفارش برای همیشه غیرقابل‌پرداخت بمونه
export function computeOrderTotals(
  items: TotalsItem[],
  discountTotal: number,
  giftWrap: boolean
): { subtotal: number; total: number; discountTotal: number } {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const clampedDiscount = Math.max(0, Math.min(discountTotal, subtotal));
  const total = subtotal - clampedDiscount + (giftWrap ? GIFT_WRAP_COST : 0);
  return { subtotal, total, discountTotal: clampedDiscount };
}

// وقتی ادمین اقلام یه سفارش رو ویرایش می‌کنه (تعداد/قیمت/افزودن/حذف)، subtotal و
// total باید دوباره از روی اقلام فعلی محاسبه بشن -- دقیقاً همون فرمول لحظه‌ی
// ثبت سفارش (src/app/api/orders/route.ts). اعتبارسنجیِ کاملِ مجددِ کوپن
// (مثلاً حداقل مبلغ سفارش) همچنان خارج از scope این عملیاته -- فقط
// اینورینتِ سخت «تخفیف نمی‌تونه از قیمتِ خودِ سفارش بیشتر بشه» همیشه اجرا می‌شه
export async function recomputeOrderTotals(tx: Prisma.TransactionClient, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  const { subtotal, total, discountTotal } = computeOrderTotals(order.items, order.discountTotal, order.giftWrap);
  // اینورینتِ «total همیشه هزینه‌ی ارسالِ فعلی رو داخلش داره» (برای سفارش
  // فقط-مزون؛ برای خارجی shippingCost تهیه) -- بدون این، بعد از ویرایشِ اقلام
  // finalizeItemsPayment که ارسالِ قبلی رو از total کم می‌کنه، مقدار اشتباهی
  // پایه می‌گیره و مبلغ نهایی کم/زیاد محاسبه می‌شه
  const shipping = order.shippingCost ?? 0;
  return tx.order.update({ where: { id: orderId }, data: { subtotal, total: total + shipping, discountTotal } });
}