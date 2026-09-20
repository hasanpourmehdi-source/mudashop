import { parseTrendyolInput } from "@/lib/poster";
import { getCachedTrendyolProductUrl, cacheTrendyolProductUrl } from "@/lib/trendyolProductUrlCache";
import { fetchTrendyolProductDetail } from "@/lib/trendyolProductDetail";

export type TrendyolProductSnapshot = {
  contentId: string;
  title: string;
  image: string | null;
  price: number | null;
  originalPrice: number | null;
  productUrl: string;
};

// همون ترکیبِ parseTrendyolInput+cache+fetchTrendyolProductDetail که
// api/admin/poster/route.ts استفاده می‌کنه، برای مصرف‌کننده‌ی جدید (افزودنِ
// آیتمِ ترندیول به مجموعه‌ی مناسبتی) -- بدونِ دست‌زدن به خودِ روتِ پوستر
export async function resolveTrendyolProductSnapshot(input: string): Promise<TrendyolProductSnapshot> {
  const parsed = parseTrendyolInput(input.trim());
  if (!parsed) {
    throw new Error("لینک یا شناسه‌ی محصول ترندیول معتبر نیست");
  }

  let url: string | null = parsed.type === "url" ? parsed.url : null;
  let contentId: string | null = parsed.type === "contentId" ? parsed.contentId : null;

  if (!url && contentId) {
    url = await getCachedTrendyolProductUrl(contentId);
    if (!url) {
      throw new Error("لینک این محصول در حافظه نیست؛ لینک کامل را وارد کنید");
    }
  }

  const detail = await fetchTrendyolProductDetail(url!);
  if (!detail) {
    throw new Error("محصول پیدا نشد");
  }
  if (detail.contentId && url) {
    await cacheTrendyolProductUrl(detail.contentId, url);
  }
  contentId = detail.contentId || contentId;
  if (!contentId) {
    throw new Error("شناسه‌ی محصول قابلِ تشخیص نیست");
  }

  return {
    contentId,
    title: detail.nameFa || detail.name,
    image: detail.images[0] ?? null,
    price: detail.price,
    originalPrice: detail.originalPrice,
    productUrl: detail.url || url!,
  };
}
