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
  allVoided: boolean; // همه‌شون یا نشد خریداری بشن یا با مشکل/مغایرت رفاند شدن -- هیچی به دستِ مشتری نرسید
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
// نتیجه‌های نهاییِ «رفاندی» -- یعنی این قلم هیچ‌وقت به دستِ مشتری نرسید (نه
// خریداری نشد، نه رسید، نه مشتری با مغایرتش موافقت کرد). WRONG_SIZE/WRONG_COLOR
// این‌جا یعنی مشتری صراحتاً رفاند رو انتخاب کرده (چون اگه KEEP می‌کرد،
// purchaseStatus به RECEIVED تبدیل می‌شد، نه این‌که همون‌جا بمونه)
const VOID_STATUSES = new Set(["CANCELLED", "LOST", "WRONG_SIZE", "WRONG_COLOR", "ISSUE_OTHER"]);

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
    allVoided: total > 0 && external.every((i) => VOID_STATUSES.has(i.purchaseStatus)),
  };
}

export const PURCHASE_OUTCOME_LABELS: Record<string, string> = {
  RECEIVED: "رسید",
  LOST: "گم شد",
  WRONG_SIZE: "سایز اشتباه ارسال شد",
  WRONG_COLOR: "رنگ اشتباه ارسال شد",
  ISSUE_OTHER: "مشکل دیگر",
};

// برای ترندیول، یه سفارش ممکنه به‌صورت چند بسته‌ی جداگانه ارسال بشه (کد رهگیری
// جدا یا اقلام در زمان‌های متفاوط خریداری/تحویل شوند). در این حالت دو حالت
// «پیشروی جزئی» و «تحویل جزئی» معنادار می‌شه:
//  - partialPurchase = بعضی خریداری شدن / رسیده‌اند ولی هنوز بعضی PENDING/CANCELLED
//  - partialDelivery = حداقل یه قلم دریافت یا تحویل داده شده ولی هنوز نه‌همه
// این توابع فقط روی خلاصه‌ی purchaseStatusها محاسبه می‌شن؛ تعداد بسته‌ها/کدهای
// رهگیری دقیقاً در لایه‌ی UI (parseTrackingCodes) محاسبه می‌شه
export function isPartialPurchase(summary: PurchaseSummary): boolean {
  return summary.total > 0 && summary.purchased > 0 && !summary.allResolved;
}

export function isPartialDelivery(summary: PurchaseSummary, shipped: boolean): boolean {
  // اگر کل سفارش تحویل داده نشده باشد ولی بعضی اقلام حداقل خریداری/دریافت
  // شده باشند → «تحویل جزئی» ممکن است در آینده/در جریان باشد
  return shipped && isPartialPurchase(summary);
}


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

// وقتی همه‌ی اقلامِ خارجیِ یه سفارشِ کاملاً-خارجی (بدون هیچ کالای مزون) به یه
// نتیجه‌ی «رفاندی» می‌رسن -- چه فاز ۱ (نتونستیم بخریم) چه فاز ۲ (گم شد، یا
// مغایرتی که مشتری رفاندش رو ترجیح داد) -- دیگه هیچی برای ارسال باقی نمونده،
// پس کل سفارش باید لغو بشه. قبلاً این کشکسانی فقط برای حالتِ اولِ (همه‌شون
// دقیقاً CANCELLED فاز-۱) چک می‌شد؛ سفارشی که تنها قلمش خریداری شد ولی بعداً
// گم شد یا مشتری رفاندِ مغایرتش رو خواست، برای همیشه توی PROCESSING/AWAITING_PURCHASE
// می‌موند چون هیچ‌جا Order.status=CANCELLED نمی‌شد.
//
// از هر سه routeی که یه قلم رو به نتیجه‌ی نهایی می‌رسونه صدا زده می‌شه:
// cancel-purchase، resolve، mismatch-decision -- طبیعتاً idempotent چون هر
// قلم فقط یه‌بار به وضعیتِ نهایی می‌رسه (گاردِ status توی هر route)، پس
// شرطِ allVoided توی کل عمرِ سفارش دقیقاً یه‌بار از false به true می‌ره
export async function cascadeCancelIfAllVoided(
  tx: Prisma.TransactionClient,
  order: { id: string; status: OrderStatus; couponCode: string | null },
  items: PurchaseTrackedItem[]
): Promise<boolean> {
  const wholeOrderIsExternalOnly = items.every((i) => i.source === "TRENDYOL");
  const summary = computePurchaseSummary(items);
  if (!wholeOrderIsExternalOnly || !summary.allVoided || order.status === "CANCELLED") {
    return false;
  }

  if (order.couponCode) {
    await tx.coupon.updateMany({
      where: { code: order.couponCode, usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
  }
  await tx.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
  await tx.orderStatusHistory.create({
    data: {
      orderId: order.id,
      status: "CANCELLED",
      note: "هیچ‌کدوم از اقلام این سفارش نهایتاً به دست مشتری نرسید (خریداری نشد، گم شد یا مغایرت داشت و رفاند شد) -- کل سفارش لغو شد",
    },
  });
  return true;
}
