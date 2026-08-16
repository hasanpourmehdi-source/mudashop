// پیام اطلاع‌رسانی به مشتری برای هر مرحله -- مشتری باید از همه‌ی مراحل سفارشش
// مطلع باشه تا اعتمادش جلب بشه. PENDING عمداً نداره (حالت پیش‌فرض، نه یه پیشرفت واقعی).
// هم موقع تغییر دستی وضعیت توسط ادمین (PATCH /api/admin/orders/[id]) و هم موقع
// گذار خودکار PENDING->PROCESSING (باز کردن سفارش توسط ادمین) استفاده می‌شه --
// یه‌جا نگه داشتنش تا متن پیام هرجا یکسان بمونه
export const ORDER_STATUS_NOTIFICATION_MESSAGES: Partial<Record<string, string>> = {
  PROCESSING: "سفارش شما در حال پردازش است.",
  SHIPPED: "سفارش شما ارسال شد.",
  DELIVERED: "سفارش شما تحویل داده شد.",
  CANCELLED: "سفارش شما لغو شد.",
  RETURNED: "سفارش شما مرجوع شد.",
};

// برچسبی که مشتری برای وضعیت «در حال پردازش» می‌بینه، بسته به زیرمرحله‌ی
// paymentStatus فرق می‌کنه -- وگرنه مشتری نمی‌فهمه این «پردازش» دقیقاً یعنی
// چی (هنوز بررسی نشده؟ منتظر پرداخت خودشه؟ فیشش زیر بررسیه؟ یا الان واقعاً
// داره آماده می‌شه):
//  - AWAITING_PAYMENT: ادمین کارت/هزینه رو فرستاده، منتظر واریز مشتریه
//  - AWAITING_VERIFICATION: فیش رفته، منتظر تأیید ادمینه
//  - PAID: برای سفارش خارجی یعنی ادمین داره واقعاً از جای دیگه (مثلاً
//    ترندیول) می‌خره («در صف خرید»)؛ برای سفارش خالص مزون هیچ خرید/باربریِ
//    جداگانه‌ای در کار نیست (کالا از قبل توی انبار خودمونه)، فقط داره
//    بسته‌بندی/آماده‌سازی می‌شه («در حال آماده‌سازی سفارش»)
export function customerOrderStatusLabel(
  status: string,
  paymentStatus: string,
  fallback: string,
  hasExternalItems: boolean
): string {
  if (status !== "PROCESSING") return fallback;
  if (paymentStatus === "AWAITING_PAYMENT") return "منتظر پرداخت مشتری";
  if (paymentStatus === "AWAITING_VERIFICATION") return "در انتظار تأیید فیش";
  if (paymentStatus === "PAID") return hasExternalItems ? "در صف خرید" : "در حال آماده‌سازی سفارش";
  return fallback;
}

// برچسب مشتری‌محورِ وضعیتِ پرداختِ دورِ دومِ سفارش‌های خارجی (هزینه ارسال+باربری).
// AWAITING_PAYMENT یعنی ادمین هزینه رو تعیین کرده و منتظر واریز مشتریه؛
// AWAITING_VERIFICATION یعنی فیش هزینه باربری ارسال شده -- ازین به بعد کالا در
// حال وزن‌کشی/آماده‌سازیه، نه صرفاً «منتظر تأیید»؛ PAID یعنی همه‌چیز تسویه شده و
// بسته الان توی صف ارسال قرار گرفته -- مشتری باید بفهمه «در حال پردازش» دقیقاً
// یعنی چی، نه یه برچسب مبهم یکسان توی هر مرحله
export function shippingPaymentStatusLabel(status: string): string {
  switch (status) {
    case "AWAITING_PAYMENT":
      return "منتظر تسویه باربری";
    case "AWAITING_VERIFICATION":
      return "در حال وزن‌کشی";
    case "PAID":
      return "در صف ارسال";
    case "FAILED":
      return "پرداخت باربری رد شده";
    default:
      return status;
  }
}

// همین برچسب‌های «در حال ...» وقتی مرحله‌ش دیگه مرحله‌ی فعلی سفارش نیست (رد
// شده -- چه توی تایم‌لاین چه توی تاریخچه‌ی وضعیت) باید فعلشون گذشته بشه، نه
// اینکه انگار هنوز داره اتفاق می‌افته. این‌جا فقط متنِ حال رو می‌گیره و معادل
// گذشته‌شو برمی‌گردونه -- بدون نیاز به بازسازی منطق تشخیص مرحله
const PAST_TENSE_LABELS: Record<string, string> = {
  "در انتظار پردازش": "پردازش شد",
  "در حال پردازش": "پردازش شد",
  "در صف خرید": "خریده شد",
  "در حال آماده‌سازی سفارش": "آماده‌سازی شد",
  "در صف ارسال": "ارسال شد",
  "ارسال شده": "ارسال شد",
  "تحویل داده شده": "تحویل داده شد",
};

export function pastTenseOrderLabel(presentLabel: string): string {
  return PAST_TENSE_LABELS[presentLabel] ?? presentLabel;
}
