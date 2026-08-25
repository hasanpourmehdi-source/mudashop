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
  // مهلت پرداخت: از زمان ورود سفارش به «در انتظار پرداخت/تأیید فیش» این ساعت
  // بعد اگر مشتری هنوز واریز نکرده باشد، سفارش به‌صورت خودکار لغو می‌شود
  PAYMENT_DEADLINE_H: "paymentDeadlineHours",
  // بعد از چند ساعت بی‌حرکتی در سبد خرید (و هنوز سفارش ثبت نشده)، یادآوری فرستاده شود
  ABANDONED_CART_AFTER_H: "abandonedCartAfterHours",
  // پاداش کد معرفی -- وقتی اولین سفارشِ پرداخت‌شده‌ی کاربر معرفی‌شده ثبت شود، این مبلغ (تومان) به کیف‌پول معرف اضافه می‌شود
  REFERRAL_REWARD_AMOUNT: "referralRewardAmount",
  // متنِ باکسِ بنفشِ «نرخ ارز روزانه...» روی پوسترِ اینستاگرام -- چند خط با \n جدا می‌شن
  POSTER_CURRENCY_TEXT: "posterCurrencyText",
  // صفحه‌های اطلاعاتی/قانونی -- هر کدوم توی یه صفحه‌ی مستقل نشون داده می‌شن
  // (/about، /terms، /privacy، /faq) و از پنل ادمین قابل‌ویرایش‌اند
  ABOUT_TEXT: "aboutText",
  TERMS_TEXT: "termsText",
  PRIVACY_TEXT: "privacyText",
  FAQ_TEXT: "faqText",
} as const;

