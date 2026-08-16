import { gotScraping } from "got-scraping";
import {
  HEADER_GENERATOR_OPTIONS,
  trendyolCookieJar,
  requestTrendyolWithRetry,
  buildTrendyolFetchError,
} from "@/lib/trendyol";
import { translateTrendyolTitles } from "@/lib/trendyolTitleTranslation";
import { resolveTrendyolBrandId } from "@/lib/trendyolBrandLookup";
import { getExchangeRateInfo, applyExchangeRate } from "@/lib/exchangeRate";

// ============================================================================
// «محصولات مشابه» صفحه‌ی جزئیات محصول ترندیول -- فاز ۲
// ============================================================================
// endpoint:
//   GET https://apigw.trendyol.com/discovery-storefront-trproductgw-service
//       /api/reco-engine/similar-size-variant/{contentId}
//       ?page=0&size=8&culture=tr-TR&channelId=1&sizeVariantAttributeValue={size}
//
// نکات تأییدشده با تست واقعی:
// - پارامترهای برند/دسته (brandId, categoryId, rootCategoryId, webCategoryId,
//   rootWebCategoryId) اختیاری‌ان -- فقط برای شخصی‌سازی، نه لازم برای پاسخ درست.
//   حذفشون خطا نمی‌ده.
// - `sizeVariantAttributeValue` (سایز، مثلاً "S") و دو هدر `x-agentname:
//   StorefrontProductGateway` و `x-platform: WEB` اجباری‌ان -- بدونشون 400
//   می‌گیریم: "sizeVariantAttributeValue is required in query, x-agentname is
//   required in headers, x-platform is required in headers"
// - بعد از پر کردن این‌ها، یه لایه‌ی اعتبارسنجی بعدی هم `brandId` رو اجباری
//   کرد ("request validation err: brandId is required") -- چون فقط اسم برند
//   رو داریم نه ID عددیش، از `resolveTrendyolBrandId` (endpoint عمومی
//   integration/product/brands/by-name) برای پیدا کردنش استفاده می‌کنیم.
//   بقیه‌ی ID‌های اختیاری (categoryId, rootCategoryId, webCategoryId,
//   rootWebCategoryId) همچنان لازم نبودن.
// - ساختار پاسخ کاملاً متفاوته از ساختار خروجی سرچ (window["__single-search-
//   result__PROPS"]) که در trendyol.ts پارس می‌کنیم -- اینجا brand/category
//   آبجکت با id هستن (نه رشته)، عکس‌ها بدون دامنه (باید cdn.dsmcdn.com
//   جلوش اضافه بشه)، socialProof.favoriteCount عدد خامه (نه رشته‌ی کوتاه‌شده
//   مثل "31K"). برای همین یه normalizer جدا (normalizeSimilarProduct) داریم،
//   نه استفاده‌ی مجدد از normalizeLiveProduct.

export type TrendyolSimilarProduct = {
  id: string | number;
  name: string;
  nameFa: string;
  price: number | null;
  originalPrice: number | null;
  image: string | null;
  images: string[];
  url: string | null;
  brand: string | null;
  category: string | null;
  rating: number | null;
  reviewCount: number | null;
  isAd: boolean;
  freeCargo: boolean;
  isRushDelivery: boolean;
  favoriteCount: number | null;
  hasOfficialSellerBadge: boolean;
};

function rawImageUrl(path: unknown): string | null {
  if (typeof path !== "string" || !path) return null;
  return path.startsWith("http") ? path : `https://cdn.dsmcdn.com${path.startsWith("/") ? "" : "/"}${path}`;
}

