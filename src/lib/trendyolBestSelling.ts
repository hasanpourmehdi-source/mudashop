import { fetchTrendyolProductsFromUrl } from "@/lib/trendyol";
import { buildExternalSiteUrl, resolveEffectiveFilters } from "@/lib/externalSites";
import type { TrendyolLiveProduct } from "@/lib/trendyol";
import { hasUntranslatedLatin } from "@/lib/turkishText";

// دقیقاً همون تگی که خودِ ترندیول پشتِ آیکنِ «Sen De Al!» (یعنی «چون خیلی‌ها
// خریدن، تو هم بخر») توی نوارِ بالای صفحه‌ی اصلیش می‌ذاره -- fl=encoksatanurunler
// (بررسیِ زنده‌ی خودِ سایتِ ترندیول: /sr/?fl=encoksatanurunler تیترش «En Çok
// Satan Ürünler» یعنی «پرفروش‌ترین محصولات»). دقیقاً همون الگوی
// trendyolDailyPriceDrops.ts: محدود به دسته‌بندیِ پیش‌فرضِ پوشاکِ خودِ سایت
// (نه سراسریِ کلِ ترندیول)، چون دیکشنریِ ترجمه‌ی عنوان فقط برای واژگانِ مد ساخته شده
export async function fetchTrendyolBestSelling(siteSlug: string, limit = 10): Promise<TrendyolLiveProduct[]> {
  const { categorySlug, attrs } = await resolveEffectiveFilters(siteSlug, null, [], null);
  const baseUrl = await buildExternalSiteUrl(siteSlug, categorySlug, attrs);
  if (!baseUrl) return [];

  const url = new URL(baseUrl);
  url.searchParams.set("fl", "encoksatanurunler");

  try {
    const { products } = await fetchTrendyolProductsFromUrl(url.toString());
    // این تگ (en çok satan) گاهی محصولاتِ خارج از پوشاک (آرایشی، لوازمِ
    // شخصی و ...) هم برمی‌گردونه که دیکشنریِ ترجمه پوششش نمی‌ده -- در اون
    // حالت translateTrendyolTitle عمداً همون عنوانِ خامِ ترکی رو برمی‌گردونه
    // (بهتر از خالی)، ولی نشون‌دادنِ عنوانِ کاملاً ترجمه‌نشده توی این بخشِ
    // فارسیِ صفحه‌ی اصلی بد به‌نظر می‌رسه -- همچین موردهایی رو فیلتر می‌کنیم
    return products.filter((p) => p.price != null && !hasUntranslatedLatin(p.nameFa)).slice(0, limit);
  } catch {
    // بی‌اهمیت -- این فقط یه بخشِ کمکیِ کشفه، نباید کل صفحه‌ی اصلی رو بترکونه
    return [];
  }
}