export const SITE_SETTING_DEFAULTS: Record<string, string> = {
  [SITE_SETTING_KEYS.RETURN_POLICY_TEXT]:
    "درخواست مرجوع کردن کالا با دلایل انصراف از خرید تنها در صورتی مورد قبول است که کالا در شرایط اولیه باشد و در صورت پلمپ شدن، پلمپ نباید باز شده باشد — تا ۷ روز از تحویل سفارش.",
  [SITE_SETTING_KEYS.ALERT_FIRST_REVIEW_WARN_H]: "3",
  [SITE_SETTING_KEYS.ALERT_FIRST_REVIEW_ALERT_H]: "7",
  [SITE_SETTING_KEYS.ALERT_ITEM_PAYMENT_REVIEW_WARN_H]: "15",
  [SITE_SETTING_KEYS.ALERT_ITEM_PAYMENT_REVIEW_ALERT_H]: "25",
  [SITE_SETTING_KEYS.ALERT_SHIPPING_PAYMENT_REVIEW_WARN_H]: "15",
  [SITE_SETTING_KEYS.ALERT_SHIPPING_PAYMENT_REVIEW_ALERT_H]: "25",
  [SITE_SETTING_KEYS.ALERT_AWAITING_PURCHASE_WARN_H]: "30",
  [SITE_SETTING_KEYS.ALERT_AWAITING_PURCHASE_ALERT_H]: "50",
  [SITE_SETTING_KEYS.ALERT_ADMIN_ITEMS_REVIEW_WARN_H]: "15",
  [SITE_SETTING_KEYS.ALERT_ADMIN_ITEMS_REVIEW_ALERT_H]: "25",
  [SITE_SETTING_KEYS.ALERT_SHIPPED_TOO_LONG_WARN_H]: "90",
  [SITE_SETTING_KEYS.ALERT_SHIPPED_TOO_LONG_ALERT_H]: "130",
  [SITE_SETTING_KEYS.ALERT_RETURN_REVIEW_WARN_H]: "30",
  [SITE_SETTING_KEYS.ALERT_RETURN_REVIEW_ALERT_H]: "50",
  [SITE_SETTING_KEYS.CARGO_RATE_PER_KG]: "0",
  [SITE_SETTING_KEYS.REASSURANCE_PING_AFTER_H]: "48",
  [SITE_SETTING_KEYS.PAYMENT_DEADLINE_H]: "48",
  [SITE_SETTING_KEYS.ABANDONED_CART_AFTER_H]: "24",
  [SITE_SETTING_KEYS.REFERRAL_REWARD_AMOUNT]: "50000",
  [SITE_SETTING_KEYS.POSTER_CURRENCY_TEXT]: "نرخ ارز روزانه و\nهزینه ارسال هوایی",
  [SITE_SETTING_KEYS.ABOUT_TEXT]:
    "مُداشاپ فروشگاه آنلاین پوشاک و مد است. علاوه بر محصولات اختصاصی خودمان (مزون)، امکان سفارش مستقیم از کاتالوگ ترندیول و میلا را هم فراهم کرده‌ایم؛ یعنی می‌توانید بدون دردسر گمرک و واسطه، محصولات این دو سایت را هم از همین‌جا سفارش دهید.\n\nتیم ما هر سفارش خارجی را به‌صورت دستی و با دقت پیگیری می‌کند تا کالای درست، با کیفیت درست، به دستتان برسد.",
  [SITE_SETTING_KEYS.TERMS_TEXT]:
    "۱. ثبت سفارش در مُداشاپ به معنای پذیرش این قوانین است.\n۲. پرداخت به‌صورت کارت‌به‌کارت انجام می‌شود؛ بعد از واریز، تصویر رسید را در همان صفحه‌ی سفارش بارگذاری کنید تا ادمین بررسی کند.\n۳. برای کالاهای خارجی (ترندیول/میلا)، هزینه‌ی ارسال/باربری واقعی معمولاً بعد از خرید و وزن‌کشی نهایی مشخص می‌شود.\n۴. در صورت نبود کالا یا مغایرت (سایز/رنگ اشتباه، آسیب در حمل)، مطابق «قوانین مرجوعی» مبلغ به کیف پول شما بازگردانده می‌شود.\n۵. مُداشاپ حق دارد در صورت مغایرت آشکار قیمت (خطای فنی) سفارش را قبل از پرداخت لغو و اطلاع‌رسانی کند.",
  [SITE_SETTING_KEYS.PRIVACY_TEXT]:
    "مُداشاپ اطلاعات هویتی (نام، آدرس، شماره تماس) و اطلاعات سفارش شما را فقط برای پردازش و ارسال سفارش، و اطلاع‌رسانی درباره‌ی وضعیت آن استفاده می‌کند.\n\nاین اطلاعات با هیچ شخص ثالثی جز آنچه برای ارسال کالا (شرکت‌های پستی/باربری) لازم است، به اشتراک گذاشته نمی‌شود. رمز عبور حساب شما به‌صورت هش‌شده ذخیره می‌شود و حتی تیم مُداشاپ هم به آن دسترسی ندارد.\n\nدر صورت تمایل به حذف کامل اطلاعات حساب خود، از طریق پشتیبانی با ما در ارتباط باشید.",
  [SITE_SETTING_KEYS.FAQ_TEXT]:
    "س: چطور پرداخت کنم؟\nج: بعد از ثبت سفارش، شماره کارت نمایش داده می‌شود؛ واریز کنید و تصویر رسید را در همان صفحه بارگذاری کنید.\n\nس: خریدهای ترندیول/میلا چقدر طول می‌کشد؟\nج: چون این کالاها بعد از سفارش شما از سایت اصلی خریداری می‌شوند، معمولاً کمی بیشتر از کالاهای مزون طول می‌کشد؛ وضعیت دقیق را در صفحه‌ی سفارش می‌بینید.\n\nس: اگر سایز/رنگ اشتباه بود چه؟\nج: طبق «قوانین مرجوعی»، هزینه‌ی کالا به کیف پول شما بازگردانده می‌شود.\n\nس: کیف پول برای چیست؟\nج: مبلغ رفاندهای شما (لغو، مرجوعی، پاداش معرفی و...) به کیف پول واریز می‌شود و می‌توانید در خریدهای بعدی از آن استفاده کنید یا درخواست برداشت بدهید.",
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
