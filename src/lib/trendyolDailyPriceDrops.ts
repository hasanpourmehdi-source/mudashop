import { fetchTrendyolProductsFromUrl } from "@/lib/trendyol";
import { buildExternalSiteUrl, resolveEffectiveFilters } from "@/lib/externalSites";
import type { TrendyolLiveProduct } from "@/lib/trendyol";
import { hasUntranslatedLatin } from "@/lib/turkishText";

// دقیقاً همون تگی که خودِ ترندیول پشتِ آیکنِ «Bugün Fiyatı Düşenler» (امروز
// قیمتش افتاده) توی نوار بالای صفحه‌ی اصلیش می‌ذاره -- محصولاتی که قیمتشون
// تازه افت کرده، نه صرفاً «الان تخفیف داره». چون خودِ ترندیول این لیست رو
// مرتب/کیوریت کرده، برخلافِ «پرتخفیف‌ترین‌ها» نیازی به مرتب‌سازیِ دستی نیست.
//
// روی همون دسته‌بندیِ پیش‌فرضِ سایت (buildExternalSiteUrl/resolveEffectiveFilters
// -- دقیقاً همون الگوی trendyolTopDiscounts.ts) اعمال می‌شه، نه به‌صورتِ خام
// سراسری روی کل ترندیول: تگِ خامِ سراسری همه‌ی دسته‌ها (جواهرات، لوازمِ خانه،
// الکترونیک، ...) رو هم برمی‌گردوند، و دیکشنریِ ترجمه‌ی عنوان (src/lib/
// trendyolTitleTranslation.ts) فقط برای واژگانِ پوشاک/مد ساخته شده -- خارج از
// اون حوزه، اکثرِ کلمات ناشناخته می‌مونن و از عنوان حذف می‌شن (طبقِ طراحیِ
// عمدیِ اون فایل)، پس عنوان‌ها بی‌معنی/تکه‌تکه درمی‌اومدن (مثلاً فقط چندتا عدد).
// محدودکردن به دسته‌بندیِ پوشاکِ خودِ سایت این مشکل رو حل می‌کنه چون دقیقاً
// همون حوزه‌ایه که دیکشنری براش ساخته شده
export async function fetchTrendyolDailyPriceDrops(siteSlug: string, limit = 10): Promise<TrendyolLiveProduct[]> {
  const { categorySlug, attrs } = await resolveEffectiveFilters(siteSlug, null, [], null);
  const baseUrl = await buildExternalSiteUrl(siteSlug, categorySlug, attrs);
  if (!baseUrl) return [];

  const url = new URL(baseUrl);
  url.searchParams.set("tag", "daily_discount");
  url.searchParams.set("lpd", "30,10,14");

  try {
    const { products } = await fetchTrendyolProductsFromUrl(url.toString());
    // همون فیلترِ «عنوان کاملاً ترجمه‌نشده» که trendyolBestSelling.ts هم داره --
    // این تگ هم گاهی از دسته‌های خارج از پوشاک میاد که دیکشنری پوششش نمی‌ده
    return products.filter((p) => p.price != null && !hasUntranslatedLatin(p.nameFa)).slice(0, limit);
  } catch {
    // بی‌اهمیت -- این فقط یه بخشِ کمکیِ کشفه، نباید کل صفحه‌ی اصلی رو بترکونه
    return [];
  }
}
