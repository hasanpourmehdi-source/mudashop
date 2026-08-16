import { prisma } from "@/lib/prisma";

// متن‌های عمومی سایت که ادمین از پنل می‌تونه ویرایش کنه -- برای هرکدوم یه کلید ثابت
// و یه مقدار پیش‌فرض تعریف می‌کنیم؛ اگه هنوز توی دیتابیس ذخیره نشده باشه، همون پیش‌فرض برمی‌گرده
export const SITE_SETTING_KEYS = {
  RETURN_POLICY_TEXT: "returnPolicyText",
  // آستانه‌های هشدار سفارش‌های گیرکرده (به ساعت) -- هر مرحله دو آستانه دارد:
  // «نیمه‌هشدار» (زرد) و «هشدار» (قرمز)، برای داشبورد ادمین
  ALERT_FIRST_REVIEW_WARN_H: "alertFirstReviewWarnHours",
  ALERT_FIRST_REVIEW_ALERT_H: "alertFirstReviewAlertHours",
  ALERT_ITEM_PAYMENT_REVIEW_WARN_H: "alertItemPaymentReviewWarnHours",
  ALERT_ITEM_PAYMENT_REVIEW_ALERT_H: "alertItemPaymentReviewAlertHours",
  ALERT_SHIPPING_PAYMENT_REVIEW_WARN_H: "alertShippingPaymentReviewWarnHours",
  ALERT_SHIPPING_PAYMENT_REVIEW_ALERT_H: "alertShippingPaymentReviewAlertHours",
  ALERT_AWAITING_PURCHASE_WARN_H: "alertAwaitingPurchaseWarnHours",
  ALERT_AWAITING_PURCHASE_ALERT_H: "alertAwaitingPurchaseAlertHours",
  ALERT_ADMIN_ITEMS_REVIEW_WARN_H: "alertAdminItemsReviewWarnHours",
  ALERT_ADMIN_ITEMS_REVIEW_ALERT_H: "alertAdminItemsReviewAlertHours",
  ALERT_SHIPPED_TOO_LONG_WARN_H: "alertShippedTooLongWarnHours",
  ALERT_SHIPPED_TOO_LONG_ALERT_H: "alertShippedTooLongAlertHours",
  ALERT_RETURN_REVIEW_WARN_H: "alertReturnReviewWarnHours",
  ALERT_RETURN_REVIEW_ALERT_H: "alertReturnReviewAlertHours",
  // آخرین نرخ باربری (تومان به ازای هر کیلوگرم) که ادمین وارد کرده -- فقط
  // به‌عنوان مقدار پیش‌فرضِ فرم بعدی استفاده می‌شه، نه یه قانون قطعی/مخفی؛
  // همیشه توی فرم دیده و قابل‌ویرایشه چون یه پارامتر مالی واقعیه که عوض می‌شه
  CARGO_RATE_PER_KG: "cargoRatePerKg",
  // بعد از چند ساعت بی‌حرکتی توی هر مرحله، یه پیام دلگرم‌کننده‌ی خودکار برای
  // مشتری ثبت بشه («هنوز در جریانه»)
  REASSURANCE_PING_AFTER_H: "reassurancePingAfterHours",
} as const;

export const SITE_SETTING_DEFAULTS: Record<string, string> = {
  [SITE_SETTING_KEYS.RETURN_POLICY_TEXT]:
    "درخواست مرجوع کردن کالا با دلایل انصراف از خرید تنها در صورتی مورد قبول است که کالا در شرایط اولیه باشد و در صورت پلمپ بودن، پلمپ نباید باز شده باشد — تا ۷ روز از تحویل سفارش.",
  [SITE_SETTING_KEYS.ALERT_FIRST_REVIEW_WARN_H]: "2",
  [SITE_SETTING_KEYS.ALERT_FIRST_REVIEW_ALERT_H]: "6",
  [SITE_SETTING_KEYS.ALERT_ITEM_PAYMENT_REVIEW_WARN_H]: "12",
  [SITE_SETTING_KEYS.ALERT_ITEM_PAYMENT_REVIEW_ALERT_H]: "24",
  [SITE_SETTING_KEYS.ALERT_SHIPPING_PAYMENT_REVIEW_WARN_H]: "12",
  [SITE_SETTING_KEYS.ALERT_SHIPPING_PAYMENT_REVIEW_ALERT_H]: "24",
  [SITE_SETTING_KEYS.ALERT_AWAITING_PURCHASE_WARN_H]: "24",
  [SITE_SETTING_KEYS.ALERT_AWAITING_PURCHASE_ALERT_H]: "48",
  [SITE_SETTING_KEYS.ALERT_ADMIN_ITEMS_REVIEW_WARN_H]: "12",
  [SITE_SETTING_KEYS.ALERT_ADMIN_ITEMS_REVIEW_ALERT_H]: "24",
  [SITE_SETTING_KEYS.ALERT_SHIPPED_TOO_LONG_WARN_H]: "72",
  [SITE_SETTING_KEYS.ALERT_SHIPPED_TOO_LONG_ALERT_H]: "120",
  [SITE_SETTING_KEYS.ALERT_RETURN_REVIEW_WARN_H]: "24",
  [SITE_SETTING_KEYS.ALERT_RETURN_REVIEW_ALERT_H]: "48",
  [SITE_SETTING_KEYS.CARGO_RATE_PER_KG]: "0",
  [SITE_SETTING_KEYS.REASSURANCE_PING_AFTER_H]: "48",
};

export async function getSiteSetting(key: string): Promise<string> {
  const row = await prisma.siteSetting.findUnique({ where: { key } });
  return row?.value ?? SITE_SETTING_DEFAULTS[key] ?? "";
}

export async function getSiteSettings(keys: string[]): Promise<Record<string, string>> {
  const rows = await prisma.siteSetting.findMany({ where: { key: { in: keys } } });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const result: Record<string, string> = {};
  for (const key of keys) {
    result[key] = map.get(key) ?? SITE_SETTING_DEFAULTS[key] ?? "";
  }
  return result;
}
