// قانون لغو سفارش توسط مشتری (Gherkin: 14-cancellation-rules.feature) --
// این تابع خالصِ تصمیم‌گیریِ «مشتری الان با دکمه‌ی لغو چه کاری می‌تونه بکنه» رو
// جدا از route نگه می‌داره تا هم سرور و هم تست‌ها از یه منطق واحد استفاده کنن.
//
// دو تجربه‌ی متفاوت وجود داره:
//  - سفارش خالص مزون: لغو مستقیم -- فقط قبل از ارسال (SHIPPED/DELIVERED) ممکنه
//  - سفارش حاوی کالای خارجی: همیشه فقط «درخواست لغو» که ادمین تأیید/ردش می‌کنه.
//    چون ادمین ممکنه الان در حال خریدِ واقعی از فروشنده باشه (حتی اگه هنوز هیچ
//    قلمی PURCHASED نشده و فقط پول تسویه شده)، لغو خودسرانه‌ی مشتری نمی‌تونه
//    اتفاق بیفته. ولی وقتی خریدِ واقعی شروع شده (حداقل یه قلم PURCHASED یا
//    بعدترش)، حتی درخواست لغو هم بی‌معنی می‌شه -- کلاً قفل می‌مونه.
export type CancellationPolicyInput = {
  hasExternalItems: boolean;
  paymentStatus: string | null;
  status: string | null;
  // وضعیت خرید اقلام خارجی (purchaseStatus هریک از order.itemها) -- فقط برای
  // تصمیم «آیا خریدِ واقعی شروع شده»؛ سفارش‌های مزون/بدون قلم این رو خالی می‌دن
  itemPurchaseStatuses?: string[];
};

// direct  = دکمه‌ی لغو مستقیم نمایش داده می‌شه (سفارش مزون قبل از ارسال)
// request = فقط «درخواست لغو» با تأیید ادمین (سفارش حاوی کالای خارجی)
// blocked = هیچ گزینه‌ای نیست
export type CancellationPolicyResult =
  | { mode: "direct" }
  | { mode: "request" }
  | { mode: "blocked"; message: string };

// این وضعیت‌ها یعنی ادمین واقعاً خرید کرده یا پول قلم صرف شده (یا در جریان
// تصمیم/رسید چندفازی است). هرکدوم از این‌ها باشه یعنی «در صف خرید» گذشته و
// لغو -- حتی به شکل درخواست -- دیگه ممکن نیست.
export const PURCHASE_STARTED_STATUSES = new Set([
  "PURCHASED",
  "RECEIVED",
  "LOST",
  "WRONG_SIZE",
  "WRONG_COLOR",
  "ISSUE_OTHER",
  "AWAITING_CUSTOMER_DECISION",
]);

export function canCustomerCancelOrder(
  input: CancellationPolicyInput
): CancellationPolicyResult {
  const { hasExternalItems, paymentStatus, status, itemPurchaseStatuses } = input;

  // دفاع لایه‌ی دوم -- صرف‌نظر از این‌که paymentStatus/purchaseStatus چی
  // می‌گن، سفارشی که واقعاً ارسال/تحویل/مرجوع شده دیگه به هیچ شکلی (نه مستقیم،
  // نه درخواستی) قابل لغو نیست. این نباید فقط به itemPurchaseStatuses تکیه
  // کنه چون اون فیلد در عمل ممکنه با وضعیت واقعی ارسال همگام نمونده باشه
  if (status === "SHIPPED" || status === "DELIVERED" || status === "RETURNED") {
    return { mode: "blocked", message: "سفارش ارسال‌شده قابل لغو نیست" };
  }

  // سفارش حاوی کالای خارجی
  if (hasExternalItems) {
    // هنوز پول اقلام واریز نشده (PENDING/AWAITING_PAYMENT/AWAITING_VERIFICATION
    // و حتی FAILED) -- هیچ ریسکی برای ادمین نداره، پس مثل مزون مستقیم قابل لغوئه
    if (paymentStatus !== "PAID") {
      return { mode: "direct" };
    }

    // پول واریز شده (PAID) -- حالا خریدِ واقعی ممکنه هر لحظه شروع بشه، پس لغو
    // فقط به شکل «درخواست» با تأیید ادمین ممکنه. ولی اگه خریدِ واقعی شروع شده
    // (حداقل یه قلم PURCHASED) یا وضعیت اقلام نامعلومه، حتی درخواست هم نمی‌پذیریم.
    if (itemPurchaseStatuses === undefined) {
      return {
        mode: "blocked",
        message:
          "چون این سفارش کالای خارجی دارد و وضعیت خرید اقلامش مشخص نیست، فعلاً قابل لغو نیست. با پشتیبانی در میان بگذارید.",
      };
    }

    const purchaseStarted = itemPurchaseStatuses.some((s) =>
      PURCHASE_STARTED_STATUSES.has(s)
    );
    if (purchaseStarted) {
      return {
        mode: "blocked",
        message:
          "چون خریدِ واقعی این سفارش از فروشنده شروع شده و به‌صورت تک‌به‌تک در جریانه، کل سفارش (حتی اگه شامل کالای مزون هم باشه) دیگه قابل لغو نیست. بعد از دریافت می‌تونید درخواست مرجوعی ثبت کنید.",
      };
    }

    // PAID ولی هنوز در «صف خرید» -- فقط درخواست لغو با تأیید ادمین
    return { mode: "request" };
  }

  // سفارش خالص مزون -- لغو مستقیم، فقط قبل از ارسال (چک SHIPPED/DELIVERED/RETURNED
  // بالاتر و مشترک بین هر دو حالت انجام شد)
  return { mode: "direct" };
}