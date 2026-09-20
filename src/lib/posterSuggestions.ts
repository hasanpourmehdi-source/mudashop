import { prisma } from "@/lib/prisma";
import { fetchTrendyolTopDiscounts, discountPercent } from "@/lib/trendyolTopDiscounts";
import { getSiteSettings, SITE_SETTING_KEYS } from "@/lib/siteSettings";
import type { TrendyolLiveProduct } from "@/lib/trendyol";

export type PosterSuggestion = {
  contentId: string;
  siteSlug: string;
  name: string;
  image: string | null;
  url: string | null;
  brand: string | null;
  category: string | null;
  price: number | null;
  originalPrice: number | null;
  discountPercent: number;
  basketCampaignPercent: number | null;
};

// چندتا محصولِ ترندیول/میلا که برای پوسترِ اینستاگرامِ بعدی گزینه‌ی خوبی‌ان --
// تخفیفِ بالا (یا کمپینِ سبدخریدِ خوب، یا مُهرِ کمپینِ برجسته‌ی خودِ ترندیول)،
// از هر دسته‌بندی (نه فقط پوشاک -- fetchTrendyolTopDiscounts دسته‌بندیِ
// پیش‌فرضِ کلِ سایت رو می‌گیره)، و هیچ‌کدوم قبلاً پوسترش ساخته نشده باشه
export async function fetchPosterSuggestions(): Promise<PosterSuggestion[]> {
  const settings = await getSiteSettings([
    SITE_SETTING_KEYS.POSTER_SUGGESTIONS_MIN_DISCOUNT_PERCENT,
    SITE_SETTING_KEYS.POSTER_SUGGESTIONS_MAX_COUNT,
  ]);
  const minPercent = Number(settings[SITE_SETTING_KEYS.POSTER_SUGGESTIONS_MIN_DISCOUNT_PERCENT]) || 50;
  const maxCount = Number(settings[SITE_SETTING_KEYS.POSTER_SUGGESTIONS_MAX_COUNT]) || 6;

  const siteSlugs = ["trendyol", "trendyol-milla"];
  const pools = await Promise.all(
    siteSlugs.map(async (siteSlug) => {
      const products = await fetchTrendyolTopDiscounts(siteSlug, 20);
      return products.map((p) => ({ product: p, siteSlug }));
    })
  );

  const combinedPercent = (p: TrendyolLiveProduct) =>
    Math.max(discountPercent(p), p.basketCampaignPercent ?? 0);

  const candidates = pools
    .flat()
    .filter(
      ({ product: p }) =>
        combinedPercent(p) >= minPercent || p.campaignSeal != null
    );

  if (candidates.length === 0) return [];

  // حذفِ محصولاتی که قبلاً پوستر/پستشون ساخته شده
  const already = await prisma.instagramPosterLog.findMany({
    where: {
      OR: candidates.map(({ product: p, siteSlug }) => ({
        contentId: String(p.id),
        siteSlug,
      })),
    },
    select: { contentId: true, siteSlug: true },
  });
  const postedKeys = new Set(already.map((a) => `${a.siteSlug}:${a.contentId}`));

  return candidates
    .filter(({ product: p, siteSlug }) => !postedKeys.has(`${siteSlug}:${p.id}`))
    .sort((a, b) => combinedPercent(b.product) - combinedPercent(a.product))
    .slice(0, maxCount)
    .map(({ product: p, siteSlug }) => ({
      contentId: String(p.id),
      siteSlug,
      name: p.nameFa || p.name,
      image: p.image,
      url: p.url,
      brand: p.brand,
      category: p.category,
      price: p.price,
      originalPrice: p.originalPrice,
      discountPercent: discountPercent(p),
      basketCampaignPercent: p.basketCampaignPercent,
    }));
}
