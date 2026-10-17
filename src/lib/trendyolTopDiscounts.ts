import { fetchTrendyolProductsFromUrl } from "@/lib/trendyol";
import { buildExternalSiteUrl, resolveEffectiveFilters } from "@/lib/externalSites";
import type { TrendyolLiveProduct } from "@/lib/trendyol";
import { hasUntranslatedLatin } from "@/lib/turkishText";
import { sortByDiscountDesc } from "@/lib/discountPercent";

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

// تگ‌های «Avantajlı Ürün» ترندیول (سوپر/خیلی/معمولی) و بازه‌ی «Fiyat Geçmişi»
// (کم‌ترین قیمتِ N روز اخیر) -- نام و مقدارِ پارامترها (tag=، lpd=) با خودِ
// API تأیید شده. «Fırsatlı Ürünler» (deals) عمداً نیست: توی دسته‌هایی که تست
// شد همیشه ۰ محصول داشت و نامِ پارامترش قابلِ تأیید نبود. «Flaş» هم طبقِ
// درخواستِ صریح (زمان‌دار) کنار گذاشته شد
const DISCOUNT_TAG_IDS = "kirmizi_kampanya_urunu,turuncu_kampanya_urunu,sari_kampanya_urunu";
const LOWEST_PRICE_DAYS = 30;

// «بیشترین تخفیف» برای یه صفحه‌ی دسته‌بندی. روی ورسل هر صفحه‌ی زنده‌ی ترندیول
// تا ~۳۰ثانیه طول می‌کشه (کلادفلر → فال‌بکِ مرورگر) و مهلتِ کلِ فانکشن ۶۰ثانیه‌ست،
// پس سرور فقط *صفحه‌ی اول* (فیلترِ تگِ آوانتاژی) رو می‌گیره و مرتب می‌کنه؛ بقیه‌ی
// صفحه‌ها (ادامه‌ی همین زنجیره + زنجیره‌ی «کم‌ترین قیمتِ ۳۰ روز») رو خودِ
// TrendyolLiveGrid یکی‌یکی از سمتِ مرورگر می‌گیره و دوباره مرتب می‌کنه.
// baseUrl همون URLِ فیلترهای خودِ کاربره (دسته/جنسیت/رنگ/سایز/...) و فیلترهای
// تخفیف روش اضافه می‌شن
export async function fetchDiscountSeed(baseUrl: string): Promise<{
  products: TrendyolLiveProduct[];
  tagNextUrl: string | null;
  lowestUrl: string;
}> {
  const result = await fetchTrendyolProductsFromUrl(`${baseUrl}&tag=${DISCOUNT_TAG_IDS}`);
  return {
    products: sortByDiscountDesc(result.products),
    tagNextUrl: result.nextUrl,
    lowestUrl: `${baseUrl}&lpd=${LOWEST_PRICE_DAYS}`,
  };
}
