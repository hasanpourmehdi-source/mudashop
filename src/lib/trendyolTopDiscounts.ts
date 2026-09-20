import { fetchTrendyolProductsFromUrl } from "@/lib/trendyol";
import { buildExternalSiteUrl, resolveEffectiveFilters } from "@/lib/externalSites";
import type { TrendyolLiveProduct } from "@/lib/trendyol";
import { hasUntranslatedLatin } from "@/lib/turkishText";

// «پرتخفیف‌ترین‌های ترندیول/میلا» برای صفحه‌ی اصلی -- برای کسی که دنبال چیز
// خاصی نیست ولی یه تخفیف خوب می‌تونه ترغیبش کنه بخره (دقیقاً همون کاری که
// خودِ ترندیول/دیجی‌استایل با بخش‌های «حراج روزانه» می‌کنن). عمداً فقط یک
// فچِ زنده (دسته‌بندیِ پیش‌فرضِ همون سایت، بدون sst خاص) و بعد مرتب‌سازیِ
// داخلِ حافظه -- نه چند صفحه‌ی پی‌درپی، که هم کند می‌شه هم شکننده
export async function fetchTrendyolTopDiscounts(
  siteSlug: string,
  limit = 10
): Promise<TrendyolLiveProduct[]> {
  const { categorySlug, attrs } = await resolveEffectiveFilters(siteSlug, null, [], null);
  const url = await buildExternalSiteUrl(siteSlug, categorySlug, attrs);
  if (!url) return [];

  try {
    const { products } = await fetchTrendyolProductsFromUrl(url);
    // همون فیلترِ «عنوان کاملاً ترجمه‌نشده» که trendyolBestSelling.ts هم داره --
    // دسته‌بندیِ پیش‌فرضِ سایت گاهی همه‌چیز رو برمی‌گردونه، نه فقط پوشاک
    return [...products]
      .filter(
        (p) =>
          p.price != null &&
          p.originalPrice != null &&
          p.originalPrice > p.price &&
          !hasUntranslatedLatin(p.nameFa)
      )
      .sort((a, b) => discountPercent(b) - discountPercent(a))
      .slice(0, limit);
  } catch {
    // بی‌اهمیت -- این فقط یه بخشِ کمکیِ کشفه، نباید کل صفحه‌ی اصلی رو بترکونه
    return [];
  }
}

export function discountPercent(p: TrendyolLiveProduct): number {
  if (p.price == null || p.originalPrice == null || p.originalPrice <= 0) return 0;
  return Math.round((1 - p.price / p.originalPrice) * 100);
}