function normalizeSimilarProduct(p: Record<string, unknown>): TrendyolSimilarProduct {
  const price = p.price as Record<string, unknown> | undefined;
  const discountedPrice = price?.discountedPrice as Record<string, unknown> | undefined;
  const originalPrice = price?.originalPrice as Record<string, unknown> | undefined;
  const brand = p.brand as Record<string, unknown> | undefined;
  const category = p.category as Record<string, unknown> | undefined;
  const ratingScore = p.ratingScore as Record<string, unknown> | undefined;
  const socialProof = p.socialProof as Record<string, unknown> | undefined;
  const rawUrl = p.url as string | undefined;
  const images = Array.isArray(p.images)
    ? (p.images as unknown[]).map(rawImageUrl).filter((u): u is string => u !== null)
    : [];

  // نکته‌ی مهم (مثل normalizeLiveProduct): advertId/chargingType روی محصولات
  // تبلیغاتی هست، نه یه فیلد boolean جدا؛ برای عادی‌ها اصلاً وجود نداره
  const isAd = Boolean(p.advertId) || Number(p.chargingBid ?? 0) > 0;

  return {
    id: (p.id as string | number) ?? "",
    name: (p.name as string) ?? "",
    nameFa: (p.name as string) ?? "", // با translateTrendyolTitles جایگزین می‌شه
    price: typeof discountedPrice?.value === "number" ? discountedPrice.value : null,
    originalPrice: typeof originalPrice?.value === "number" ? originalPrice.value : null,
    image: images[0] ?? null,
    images,
    url: rawUrl ? `https://www.trendyol.com${rawUrl}` : null,
    brand: (brand?.name as string) ?? null,
    category: (category?.name as string) ?? null,
    rating: typeof ratingScore?.averageRating === "number" ? ratingScore.averageRating : null,
    reviewCount: typeof ratingScore?.totalCount === "number" ? ratingScore.totalCount : null,
    isAd,
    freeCargo: Boolean(p.freeCargo),
    isRushDelivery: Boolean(p.isRushDelivery),
    favoriteCount: typeof socialProof?.favoriteCount === "number" ? socialProof.favoriteCount : null,
    hasOfficialSellerBadge: Boolean(p.isVerifiedSeller),
  };
}

export async function fetchSimilarTrendyolProducts(
  contentId: string | number,
  sizeVariantAttributeValue: string,
  brandName: string | null,
  opts?: { page?: number; size?: number }
): Promise<TrendyolSimilarProduct[]> {
  const page = opts?.page ?? 0;
  const size = opts?.size ?? 8;

  const brandId = brandName ? await resolveTrendyolBrandId(brandName) : null;

  let url =
    `https://apigw.trendyol.com/discovery-storefront-trproductgw-service/api/reco-engine/similar-size-variant/${contentId}` +
    `?page=${page}&size=${size}&culture=tr-TR&channelId=1` +
    `&sizeVariantAttributeValue=${encodeURIComponent(sizeVariantAttributeValue)}`;
  if (brandId !== null) {
    url += `&brandId=${brandId}`;
  }

  const { res, retried } = await requestTrendyolWithRetry(() =>
    gotScraping({
      url,
      headerGeneratorOptions: HEADER_GENERATOR_OPTIONS,
      cookieJar: trendyolCookieJar,
      headers: {
        accept: "application/json",
        origin: "https://www.trendyol.com",
        "x-agentname": "StorefrontProductGateway",
        "x-platform": "WEB",
      },
      throwHttpErrors: false,
      responseType: "json",
    })
  );

  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw buildTrendyolFetchError("دریافت محصولات مشابه ترندیول", res, retried);
  }

  const body = res.body as Record<string, unknown>;
  if (body.isSuccess === false) {
    throw new Error(`دریافت محصولات مشابه ترندیول ناموفق بود: ${(body.message as string) ?? "نامشخص"}`);
  }

  const result = body.result as Record<string, unknown> | undefined;
  const rawContents = Array.isArray(result?.contents) ? (result!.contents as Record<string, unknown>[]) : [];

  const products = rawContents.map(normalizeSimilarProduct);

  // قیمت‌های بالا هنوز به لیر (TRY) هستن -- تبدیل واقعی به تومان همین‌جاست.
  // (کامنت بالای فایل/کامپوننت‌های نمایش از قبل فرض کرده بودن این تبدیل انجام
  // شده، ولی قبلاً هیچ‌جا واقعاً صدا زده نمی‌شد)
  const tryRate = await getExchangeRateInfo("TRY");
  for (const p of products) {
    if (p.price != null) p.price = applyExchangeRate(p.price, tryRate);
    if (p.originalPrice != null) p.originalPrice = applyExchangeRate(p.originalPrice, tryRate);
  }

  // ترجمه‌ی lazy عنوان‌ها -- دقیقاً مثل الگوی parseSearchPayload توی trendyol.ts
  try {
    const titleMap = await translateTrendyolTitles(products.map((p) => p.name));
    for (const p of products) {
      p.nameFa = titleMap.get(p.name) ?? p.name;
    }
  } catch (err) {
    // ترجمه‌ی عنوان صرفاً نمایشیه -- اگه شکست خورد، عنوان ترکی رو نگه دار و
    // نباید کل بخش «محصولات مشابه» رو بترکونه
    console.error("[fetchSimilarTrendyolProducts] ترجمه‌ی عنوان‌ها ناموفق بود:", err);
  }

  return products;
}
