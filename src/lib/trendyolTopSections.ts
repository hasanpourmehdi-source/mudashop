// ۱۰ دسته‌ی اصلیِ نوار ناوبری ترندیول -- دقیقاً همون ریشه‌های سطح‌اول که توی
// TrendyolCategoryCache.path هم هست (تأییدشده با کوئری مستقیم روی دیتابیس).
// این فایل هیچ ایمپورت prisma/کلاینتی خاصی نداره، پس هم توی route های سرور
// هم توی کامپوننت‌های کلاینتی (مثل ExternalSiteFilters.tsx) قابل ایمپورته.
// isGenderSection فقط برای Kadın/Erkek true -- این دوتا هستن که باید علاوه بر
// توکن دسته‌بندی خام، توکن attrs=جنسیت~... هم بگیرن (برای سازگاری با فیلتر
// جنسیت مستقلی که از قبل توی سایدبار و بقیه‌ی سیستم وجود داره). بقیه‌ی ۸ تا
// (که تفکیک جنسیتی‌شون -- اگه باشه -- توی خودِ اسم زیرشاخه‌هاست، مثل «کفش
// زنانه» زیر Ayakkabı & Çanta) فقط توکن دسته‌بندی خام می‌گیرن.
//
// rootWc: خودِ لینک ناوبری اصلی ترندیول برای این ۸ بخش به یه صفحه‌ی «بوتیک»
// می‌ره (نه wc=)، پس هیچ wc=ی برای «کل بخش» توی منوی خودِ ترندیول درنمیاد --
// TrendyolCategoryCache هم فقط زیرشاخه‌ها رو داره، نه خودِ ریشه رو. اینجا با
// اتحاد wc=های زیرشاخه‌های سطح‌اول واقعیِ همون بخش (از همون درختی که همیشه
// sync می‌شه) دوباره ساخته شده -- دسته‌های صرفاً مشترک با بخش دیگه (مثلاً
// «کیسسل باکیم» زیر سوپرمارکت که واقعاً خودِ Kozmetik=۸۹ است) عمداً کنار
// گذاشته شدن تا قاطی بخش خودشون نشن.
// Kozmetik (۸۹) و Ayakkabı & Çanta (۱۱۷،۱۱۴) با لینک واقعی که مهدی مستقیم از
// روی سایت ترندیول گرفت هم چک شدن؛ بقیه فقط از روی همین اتحاد ساخته شدن --
// اگه توی تست واقعی نتیجه‌ی عجیبی داد، همینجا قابل اصلاحن.
export const TRENDYOL_TOP_SECTIONS = [
  { turkish: "Kadın", fa: "زنانه", isGenderSection: true, rootWc: null },
  { turkish: "Erkek", fa: "مردانه", isGenderSection: true, rootWc: null },
  {
    turkish: "Anne & Çocuk",
    fa: "مادر و کودک",
    isGenderSection: false,
    rootWc: "wc=104158,101414,90,103752,1355,105325",
  },
  {
    turkish: "Ev & Yaşam",
    fa: "خانه و زندگی",
    isGenderSection: false,
    rootWc: "wc=1354,104166,94,95,1365,1119,97,91,104125,105777,103720",
  },
  {
    turkish: "Süpermarket",
    fa: "سوپرمارکت",
    isGenderSection: false,
    rootWc: "wc=105478,105548,101414,103946,109492,103947,1142",
  },
  { turkish: "Kozmetik", fa: "آرایشی و بهداشتی", isGenderSection: false, rootWc: "wc=89" },
  { turkish: "Ayakkabı & Çanta", fa: "کفش و کیف", isGenderSection: false, rootWc: "wc=117,114" },
  {
    turkish: "Elektronik",
    fa: "الکترونیک",
    isGenderSection: false,
    rootWc: "wc=1104,144430,104025,104037,104035,103613,108656,103665,103109,109056,104024",
  },
  { turkish: "Saat & Aksesuar", fa: "ساعت و اکسسوری", isGenderSection: false, rootWc: "wc=27,28" },
  {
    turkish: "Spor & Outdoor",
    fa: "ورزش و فضای باز",
    isGenderSection: false,
    rootWc: "wc=101447,109,104192,104580,104273,105131,104281",
  },
] as const;

export type TrendyolTopSection = (typeof TRENDYOL_TOP_SECTIONS)[number];

export function turkishSectionForFa(fa: string): string | null {
  return TRENDYOL_TOP_SECTIONS.find((s) => s.fa === fa)?.turkish ?? null;
}

export function isGenderTurkishSection(turkish: string): boolean {
  return TRENDYOL_TOP_SECTIONS.some((s) => s.turkish === turkish && s.isGenderSection);
}
