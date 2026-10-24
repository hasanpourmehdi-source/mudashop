import { prisma } from "@/lib/prisma";

import { SITE_SETTING_KEYS } from "@/lib/siteSettingKeys";

export { SITE_SETTING_KEYS };

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
  [SITE_SETTING_KEYS.SKIP_ADMIN_REVIEW]: "false",
  [SITE_SETTING_KEYS.SKIP_PAYMENT_VERIFICATION]: "false",
  [SITE_SETTING_KEYS.SKIP_SHIPPING_CALCULATION]: "false",
  [SITE_SETTING_KEYS.LOW_STOCK_ALERT_ENABLED]: "false",
  [SITE_SETTING_KEYS.LOW_STOCK_ALERT_THRESHOLD]: "5",
  [SITE_SETTING_KEYS.ALERT_RETURN_REVIEW_WARN_H]: "30",
  [SITE_SETTING_KEYS.ALERT_RETURN_REVIEW_ALERT_H]: "50",
  [SITE_SETTING_KEYS.CARGO_RATE_PER_KG]: "0",
  [SITE_SETTING_KEYS.REASSURANCE_PING_AFTER_H]: "48",
  [SITE_SETTING_KEYS.PAYMENT_DEADLINE_H]: "48",
  [SITE_SETTING_KEYS.ABANDONED_CART_AFTER_H]: "24",
  [SITE_SETTING_KEYS.ABANDONED_CART_STAGE2_H]: "72",
  [SITE_SETTING_KEYS.ABANDONED_CART_STAGE3_H]: "168",
  [SITE_SETTING_KEYS.REFERRAL_REWARD_AMOUNT]: "50000",
  [SITE_SETTING_KEYS.POSTER_CURRENCY_TEXT]: "نرخ ارز روزانه و\nهزینه ارسال هوایی",
  [SITE_SETTING_KEYS.MIN_DISCOUNT_PERCENT_TO_SHOW]: "2",
  [SITE_SETTING_KEYS.SOCIAL_PROOF_WINDOW_MINUTES]: "10",
  [SITE_SETTING_KEYS.SOCIAL_PROOF_MIN_COUNT]: "2",
  [SITE_SETTING_KEYS.CROSS_SELL_MAX_ITEMS]: "4",
  [SITE_SETTING_KEYS.CLIENT_POLL_INTERVAL_SECONDS]: "30",
  [SITE_SETTING_KEYS.TRENDYOL_STALE_FALLBACK_HOURS]: "24",
  [SITE_SETTING_KEYS.ABOUT_TEXT]:
    "مُداشاپ فروشگاه آنلاین پوشاک و مد است. علاوه بر محصولات اختصاصی خودمان (مزون)، امکان سفارش مستقیم از کاتالوگ ترندیول و میلا را هم فراهم کرده‌ایم؛ یعنی می‌توانید بدون دردسر گمرک و واسطه، محصولات این دو سایت را هم از همین‌جا سفارش دهید.\n\nتیم ما هر سفارش خارجی را به‌صورت دستی و با دقت پیگیری می‌کند تا کالای درست، با کیفیت درست، به دستتان برسد.",
  [SITE_SETTING_KEYS.TERMS_TEXT]:
    "۱. ثبت سفارش در مُداشاپ به معنای پذیرش این قوانین است.\n۲. پرداخت به‌صورت کارت‌به‌کارت انجام می‌شود؛ بعد از واریز، تصویر رسید را در همان صفحه‌ی سفارش بارگذاری کنید تا ادمین بررسی کند.\n۳. برای کالاهای خارجی (ترندیول/میلا)، هزینه‌ی ارسال/باربری واقعی معمولاً بعد از خرید و وزن‌کشی نهایی مشخص می‌شود.\n۴. در صورت نبود کالا یا مغایرت (سایز/رنگ اشتباه، آسیب در حمل)، مطابق «قوانین مرجوعی» مبلغ به کیف پول شما بازگردانده می‌شود.\n۵. مُداشاپ حق دارد در صورت مغایرت آشکار قیمت (خطای فنی) سفارش را قبل از پرداخت لغو و اطلاع‌رسانی کند.",
  [SITE_SETTING_KEYS.PRIVACY_TEXT]:
    "مُداشاپ اطلاعات هویتی (نام، آدرس، شماره تماس) و اطلاعات سفارش شما را فقط برای پردازش و ارسال سفارش، و اطلاع‌رسانی درباره‌ی وضعیت آن استفاده می‌کند.\n\nاین اطلاعات با هیچ شخص ثالثی جز آنچه برای ارسال کالا (شرکت‌های پستی/باربری) لازم است، به اشتراک گذاشته نمی‌شود. رمز عبور حساب شما به‌صورت هش‌شده ذخیره می‌شود و حتی تیم مُداشاپ هم به آن دسترسی ندارد.\n\nدر صورت تمایل به حذف کامل اطلاعات حساب خود، از طریق پشتیبانی با ما در ارتباط باشید.",
  [SITE_SETTING_KEYS.FAQ_TEXT]:
    "س: چطور پرداخت کنم؟\nج: بعد از ثبت سفارش، شماره کارت نمایش داده می‌شود؛ واریز کنید و تصویر رسید را در همان صفحه بارگذاری کنید.\n\nس: خریدهای ترندیول/میلا چقدر طول می‌کشد؟\nج: چون این کالاها بعد از سفارش شما از سایت اصلی خریداری می‌شوند، معمولاً کمی بیشتر از کالاهای مزون طول می‌کشد؛ وضعیت دقیق را در صفحه‌ی سفارش می‌بینید.\n\nس: اگر سایز/رنگ اشتباه بود چه؟\nج: طبق «قوانین مرجوعی»، هزینه‌ی کالا به کیف پول شما بازگردانده می‌شود.\n\nس: کیف پول برای چیست؟\nج: مبلغ رفاندهای شما (لغو، مرجوعی، پاداش معرفی و...) به کیف پول واریز می‌شود و می‌توانید در خریدهای بعدی از آن استفاده کنید یا درخواست برداشت بدهید.",
  [SITE_SETTING_KEYS.CASH_ON_DELIVERY_ENABLED]: "false",
  [SITE_SETTING_KEYS.NON_RETURNABLE_PRODUCTS_ENABLED]: "false",
  // پیش‌فرض روشن -- رفتارِ فعلی (فرمِ درخواستِ مرجوعیِ خودخدمت) دست‌نخورده می‌مونه
  [SITE_SETTING_KEYS.SELF_SERVICE_RETURN_ENABLED]: "true",
  // پیش‌فرض روشن -- شفافیتِ هزینه/زمانِ ارسال کنارِ دکمه‌ی خرید نشون داده بشه
  [SITE_SETTING_KEYS.SHIPPING_INFO_ENABLED]: "true",
  // پیش‌فرض خاموش -- رفتارِ فعلی (فروش فعال) دست‌نخورده می‌مونه
  [SITE_SETTING_KEYS.SALES_PAUSED_ENABLED]: "false",
  [SITE_SETTING_KEYS.SALES_PAUSED_MESSAGE]:
    "فروش سایت موقتاً متوقف شده است. می‌توانید محصولات را مشاهده کنید؛ برای اطلاعات بیشتر با پشتیبانی در تماس باشید.",
  [SITE_SETTING_KEYS.TRUST_BADGE_1_ENABLED]: "false",
  [SITE_SETTING_KEYS.TRUST_BADGE_1_TEXT]: "ضمانت اصالت کالا",
  [SITE_SETTING_KEYS.TRUST_BADGE_2_ENABLED]: "false",
  [SITE_SETTING_KEYS.TRUST_BADGE_2_TEXT]: "ارسال سریع و مطمئن",
  [SITE_SETTING_KEYS.TRUST_BADGE_3_ENABLED]: "false",
  [SITE_SETTING_KEYS.TRUST_BADGE_3_TEXT]: "۷ روز فرصت بازگشت کالا",
  [SITE_SETTING_KEYS.TRUST_BADGE_4_ENABLED]: "false",
  [SITE_SETTING_KEYS.TRUST_BADGE_4_TEXT]: "ضمانت بازگشت وجه",
  [SITE_SETTING_KEYS.FEATURE_RECOMMENDED]: "true",
  [SITE_SETTING_KEYS.FEATURE_PERSONAL_CATEGORIES]: "true",
  [SITE_SETTING_KEYS.FEATURE_PHOTO_REVIEWS]: "true",
  [SITE_SETTING_KEYS.FEATURE_VIDEO_WALL]: "true",
  [SITE_SETTING_KEYS.FEATURE_BRAND_CAMPAIGNS]: "true",
  [SITE_SETTING_KEYS.FEATURE_TRENDYOL_CAMPAIGNS]: "true",
  [SITE_SETTING_KEYS.FEATURE_TRENDYOL_TOP_DISCOUNTS]: "true",
  [SITE_SETTING_KEYS.FEATURE_TRENDYOL_PRICE_DROPS]: "true",
  [SITE_SETTING_KEYS.FEATURE_TRENDYOL_BEST_SELLING]: "true",
  [SITE_SETTING_KEYS.FEATURE_RECENTLY_VIEWED]: "true",
  [SITE_SETTING_KEYS.FEATURE_DISCOVERABLE_TABS]: "true",
  [SITE_SETTING_KEYS.FEATURE_DISCOUNT_DISCOVERY]: "true",
  [SITE_SETTING_KEYS.FEATURE_QUICK_VIEW]: "true",
  [SITE_SETTING_KEYS.FEATURE_SIZE_MEASUREMENTS]: "true",
  [SITE_SETTING_KEYS.FEATURE_PRODUCT_REVIEWS]: "true",
  [SITE_SETTING_KEYS.FEATURE_PRODUCT_QA]: "true",
  [SITE_SETTING_KEYS.FEATURE_SHOPPING_ASSISTANT]: "true",
  [SITE_SETTING_KEYS.FEATURE_SUPPORT_CHAT]: "true",
  [SITE_SETTING_KEYS.FEATURE_COMPARE]: "true",
  [SITE_SETTING_KEYS.FEATURE_REVIEW_NUDGE]: "true",
  [SITE_SETTING_KEYS.FEATURE_DEFECTIVE_ITEMS]: "true",
  [SITE_SETTING_KEYS.FEATURE_OCCASION_COLLECTIONS]: "true",
  [SITE_SETTING_KEYS.FEATURE_CHEAPER_PRICE_REPORT]: "true",
  [SITE_SETTING_KEYS.FEATURE_FREQUENTLY_BOUGHT_TOGETHER]: "true",
  // این مقادیر دقیقاً همون پیش‌فرض‌هایی‌ان که قبلاً هاردکد بودن -- یعنی اضافه‌شدنِ
  // این تنظیمات، رفتارِ فعلیِ زنده‌ی قابلیتِ کسراژِ وفاداری رو دست‌نخورده نگه می‌داره
  [SITE_SETTING_KEYS.LOYALTY_CASHBACK_ENABLED]: "true",
  [SITE_SETTING_KEYS.LOYALTY_CASHBACK_PERCENT]: "2",
  [SITE_SETTING_KEYS.LOYALTY_TOMAN_PER_POINT]: "10000",
  [SITE_SETTING_KEYS.LOYALTY_SILVER_MIN_POINTS]: "500",
  [SITE_SETTING_KEYS.LOYALTY_SILVER_BONUS_PERCENT]: "1",
  [SITE_SETTING_KEYS.LOYALTY_GOLD_MIN_POINTS]: "2000",
  [SITE_SETTING_KEYS.LOYALTY_GOLD_BONUS_PERCENT]: "2",
  [SITE_SETTING_KEYS.LOYALTY_SILVER_FREE_SHIPPING]: "false",
  [SITE_SETTING_KEYS.LOYALTY_GOLD_FREE_SHIPPING]: "false",
  [SITE_SETTING_KEYS.EMAIL_PROVIDER]: "resend",
  [SITE_SETTING_KEYS.EMAIL_PROVIDER_API_KEY]: "",
  [SITE_SETTING_KEYS.EMAIL_PROVIDER_FROM_ADDRESS]: "",
  [SITE_SETTING_KEYS.SMTP_HOST]: "",
  [SITE_SETTING_KEYS.SMTP_PORT]: "587",
  [SITE_SETTING_KEYS.SMTP_SECURE]: "false",
  [SITE_SETTING_KEYS.SMTP_USER]: "",
  [SITE_SETTING_KEYS.SMTP_PASSWORD]: "",
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

