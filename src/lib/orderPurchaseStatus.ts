import type { Prisma, OrderStatus } from "@prisma/client";

// خلاصه‌ی وضعیت خریدِ اقلام خارجی یه سفارش -- هم API (برای متن نوتیفیکیشن) هم
// OrderTracking.tsx (برای کپشن مشتری) از همین یه تابع استفاده می‌کنن تا شمارش
// دو جا تکرار/ناهماهنگ نشه. فقط اقلام TRENDYOL حساب می‌شن -- برای مزون این
// فاز (خرید از فروشنده‌ی واسط) اصلاً معنی نداره
export type PurchaseTrackedItem = { source: string; purchaseStatus: string; quantity: number };

export type PurchaseSummary = {
  total: number;
  purchased: number; // شامل PURCHASED و RECEIVED (هرچی که واقعاً خریداری شد)
  cancelled: number;
  pending: number;
  allResolved: boolean; // هیچ‌کدوم PENDING نمونده (فاز ۱ کامل شد)
  allCancelled: boolean; // همه‌شون CANCELLED شدن (یعنی هیچی خریداری نشد)
  allArrived: boolean; // فاز ۲ هم برای همه کامل شد -- هیچ قلمی PURCHASED/AWAITING_CUSTOMER_DECISION نمونده
};

// وضعیت‌های نهاییِ فاز ۲ (یا کنسلیِ فاز ۱) -- یعنی دیگه اقدام ادمین/مشتری روی
// این قلم لازم نیست
const TERMINAL = new Set(["CANCELLED", "RECEIVED", "LOST", "WRONG_SIZE", "WRONG_COLOR", "ISSUE_OTHER"]);
const PURCHASED_LIKE = new Set([
  "PURCHASED",
  "RECEIVED",
  "LOST",
  "WRONG_SIZE",
  "WRONG_COLOR",
  "ISSUE_OTHER",
  "AWAITING_CUSTOMER_DECISION",
]);

export function computePurchaseSummary(items: PurchaseTrackedItem[]): PurchaseSummary {
  const external = items.filter((i) => i.source === "TRENDYOL");
  const total = external.length;
  const purchased = external.filter((i) => PURCHASED_LIKE.has(i.purchaseStatus)).length;
  const cancelled = external.filter((i) => i.purchaseStatus === "CANCELLED").length;
  const pending = total - purchased - cancelled;
  return {
    total,
    purchased,
    cancelled,
    pending,
    allResolved: pending === 0,
    allCancelled: total > 0 && cancelled === total,
    allArrived: total > 0 && external.every((i) => TERMINAL.has(i.purchaseStatus)),
  };
}

export const PURCHASE_OUTCOME_LABELS: Record<string, string> = {
  RECEIVED: "رسید",
  LOST: "گم شد",
  WRONG_SIZE: "سایز اشتباه ارسال شد",
  WRONG_COLOR: "رنگ اشتباه ارسال شد",
  ISSUE_OTHER: "مشکل دیگر",
};

// بعد از هر تغییرِ وضعیتِ فاز ۲ (resolve یا mismatch-decision)، اگه با همین
// تغییر همه‌ی اقلامِ خارجیِ سفارش به یه نتیجه‌ی نهایی رسیده باشن، یه پیام
// جمع‌بندی برای مشتری ثبت می‌کنیم -- چون این دقیقاً لحظه‌ایه که همه‌چی برای
// محاسبه‌ی هزینه‌ی ارسال نهایی آماده شده. این تابع idempotent نیست به‌خودی‌خود،
// ولی چون هر قلم فقط یه‌بار وارد وضعیت نهایی می‌شه (گاردِ status توی هر route)،
// این شرط توی کل عمرِ یه سفارش دقیقاً یه‌بار true می‌شه
export async function notifyIfAllArrived(
  tx: Prisma.TransactionClient,
  order: { id: string; status: OrderStatus },
  items: PurchaseTrackedItem[]
): Promise<{ allArrived: boolean; message: string | null }> {
  const summary = computePurchaseSummary(items);
  if (!summary.allArrived) return { allArrived: false, message: null };

  const message =
    summary.cancelled === 0
      ? `🎉 همه‌ی اقلام سفارش #${order.id.slice(-8)} به انبار ما رسید و بررسی شد -- به‌زودی هزینه‌ی ارسال نهایی مشخص می‌شه`
      : `بررسی همه‌ی اقلام سفارش #${order.id.slice(-8)} تموم شد -- به‌زودی هزینه‌ی ارسال نهایی مشخص می‌شه`;

  await tx.orderStatusHistory.create({
    data: { orderId: order.id, status: order.status, note: message },
  });

  return { allArrived: true, message };
}
