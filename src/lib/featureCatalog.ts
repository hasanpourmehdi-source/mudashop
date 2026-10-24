import { SITE_SETTING_KEYS } from "@/lib/siteSettingKeys";

// رجیستریِ «امکانات فروشگاه» -- هر ردیف یه قابلیتِ اختیاری‌ه که ادمین از
// صفحه‌ی /admin/feature-flags جدا روشن/خاموش می‌کنه. اضافه‌کردنِ قابلیتِ بعدی
// فقط یعنی یه ردیف اینجا + یه کلید توی siteSettings.ts -- نه یه بخشِ JSX دستی
export const FEATURE_CATALOG: { key: string; label: string; description: string; category: string }[] = [
  {
    key: SITE_SETTING_KEYS.FEATURE_RECOMMENDED,
    label: "پیشنهاد برای تو",
    description: "بخشِ توصیه‌گر بر اساس رفتار کاربر (یا پرطرفدارها برای کاربر جدید)، بالای صفحه‌ی اصلی",
    category: "صفحه‌ی اصلی",
  },
  {
    key: SITE_SETTING_KEYS.FEATURE_PERSONAL_CATEGORIES,
    label: "دسته‌بندی‌های ویژه‌ی شما",
    description: "بر اساس ویشلیست و تاریخچه‌ی خرید کاربر",
    category: "صفحه‌ی اصلی",
  },
  {
    key: SITE_SETTING_KEYS.FEATURE_PHOTO_REVIEWS,
    label: "نظرات عکس‌دار محبوب",
    description: "ویترینِ نظراتِ عکس‌دار در صفحه‌ی اصلی",
    category: "صفحه‌ی اصلی",
  },
  {
    key: SITE_SETTING_KEYS.FEATURE_VIDEO_WALL,
    label: "ویدیو وال",
    description: "ردیفِ ویدیوهای محصول در صفحه‌ی اصلی",
    category: "صفحه‌ی اصلی",
  },
  {
    key: SITE_SETTING_KEYS.FEATURE_BRAND_CAMPAIGNS,
    label: "کمپین‌های برند",
    description: "بنرهای کمپینِ برندهای خودمون",
    category: "صفحه‌ی اصلی",
  },
  {
    key: SITE_SETTING_KEYS.FEATURE_TRENDYOL_CAMPAIGNS,
    label: "کمپین‌های واقعیِ ترندیول",
    description: "کمپین‌های کشف‌شده از محصولاتِ ترندیول",
    category: "صفحه‌ی اصلی",
  },
  {
    key: SITE_SETTING_KEYS.FEATURE_TRENDYOL_TOP_DISCOUNTS,
    label: "پرتخفیف‌ترین‌های ترندیول",
    description: "ویترینِ محصولاتِ پرتخفیفِ ترندیول",
    category: "صفحه‌ی اصلی",
  },
  {
    key: SITE_SETTING_KEYS.FEATURE_TRENDYOL_PRICE_DROPS,
    label: "تازه ارزون‌شده‌ها",
    description: "محصولاتی که قیمتشون تازه افت کرده",
    category: "صفحه‌ی اصلی",
  },
  {
    key: SITE_SETTING_KEYS.FEATURE_TRENDYOL_BEST_SELLING,
    label: "چون خیلی‌ها خریدن، تو هم بخر!",
    description: "پرفروش‌ترین‌های زنده‌ی ترندیول (معادلِ خودِ آیکنِ «Sen De Al!» توی سایتِ اصلی‌شون)",
    category: "صفحه‌ی اصلی",
  },
  {
    key: SITE_SETTING_KEYS.FEATURE_RECENTLY_VIEWED,
    label: "اخیراً دیده‌اید",
    description: "بر اساس تاریخچه‌ی مرورِ همین مرورگر",
    category: "صفحه‌ی اصلی",
  },
  {
    key: SITE_SETTING_KEYS.FEATURE_DISCOVERABLE_TABS,
    label: "تب‌های کشفِ محصول",
    description: "تب‌های فلش/تخفیف‌دار/پرفروش/جدیدترین/ارسال فوری",
    category: "صفحه‌ی اصلی",
  },
  {
    key: SITE_SETTING_KEYS.FEATURE_DISCOUNT_DISCOVERY,
    label: "کشفِ تخفیف بر اساس دسته/درصد",
    description: "بنرهای درصدِ تخفیف و کشفِ تخفیف بر اساس دسته‌بندی",
    category: "صفحه‌ی اصلی",
  },
  {
    key: SITE_SETTING_KEYS.FEATURE_QUICK_VIEW,
    label: "نگاه سریع",
    description: "دکمه‌ی «نگاه سریع» روی کارتِ محصولاتِ مزون",
    category: "صفحه‌ی محصول",
  },
  {
    key: SITE_SETTING_KEYS.FEATURE_SIZE_MEASUREMENTS,
    label: "اندازه‌ی فیزیکیِ سایز",
    description: "نمایشِ اندازه‌های واقعیِ هر سایز (اگه ادمین برای محصول پر کرده باشه)",
    category: "صفحه‌ی محصول",
  },
  {
    key: SITE_SETTING_KEYS.FEATURE_PRODUCT_REVIEWS,
    label: "نظراتِ محصول",
    description: "بخشِ نظراتِ مشتریان زیرِ هر محصول",
    category: "صفحه‌ی محصول",
  },
  {
    key: SITE_SETTING_KEYS.FEATURE_PRODUCT_QA,
    label: "پرسش و پاسخِ محصول",
    description: "بخشِ سوال‌وجواب زیرِ هر محصول",
    category: "صفحه‌ی محصول",
  },
  {
    key: SITE_SETTING_KEYS.FEATURE_DEFECTIVE_ITEMS,
    label: "محصولاتِ ایراد دار",
    description: "بجِ «ایراد دار» + توضیحِ نقص روی محصول، و فیلترِ مرورِ این محصولات",
    category: "صفحه‌ی محصول",
  },
  {
    key: SITE_SETTING_KEYS.FEATURE_CHEAPER_PRICE_REPORT,
    label: "گزارشِ قیمتِ مناسب‌تر",
    description: "دکمه‌ی «این کالا رو جای دیگه ارزون‌تر دیدم» روی صفحه‌ی محصول، برای اطلاع به ادمین",
    category: "صفحه‌ی محصول",
  },
  {
    key: SITE_SETTING_KEYS.FEATURE_FREQUENTLY_BOUGHT_TOGETHER,
    label: "این محصول رو خریدن، این‌ها رو هم خریدن",
    description: "بر اساسِ هم‌خریدیِ واقعی توی سفارش‌های پرداخت‌شده (مزون و ترندیول/میلا)، نه چیزِ دستی",
    category: "صفحه‌ی محصول",
  },
  {
    key: SITE_SETTING_KEYS.FEATURE_OCCASION_COLLECTIONS,
    label: "مجموعه‌های مناسبتی",
    description: "کالکشنِ زمان‌دارِ محصولات (یلدا، روزِ مادر، بلک‌فرایدی و ...) روی صفحه‌ی اصلی",
    category: "صفحه‌ی اصلی",
  },
  {
    key: SITE_SETTING_KEYS.FEATURE_SHOPPING_ASSISTANT,
    label: "دستیار خریدِ هوشمند",
    description: "ویجتِ شناورِ دستیارِ هوشمند",
    category: "سراسری",
  },
  {
    key: SITE_SETTING_KEYS.FEATURE_SUPPORT_CHAT,
    label: "چت پشتیبانیِ زنده",
    description: "ویجتِ شناورِ چتِ پشتیبانی",
    category: "سراسری",
  },
  {
    key: SITE_SETTING_KEYS.FEATURE_COMPARE,
    label: "مقایسه‌ی محصولات",
    description: "نوارِ مقایسه‌ی محصولات (پایینِ صفحه)",
    category: "سراسری",
  },
  {
    key: SITE_SETTING_KEYS.FEATURE_REVIEW_NUDGE,
    label: "یادآوریِ ثبتِ نظر",
    description: "پاپ‌آپِ یادآوری بعد از تحویلِ سفارش که از مشتری نظر می‌خواد",
    category: "سراسری",
  },
];