export async function getSiteSettingBool(key: string): Promise<boolean> {
  return (await getSiteSetting(key)) === "true";
}

// نوارِ بج‌های اعتماد -- ۴ بج ثابت (آیکنِ هرکدوم ثابته)، هرکدوم جدا از تنظیمات
// روشن/خاموش می‌شه و متنش دلخواهِ ادمینه. قبلاً فقط توی layout.tsx (فوتر) بود؛
// این‌جا استخراج شده تا صفحه‌ی محصول/چک‌اوت هم بتونن همون بج‌ها رو (بدونِ
// تعریفِ دوباره‌ی منطق) نزدیکِ دکمه‌ی خرید نشون بدن -- طبقِ درخواستِ صریح،
// چون فوتر معمولاً دیده نمی‌شه/اسکرول‌نشده می‌مونه
export async function fetchTrustBadges(): Promise<{ icon: string; text: string }[]> {
  const settings = await getSiteSettings([
    SITE_SETTING_KEYS.TRUST_BADGE_1_ENABLED,
    SITE_SETTING_KEYS.TRUST_BADGE_1_TEXT,
    SITE_SETTING_KEYS.TRUST_BADGE_2_ENABLED,
    SITE_SETTING_KEYS.TRUST_BADGE_2_TEXT,
    SITE_SETTING_KEYS.TRUST_BADGE_3_ENABLED,
    SITE_SETTING_KEYS.TRUST_BADGE_3_TEXT,
    SITE_SETTING_KEYS.TRUST_BADGE_4_ENABLED,
    SITE_SETTING_KEYS.TRUST_BADGE_4_TEXT,
  ]);
  const TRUST_BADGE_ICONS = ["🛡️", "🚚", "↩️", "💰"];
  return [1, 2, 3, 4]
    .filter((n) => settings[`trustBadge${n}Enabled`] === "true")
    .map((n) => ({ icon: TRUST_BADGE_ICONS[n - 1], text: settings[`trustBadge${n}Text`] }));
}
