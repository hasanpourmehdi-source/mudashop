import { UnifiedProduct } from "@/types/product";
import type { ExternalSiteKind } from "@prisma/client";
import { gotScraping, Response } from "got-scraping";
import { CookieJar } from "tough-cookie";
import { notifyAdminsOnce } from "@/lib/adminAlerts";
import { translateTrendyolTitles } from "@/lib/trendyolTitleTranslation";
import { getExchangeRateInfo, applyExchangeRate } from "@/lib/exchangeRate";
import { fetchTrendyolPageViaBrowser } from "@/lib/trendyolBrowserFetch";

const FAKE_STORE_BASE = "https://fakestoreapi.com";

// Fake Store API قیمت‌ها رو به دلار می‌ده؛ چون این محصولات فقط نمایشی‌ان
// (source = TRENDYOL) با نرخ واقعی ثبت‌شده توی پنل ادمین (ارز "USD") به تومان
// تبدیل می‌شن -- قبلاً اینجا یه عدد ثابت هاردکد بود، یعنی نوسان واقعی دلار
// اصلاً روی این قیمت‌های دمو اثر نمی‌ذاشت
type FakeStoreProduct = {
  id: number;
  title: string;
  price: number;
  description: string;
  category: string;
  image: string;
  rating: { rate: number; count: number };
};

export async function fetchTrendyolProducts(): Promise<UnifiedProduct[]> {
  try {
    const res = await fetch(`${FAKE_STORE_BASE}/products`, {
      next: { revalidate: 3600 }, // کش یک ساعته
    });
    if (!res.ok) return [];
    const data: FakeStoreProduct[] = await res.json();

    const usdRate = await getExchangeRateInfo("USD");
    return data.map((p) => normalizeTrendyolProduct(p, usdRate));
  } catch (err) {
    console.error("خطا در دریافت محصولات ترندیول:", err);
    return [];
  }
}

export async function fetchTrendyolProductById(
  id: string
): Promise<UnifiedProduct | null> {
  try {
    const res = await fetch(`${FAKE_STORE_BASE}/products/${id}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data: FakeStoreProduct = await res.json();
    const usdRate = await getExchangeRateInfo("USD");
    return normalizeTrendyolProduct(data, usdRate);
  } catch (err) {
    console.error("خطا در دریافت محصول ترندیول:", err);
    return null;
  }
}

function normalizeTrendyolProduct(
  p: FakeStoreProduct,
  usdRate: { rate: number; profitPercent: number }
): UnifiedProduct {
  const priceInToman = applyExchangeRate(p.price, usdRate);
  return {
    id: `trendyol-${p.id}`,
    source: "TRENDYOL",
    slugOrId: String(p.id),
    title: p.title,
    brand: null,
    price: priceInToman,
    originalPrice: priceInToman,
    discount: 0,
    image: p.image,
    images: [p.image],
    categoryName: p.category,
    description: p.description,
    rating: p.rating?.rate,
    // Fake Store API تاریخ ایجاد نمی‌ده؛ بر اساس id یه ترتیب ثابت می‌سازیم
    createdAt: new Date(2024, 0, 1 + p.id).toISOString(),
  };
}

// ============================================================================
// جستجوی زنده‌ی واقعی روی ترندیول -- آزمایشی
// ============================================================================
// این بخش جدا از شبیه‌سازی بالاست (که از Fake Store API میاد). اینجا مستقیم به
// همون اندپوینت غیررسمی discovery-web-searchgw-service که توی docs/trendyol-api-notes.md
// مستند کردیم وصل می‌شیم، فقط برای تست دستی -- هنوز به بقیه‌ی سایت وصل نشده و
// لایه‌ی ترجمه‌ی فارسی→ترکی روش اعمال نشده (قدم بعدی).
//
// ⚠️ این اندپوینت رسمی نیست، مستند نشده، و ممکنه بدون اطلاع قبلی تغییر کنه یا قطع
// بشه. فقط برای تست/کاوش استفاده کن، نه اتکای پروداکشن بدون کش و بدون محدودیت نرخ.
//
// مسیر و شکل داده بر اساس docs/trendyol-api-notes.md بخش ۲.۸ (زمین حقیقت واقعی --
// از رو یه پاسخ خام واقعی ذخیره‌شده، نه حدس از رو کد پروژه‌های دیگه):
//   - مسیر: discovery-web-searchgw-service/v2/api/filter/sr?q=...  («Search API of TY»)
//   - price = { buyingPrice, discountedPrice, originalPrice, sellingPrice } -- همه عدد خام، بدون .value
//   - categoryHierarchy از خاص به عام مرتبه (برگ اول، ریشه آخر) -- categoryName همون سطح برگه

type TrendyolRawProduct = Record<string, unknown>;

export type TrendyolSearchResult = {
  id: string | number;
  name: string;
  price: number | null;
  originalPrice: number | null;
  image: string | null;
  url: string | null;
  category: string | null;
  rating: number | null;
  reviewCount: number | null;
  merchantId: number | null;
  campaignId: number | null;
  badges: string[]; // فقط عنوان‌های badges[] -- برای نمایش اطلاعاتی، نه چیزی که خودمون بسازیم
};

function firstImageUrl(images: unknown): string | null {
  if (!Array.isArray(images) || typeof images[0] !== "string") return null;
  const path = images[0] as string;
  return path.startsWith("http") ? path : `https://cdn.dsmcdn.com/${path.replace(/^\//, "")}`;
}

function normalizeTrendyolSearchProduct(p: TrendyolRawProduct): TrendyolSearchResult {
  const price = p.price as Record<string, unknown> | undefined;
  const ratingScore = p.ratingScore as Record<string, unknown> | undefined;
  const rawUrl = (p.url as string | undefined) ?? null;
  const badges = Array.isArray(p.badges)
    ? (p.badges as Record<string, unknown>[])
        .map((b) => b.title)
        .filter((t): t is string => typeof t === "string")
    : [];

  return {
    id: (p.id as string | number) ?? "",
    name: (p.name as string) ?? "",
    price: typeof price?.sellingPrice === "number" ? price.sellingPrice : null,
    originalPrice: typeof price?.originalPrice === "number" ? price.originalPrice : null,
    image: firstImageUrl(p.images),
    url: rawUrl ? `https://www.trendyol.com${rawUrl}` : null,
    // categoryName سطح برگه‌ست (خاص‌ترین سطح) -- برای نمایش ساده کافیه
    category: (p.categoryName as string) ?? (p.categoryHierarchy as string) ?? null,
    rating: (ratingScore?.averageRating as number) ?? null,
    reviewCount: (ratingScore?.totalCount as number) ?? null,
    merchantId: typeof p.merchantId === "number" ? p.merchantId : null,
    campaignId: typeof p.campaignId === "number" ? p.campaignId : null,
    badges,
  };
}

// جستجوی آزاد با کلمه‌کلیدی (فرض بر اینه که query از قبل به ترکی ترجمه شده)
export async function searchTrendyolLive(
  query: string,
  page = 1
): Promise<{ products: TrendyolSearchResult[]; raw: TrendyolRawProduct[]; totalCount: number | null }> {
  const url = `https://public.trendyol.com/discovery-web-searchgw-service/v2/api/filter/sr?q=${encodeURIComponent(
    query
  )}&pi=${page}`;

  const { res, retried } = await requestTrendyolWithRetry(() =>
    gotScraping({
      url,
      headerGeneratorOptions: HEADER_GENERATOR_OPTIONS,
      cookieJar: trendyolCookieJar,
      headers: {
        origin: "https://www.trendyol.com",
        referer: "https://www.trendyol.com/",
      },
      throwHttpErrors: false,
      responseType: "json",
    })
  );

  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw buildTrendyolFetchError("جستجوی ترندیول", res, retried);
  }

  const data = res.body as { result?: { products?: TrendyolRawProduct[]; totalCount?: number } };
  const rawProducts: TrendyolRawProduct[] = data?.result?.products ?? [];
  const totalCount: number | null = data?.result?.totalCount ?? null;

  return {
    products: rawProducts.map(normalizeTrendyolSearchProduct),
    raw: rawProducts.slice(0, 3), // فقط ۳ تای اول خام، برای اینکه واقعاً ساختار پاسخ رو ببینیم
    totalCount,
  };
}

// ============================================================================
// واکشی محصولات واقعی ترندیول از روی لینک ذخیره‌شده‌ی هر دسته (Category.trendyolUrl)
// ============================================================================
// طبق docs/trendyol-api-notes.md بخش ۲.۱۰: صفحه‌ی سرچ ترندیول (مثل
// https://www.trendyol.com/sr?wg=1&wc=82) خودش یه اسکریپت داره که
// window["__single-search-result__PROPS"] رو با کل نتیجه‌ی صفحه‌ی اول پر می‌کنه.
// برای صفحه‌های بعدی، همون پاسخ یه data._links.next می‌ده که مستقیم به
// apigw.trendyol.com/discovery-sfint-search-service اشاره می‌کنه و دیگه نیازی
// به دوباره پارس‌کردن HTML نیست.

// بج نواری بالای کارت مثل «En Çok Ziyaret Edilen 1. Ürün» -- رنگ گرادیانت و
// آیکون مستقیم توی داده‌ی خودِ ترندیول میان، نیازی به ساختن دستی نیست
export type TrendyolStripBadge = {
  type: string; // مثلاً "TOP_VIEWED" یا "BEST_SELLER" -- تأیید شده از داده‌ی خام واقعی
  title: string; // برای انواع رتبه‌ای (BEST_SELLER, TOP_VIEWED, ...) عدد رتبه‌ست (مثلاً "1")؛
  // برای بقیه (SUCCESSFUL_SELLER, AUTHORIZED_SELLER, ...) خودِ متن نمایشی ترکی‌ست
  color: string; // رشته‌ی CSS gradient آماده
  icon: string | null; // آدرس SVG
};

// مهر دایره‌ای گوشه‌ی عکس (مثل «AVANTAJLI ÜRÜN» قرمز/زرد/نارنجی، یا «Bugün Fiyatı
// Düşenler») -- از tagDetails[] با hasStamp=true استخراج می‌شه. توجه: خودِ
// stamps{} همیشه خالی برمی‌گرده (حداقل توی نمونه‌های واقعی که دیدیم)، پس آدرس
// گرافیک اصلی ترندیول رو نداریم؛ به‌جاش خودمون یه مهر دایره‌ای با رنگ و متن
// فارسی طراحی می‌کنیم (نه کپی دقیق ظاهر ترندیول، صرفاً هم‌مفهوم)
export type TrendyolCampaignSeal = {
  label: string; // متن فارسی، از قبل ترجمه‌شده
  color: string; // رنگ پس‌زمینه‌ی مهر
};

// بج‌های ساده‌ی پایین/کنار کارت (کارگو رایگان، چندتا بخر کمتر بده، ...)
export type TrendyolSimplifiedBadge = {
  type: string;
  title: string;
  icon: string | null;
  color: string | null;
};

export type TrendyolLiveProduct = {
  id: string | number;
  name: string; // عنوان اصلی ترکی -- برای لینک/دیباگ نگه داشته می‌شه
  nameFa: string; // عنوان ترجمه‌شده به فارسی -- چیزی که باید توی UI نشون داده بشه
  price: number | null; // قیمت فعلی (با تخفیف اگه باشه)
  originalPrice: number | null;
  discountPercentText: string | null; // رشته‌ی آماده مثل "-%14"
  image: string | null;
  images: string[]; // همه‌ی عکس‌های محصول -- برای اسکراب با موس مثل مزون
  url: string | null;
  category: string | null;
  brand: string | null;
  hasOfficialSellerBadge: boolean; // تیک آبی کنار اسم برند
  rating: number | null;
  reviewCount: number | null;
  hasReviewPhoto: boolean; // آیکون دوربین کنار امتیاز (نظرات دارای عکس)
  freeCargo: boolean;
  isAd: boolean; // محصول تبلیغاتی/اسپانسری -- بهتره جدا مشخص بشه یا فیلتر بشه
  stripBadge: TrendyolStripBadge | null; // بج نواری بالای کارت (مثل «۱ En Çok Ziyaret Edilen»)
  campaignSeal: TrendyolCampaignSeal | null; // مهر دایره‌ای گوشه‌ی عکس (آوانتاژ/تخفیف امروز/...)
  simplifiedBadges: TrendyolSimplifiedBadge[];
  tyPlusPrice: string | null; // قیمت مخصوص اعضای Trendyol Plus (رشته‌ی آماده بدون واحد)
  lowestPriceDurationDays: number | null; // مثلاً ۱۰ -- برای بج «کمترین قیمت ۱۰ روز اخیر»
  socialProofFavoriteCount: string | null; // مثلاً "31K"
  socialProofOrderCount: string | null; // مثلاً "100+"
};

type TrendyolLiveFetchResult = {
  products: TrendyolLiveProduct[];
  nextUrl: string | null;
  aggregationUrl: string | null;
  total: number | null;
  debug?: string;
  // برای تشخیص «فیلتر wc= بی‌صدا نادیده گرفته شد» (مخصوصاً میلا -- بعضی
  // آیدی‌های دسته‌بندیِ کپی‌شده از ترندیول اصلاً توی سیستم میلا معتبر نیستن):
  // خودِ سایت چه فیلترهایی رو واقعاً *پذیرفته* (resolvedQuery.filters)، و اسم
  // دسته‌ی واقعیِ اولین محصولِ برگشتی -- اگه این اسم با nameTr ذخیره‌شده‌ی ما
  // یکی نباشه، یعنی همین آیدی توی این سایت به یه دسته‌ی کاملاً متفاوت اشاره
  // می‌کنه (نه اینکه واقعاً خالی باشه)
  resolvedCategoryIds?: string[];
  firstProductCategoryName?: string | null;
};

// ⚠️ هدر تنها کافی نیست -- لایه‌ی ضدبات ترندیول امضای TLS/HTTP2 هم چک می‌کنه که
// fetch خام Node.js نمی‌تونه شبیه‌سازیش کنه (تست شد: 403 Forbidden حتی با هدر کامل).
// got-scraping (از تیم Apify) دقیقاً برای همین ساخته شده: خودش HTTP/2 با
// fingerprint واقعی کروم + هدرهای هم‌خوان باهاش تولید می‌کنه.
// ⚠️ minVersion رو باید هر چند وقت یک‌بار دستی جلو برد -- Chrome 120 (اواخر
// ۲۰۲۳) دیگه به‌قدری قدیمیه که خودش می‌تونه یه سیگنال مشکوک برای ضدبات کلادفلر
// باشه (کاربر واقعی به‌ندرت این‌قدر آپدیت‌نشده می‌مونه). دیتاست header-generator
// نسخه‌های خیلی جدیدتر (تا ~147) رو هم پشتیبانی می‌کنه، پس بردنش جلو بی‌خطره.
export const HEADER_GENERATOR_OPTIONS = {
  browsers: [{ name: "chrome" as const, minVersion: 126 }],
  devices: ["desktop" as const],
  operatingSystems: ["windows" as const],
  locales: ["tr-TR", "tr"],
};

// دامنه‌های اصلی سایت‌های خارجی -- برای ساختن آدرس کامل محصول از رو مسیر
// نسبی‌ای که خودِ ترندیول/میلا برمی‌گردونه، و برای seed کردن کوکی‌های
// کشور/زبان زیر (seedTrendyolCookies) روی هر دو دامنه. وقتی سایت جدیدی اضافه
// شد، دامنه‌ش هم باید اینجا اضافه بشه -- دقیقاً همون‌جایی که ALLOWED_HOSTS
// توی src/app/api/trendyol/live/route.ts هم باید به‌روز بشه
const KNOWN_SITE_ROOT_DOMAINS = ["trendyol-milla.com", "trendyol.com"];

// ترندیول و میلا دو سایت واقعاً جدا هستن (کاتالوگ متفاوت -- برند/دسته/کد
// فیلتر یکی ممکنه توی یکی باشه توی دیگری نباشه) -- برای همین کش‌های
// TrendyolCategoryCache/TrendyolFilterCache به‌ازای هر سایت جدا نگه داشته
// می‌شن. این تابع یه‌جای واحد برای تبدیل ExternalSite.slug (که همه‌جای پروژه
// به‌عنوان siteSlug دست‌به‌دست می‌شه) به مقدار enum مربوطه -- اگه سایت جدیدی
// اضافه شد، فقط همین‌جا کافیه یه مورد اضافه شه
export function siteSlugToKind(siteSlug: string): ExternalSiteKind {
  return siteSlug === "trendyol-milla" ? "TRENDYOL_MILLA" : "TRENDYOL";
}

// جهت معکوس -- برای ساختن هاست واقعی (مثلاً برای apigw.<domain> توی
// fetchTrendyolAggregations) از رو مقدار enum ذخیره‌شده
export function siteKindToRootDomain(site: ExternalSiteKind): string {
  return site === "TRENDYOL_MILLA" ? "trendyol-milla.com" : "trendyol.com";
}

// میلا برخلاف ترندیول (که هزاران برند مستقل داره) یه فروشگاه تک‌مجموعه‌ست --
// فقط همین ۶ برندِ خودش رو می‌فروشه. این دقیقاً همون لیستیه که خودِ سایت واقعیِ
// میلا توی canonicalFilters.brands هر صفحه‌ی دسته‌بندی/جست‌وجو نشون می‌ده و با
// wb= این ۶ آیدی همیشه محدودش می‌کنه (تأییدشده با بازدید مستقیم از خودِ سایت).
// کش قبلیِ ~۱۰۰۰ برندِ عمومی برای میلا از یه sync اشتباه اومده بود و ربطی به
// چیزی که واقعاً روی میلا فروخته می‌شه نداشت
export const MILLA_HOUSE_BRANDS = [
  { id: "101476", nameTr: "Trendyolmilla", nameFa: "ترندیول‌میلا" },
  { id: "148061", nameTr: "Trendyolmilla Curve", nameFa: "ترندیول‌میلا کرو (سایز بزرگ)" },
  { id: "165523", nameTr: "Edit By Trendyolmilla", nameFa: "ادیت بای ترندیول‌میلا" },
  { id: "103500", nameTr: "Trendyolmilla Man", nameFa: "ترندیول‌میلا مردانه" },
  { id: "143760", nameTr: "Trendyolmilla Modest", nameFa: "ترندیول‌میلا مدست (پوشیده)" },
  { id: "175279", nameTr: "Drop by Trendyolmilla", nameFa: "دراپ بای ترندیول‌میلا" },
] as const;
export const MILLA_HOUSE_BRAND_IDS = MILLA_HOUSE_BRANDS.map((b) => b.id).join(",");

// بدون این کوکی‌ها، ترندیول بر اساس IP جغرافیایی سرور (که خارج از ترکیه‌ست) قبل از
// هر صفحه‌ای ریدایرکتمون می‌کنه به /en/select-country -- این‌ها همون ترجیحات
// «ترکیه رو انتخاب کردم» رو شبیه‌سازی می‌کنن (از مرورگر واقعی Mehdi استخراج شد).
// نکته: کوکی‌های مدیریت‌بات کلادفلر (_cflb, _cfuvid) عمداً اینجا نیستن، چون
// معمولاً به IP/fingerprint خودِ مرورگر قفل‌ان و replay‌شون از سرور دیگه کار نمی‌کنه.
export const TRENDYOL_COOKIE = [
  "countryCode=TR",
  "storefrontId=1",
  "language=tr",
  "originalSelectedCountry=US",
  "platform=web",
  "AZ_SELECTED=false",
].join("; ");

// جار کوکی مشترک -- بین همه‌ی درخواست‌های ترندیول (چه صفحه‌ی اول HTML، چه
// صفحه‌های بعدی API) توی کل عمر پروسه‌ی سرور به اشتراک گذاشته می‌شه. علتش:
// وقتی صفحه‌ی اول رو می‌گیریم، ترندیول/Cloudflare یه‌سری کوکی session واقعی
// (توکن JWT، csrf-secret، __cf_bm، sid، ...) با Set-Cookie ست می‌کنه که فقط با
// همون درخواست ساخته می‌شن و قابل هاردکد کردن نیستن -- بدون این‌ها، درخواست
// صفحه‌ی بعدی (که یه اندپوینت API جدا و حساس‌تره) با 403 رد می‌شه. got-scraping
// (از طریق got) وقتی cookieJar بگیره، خودش Set-Cookie پاسخ‌ها رو ذخیره و توی
// درخواست‌های بعدی برای همون دامنه دوباره می‌فرسته -- نیازی به پارس دستی نیست.
//
// این کوکی‌ها باید روی *هر دو* دامنه (trendyol.com و trendyol-milla.com) ست
// بشن، نه فقط trendyol.com -- چون Domain یه کوکی توی cookie jar دقیقاً همون
// دامنه (و زیردامنه‌هاش) رو محدود می‌کنه (RFC 6265)، و trendyol-milla.com یه
// دامنه‌ی کاملاً جداست، نه زیردامنه‌ی trendyol.com. قبلاً این کوکی‌ها فقط با
// Domain=trendyol.com ست می‌شدن، پس هیچ‌وقت به apigw.trendyol-milla.com
// نمی‌رسیدن -- نتیجه‌ش: صفحه‌ی اول (که فال‌بک مرورگر واقعی داره) کار می‌کرد ولی
// صفحه‌ی بعدی (fetchNextPageFromApi، بدون فال‌بک) با 400 «Required country
// information is wrong or missing» شکست می‌خورد.
function seedTrendyolCookies(jar: CookieJar) {
  for (const domain of KNOWN_SITE_ROOT_DOMAINS) {
    for (const pair of TRENDYOL_COOKIE.split("; ")) {
      const eq = pair.indexOf("=");
      if (eq === -1) continue;
      const name = pair.slice(0, eq);
      const value = pair.slice(eq + 1);
      jar.setCookieSync(`${name}=${value}; Domain=${domain}; Path=/`, `https://www.${domain}`);
    }
  }
}

export const trendyolCookieJar = new CookieJar();
seedTrendyolCookies(trendyolCookieJar);

// وقتی به 403/429 برخوردیم، یعنی این jar به احتمال زیاد یه کوکی ضدبات (مثل
// __cf_bm که هر ~۳۰ دقیقه expire می‌شه) کهنه/مسموم شده داره. به‌جای ری‌استارت
// کل پروسه، خودش رو خالی و فقط با کوکی‌های پایه‌ی کشور/زبان دوباره پر می‌کنیم
// تا تلاش بعدی از صفر (بدون کوکی خراب) شروع بشه.
export function resetTrendyolCookieJar() {
  trendyolCookieJar.removeAllCookiesSync();
  seedTrendyolCookies(trendyolCookieJar);
}

// کدهایی که با retry + ریست jar جواب می‌دن -- ۴۰۳ یعنی ردمون کرده
// (بلاک/کوکی نامعتبر)، ۴۲۹ یعنی rate limit؛ هر دو معمولاً گذرا هستن، نه خطای
// واقعی مسیر/پارامتر
const BLOCK_STATUS_CODES = new Set([403, 429]);
const RETRY_DELAY_MS = 900;

function bodySnippetOf(body: unknown): string {
  const raw = typeof body === "string" ? body : JSON.stringify(body ?? "");
  return raw.replace(/\s+/g, " ").trim().slice(0, 300);
}

// یه Error با جزئیات کامل می‌سازه (status، آیا retry شده، آیا شبیه صفحه‌ی
// چالش/کپچا بوده، و یه تکه از body) -- چون همه‌ی جاهایی که خطا رو لاگ می‌کنن
// (`logTrendyolFetchFailure`) فقط err.message رو ذخیره می‌کنن، این‌طوری بدون
// نیاز به تغییر امضای هیچ تابعی، لاگ‌ها خودشون کامل‌تر می‌شن
export function buildTrendyolFetchError(
  label: string,
  res: { statusCode: number; statusMessage?: string; body?: unknown },
  retried: boolean
): Error {
  const looksLikeChallenge =
    typeof res.body === "string" &&
    /captcha|attention required|cloudflare|access denied|are you human/i.test(res.body);
  const parts = [
    `${label} ناموفق بود: ${res.statusCode} ${res.statusMessage ?? ""}`.trim(),
    retried ? "(بعد از ۱ بار retry با jar تازه، بازم ناموفق)" : "(بدون retry -- کد جزو لیست کدهای گذرا نبود)",
    looksLikeChallenge ? "⚠️ به‌نظر صفحه‌ی چالش/کپچا برگشته" : "",
    `body: ${bodySnippetOf(res.body)}`,
  ].filter(Boolean);
  return new Error(parts.join(" | "));
}

// اجرای یه درخواست gotScraping، و اگه با کد بلاک (403/429) مواجه شد، یه‌بار
// jar رو ریست و بعد از یه مکث کوتاه دوباره امتحان می‌کنه. برای خطاهای غیر بلاک
// (404, 500, ...) retry فایده‌ای نداره، همون تلاش اول برگردونده می‌شه
export async function requestTrendyolWithRetry<T extends { statusCode: number }>(
  requestFn: () => Promise<T>
): Promise<{ res: T; retried: boolean }> {
  const res = await requestFn();
  if (!BLOCK_STATUS_CODES.has(res.statusCode)) {
    return { res, retried: false };
  }

  console.warn(
    `[trendyol] وضعیت ${res.statusCode} دریافت شد -- jar کوکی ریست می‌شه و یه بار دیگه امتحان می‌شه`
  );
  resetTrendyolCookieJar();
  await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  const retriedRes = await requestFn();
  return { res: retriedRes, retried: true };
}

// کش خیلی ساده‌ی حافظه‌ای -- چون این اندپوینت غیررسمیه، نباید به‌ازای هر بازدید
// کاربر لایو صداش بزنیم. برای پروداکشن واقعی بهتره این کش رو به دیتابیس/Redis
// منتقل کنیم (چون این نسخه با ری‌استارت سرور یا چند instance پاک/ناهماهنگ می‌شه)
const liveCache = new Map<string, { data: TrendyolLiveFetchResult; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // ۱ ساعت

function rawImageUrl(path: unknown): string | null {
  if (typeof path !== "string" || !path) return null;
  return path.startsWith("http") ? path : `https://cdn.dsmcdn.com/${path.replace(/^\//, "")}`;
}

// تبدیل آرایه‌ی خام badges (unknownBadge, ...) به لیست تایپ‌شده -- ترندیول اسم
// کلید داخلی رو ثابت نگه نمی‌داره، برای همین همه‌ی مقادیر آبجکت badges رو می‌گیریم
function parseSimplifiedBadges(raw: unknown): TrendyolSimplifiedBadge[] {
  if (!Array.isArray(raw)) return [];
  const result: TrendyolSimplifiedBadge[] = [];
  for (const b of raw) {
    const badge = b as Record<string, unknown>;
    const type = badge.type as string | undefined;
    const title = badge.title as string | undefined;
    if (!type || !title) continue;
    result.push({
      type,
      title,
      icon: (badge.icon as string) ?? null,
      color: (badge.color as string) ?? null,
    });
  }
  return result;
}

function parseStripBadge(raw: unknown): TrendyolStripBadge | null {
  if (!raw || typeof raw !== "object") return null;
  const badge = raw as Record<string, unknown>;
  const type = badge.type as string | undefined;
  const title = badge.title as string | undefined;
  const color = badge.color as string | undefined;
  if (!type || !title || !color) return null;
  return { type, title, color, icon: (badge.icon as string) ?? null };
}

function parseSocialProof(raw: unknown, key: string): string | null {
  if (!Array.isArray(raw)) return null;
  const entry = (raw as Record<string, unknown>[]).find((e) => e.key === key);
  return (entry?.value as string) ?? null;
}

function allImageUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((img) => rawImageUrl(img))
    .filter((img): img is string => img !== null);
}

// نگاشت tag (شناسه‌ی پایدار، نه displayName ترکی که ممکنه تغییر کنه) -> برچسب
// فارسی + رنگ -- فقط از روی نمونه‌ی داده‌ی خام واقعی تأیید شده. هر tag دیگه‌ای
// که اینجا نباشه، مهری نمایش داده نمی‌شه (به‌جای حدس زدن)
const CAMPAIGN_SEAL_LABELS: Record<string, { label: string; color: string }> = {
  kirmizi_kampanya_urunu: { label: "محصول فوق‌العاده", color: "#E6362C" }, // "Süper Avantajlı Ürün"
  sari_kampanya_urunu: { label: "محصول ویژه", color: "#F2B705" }, // "Avantajlı Ürün"
  turuncu_kampanya_urunu: { label: "محصول پرتخفیف", color: "#F27A1A" }, // "Çok Avantajlı Ürün"
  daily_discount: { label: "تخفیف امروز", color: "#6C5CE7" }, // "Bugün Fiyatı Düşenler"
  super_card: { label: "فرصت ویژه", color: "#D6336C" }, // "Süper Fırsat Ürünü"
  hesapli_urunler: { label: "مقرون‌به‌صرفه", color: "#2F9E44" }, // "Hesaplı Ürünler"
};

function parseCampaignSeal(tagDetailsRaw: unknown): TrendyolCampaignSeal | null {
  if (!Array.isArray(tagDetailsRaw)) return null;
  for (const t of tagDetailsRaw as Record<string, unknown>[]) {
    const tag = t.tag as string | undefined;
    if (tag && CAMPAIGN_SEAL_LABELS[tag]) return CAMPAIGN_SEAL_LABELS[tag];
  }
  return null;
}

// از رو هر URL ای که همین الان ازش fetch می‌کنیم (چه صفحه‌ی سرچ HTML، چه
// زیردامنه‌ی API صفحه‌ی بعدی مثل apigw.trendyol-milla.com)، دامنه‌ی اصلیِ
// فروشگاه رو حدس می‌زنه -- قبلاً همیشه هاردکد "www.trendyol.com" بود که باعث
// می‌شد لینک محصولات میلا هم به‌اشتباه به trendyol.com اشاره کنه (۴۰۴ می‌داد،
// چون contentId مخصوص میلا روی کاتالوگ ترندیول وجود نداره)
function deriveStorefrontOrigin(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    const root = KNOWN_SITE_ROOT_DOMAINS.find((d) => hostname === d || hostname.endsWith(`.${d}`));
    return `https://www.${root ?? "trendyol.com"}`;
  } catch {
    return "https://www.trendyol.com";
  }
}

function normalizeLiveProduct(p: Record<string, unknown>, baseOrigin: string): TrendyolLiveProduct {
  const price = p.price as Record<string, unknown> | undefined;
  const category = p.category as Record<string, unknown> | undefined;
  const rawUrl = p.url as string | undefined;
  const advert = p.advert as Record<string, unknown> | undefined;
  const ratingScore = p.ratingScore as Record<string, unknown> | undefined;
  const singlePrice = p.singlePrice as Record<string, unknown> | undefined;
  const priceLabels = singlePrice?.priceLabels as Record<string, Record<string, unknown>> | undefined;
  const tyPlusLabel = priceLabels
    ? Object.values(priceLabels).find((label) => label?.name === "TY Plus")
    : undefined;
  const lowestPriceLabel = priceLabels
    ? Object.values(priceLabels).find((label) => label?.name === "lowestPriceDuration")
    : undefined;
  // Sponsorlu رو با tagDetails چک می‌کنیم -- به‌جای فقط advert، چون advert روی
  // همه‌ی محصولات (حتی عادی) هست و فقط cpc/advertId مقدارش فرق می‌کنه
  const tagDetails = Array.isArray(p.tagDetails) ? (p.tagDetails as Record<string, unknown>[]) : [];
  const isSponsoredTag = tagDetails.some((t) => t.tag === "sponsored" || t.tagType === "sponsored");
  const images = allImageUrls(p.images);
  const firstImage = rawImageUrl(p.image) ?? images[0] ?? null;

  return {
    id: (p.id as string | number) ?? "",
    name: (p.name as string) ?? "",
    nameFa: (p.name as string) ?? "", // موقتاً همون عنوان اصلی -- در parseSearchPayload با ترجمه‌ی واقعی جایگزین می‌شه
    price: typeof price?.current === "number" ? price.current : null,
    originalPrice: typeof price?.originalPrice === "number" ? price.originalPrice : null,
    discountPercentText: (singlePrice?.discountPercentage as string) ?? null,
    image: firstImage,
    images: images.length > 0 ? images : firstImage ? [firstImage] : [],
    url: rawUrl ? `${baseOrigin}${rawUrl}` : null,
    category: (category?.name as string) ?? null,
    brand: (p.brand as string) ?? null,
    hasOfficialSellerBadge: Boolean(p.hasOfficialSellerBadge),
    rating: (ratingScore?.averageRating as number) ?? null,
    reviewCount: (ratingScore?.totalCount as number) ?? null,
    hasReviewPhoto: Boolean(p.hasReviewPhoto),
    freeCargo: Boolean(p.freeCargo),
    // نکته‌ی مهم: فیلد advert توی همه‌ی محصولات هست (حتی غیرتبلیغاتی‌ها)، فقط
    // برای محصول عادی advertId خالیه و cpc صفره -- صرفاً وجودِ advert کافی نیست.
    // اینجا هم advert و هم tagDetails رو چک می‌کنیم چون هردو سیگنال معتبرن
    isAd: Boolean(advert?.advertId) || Number(advert?.cpc ?? 0) > 0 || isSponsoredTag,
    stripBadge: parseStripBadge(p.stripBadge),
    campaignSeal: parseCampaignSeal(p.tagDetails),
    simplifiedBadges: parseSimplifiedBadges(p.simplifiedBadges),
    tyPlusPrice: (tyPlusLabel?.value as string) ?? null,
    lowestPriceDurationDays: lowestPriceLabel ? Number(lowestPriceLabel.value) || null : null,
    socialProofFavoriteCount: parseSocialProof(p.socialProof, "favoriteCount"),
    socialProofOrderCount: parseSocialProof(p.socialProof, "orderCount"),
  };
}

// یه بار پارس‌کردن مشترک برای هر دو حالت (خودِ آبجکت payload صفحه‌ی HTML، یا پاسخ JSON صفحه‌های بعدی)
async function parseSearchPayload(payloadData: Record<string, unknown>, baseOrigin: string): Promise<TrendyolLiveFetchResult> {
  const rawProducts = (payloadData.products as Record<string, unknown>[]) ?? [];
  const links = payloadData._links as Record<string, unknown> | undefined;

  // همیشه (نه فقط وقتی خالیه) یه خلاصه‌ی سبک از این‌که خودِ ترندیول فکر می‌کنه
  // چه فیلتری اعمال شده، به‌علاوه‌ی اسم ۳ تا محصول اول برای تایید چشمی سریع
  const debug = JSON.stringify({
    query: payloadData.query,
    resolvedQuery: payloadData.resolvedQuery,
    canonicalFilters: payloadData.canonicalFilters,
    total: payloadData.total,
    roughTotal: payloadData.roughTotal,
    firstProductNames: rawProducts.slice(0, 3).map((p) => p.name),
  });

  // آیدی‌های وب‌کتگوری‌ای که خودِ سایت واقعاً به‌عنوان فیلتر پذیرفته -- اگه
  // آیدیِ درخواستی‌مون توی این لیست نباشه، یعنی wc= اصلاً معتبر نبوده و بی‌صدا
  // نادیده گرفته شده (نتیجه‌ی برگشتی یه fallback عمومیه، نه واقعاً فیلترشده)
  const resolvedFilters = (payloadData.resolvedQuery as Record<string, unknown> | undefined)?.filters as
    | Record<string, unknown>[]
    | undefined;
  const resolvedCategoryIds = (resolvedFilters ?? [])
    .filter((f) => f.filterKey === "WebCategory")
    .flatMap((f) => (Array.isArray(f.values) ? (f.values as string[]) : []));

  const firstProductCategoryName =
    ((rawProducts[0]?.category as Record<string, unknown> | undefined)?.name as string | undefined) ?? null;

  const products = rawProducts.map((p) => normalizeLiveProduct(p, baseOrigin));

  // نکته‌ی مهم: اینجا *هنوز* قیمت‌ها به لیر خام هستن -- تبدیل به تومان عمداً
  // اینجا انجام نمی‌شه، چون این نتیجه توی liveCache تا ۱ ساعت نگه داشته می‌شه؛
  // اگه همین‌جا تبدیل می‌کردیم، قیمت‌های کش‌شده تا یک ساعت با نرخ همون لحظه
  // (حتی اگه صفر بوده، قبل از این‌که ادمین نرخ رو ثبت کنه) قفل می‌موندن.
  // تبدیل واقعی توی fetchTrendyolProductsFromUrl، بعد از خوندن از کش، انجام
  // می‌شه -- تا همیشه نرخ *لحظه‌ی درخواست* اعمال بشه، نه نرخ لحظه‌ی fetch اولیه.

  // ترجمه‌ی lazy عنوان‌ها -- batch شده (موازی) به‌جای یکی‌یکی، چون هر عنوان
  // ممکنه اولین بارش باشه که دیده می‌شه و نیاز به tokenize + ذخیره‌ی کش داره
  try {
    const titleMap = await translateTrendyolTitles(products.map((p) => p.name));
    for (const p of products) {
      p.nameFa = titleMap.get(p.name) ?? p.name;
    }
  } catch (err) {
    // اگه ترجمه خطا داد (مثلاً دیتابیس در دسترس نبود)، حداقل عنوان اصلی رو نشون بده
    console.error("خطا در ترجمه‌ی عنوان محصولات ترندیول:", err);
  }

  return {
    products,
    nextUrl: (links?.next as string) ?? null,
    aggregationUrl: (links?.aggregation as string) ?? null,
    total: (payloadData.total as number) ?? null,
    debug,
    resolvedCategoryIds,
    firstProductCategoryName,
  };
}

// یه بلوک JSON که از یه اسکریپت درش آوردیم رو چک می‌کنه که واقعاً شکل «پاسخ سرچ»
// (یعنی یه آرایه‌ی products) رو داره یا نه -- چه مستقیم چه زیر یه فیلد data
function tryExtractProductsData(candidateText: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(candidateText);
    if (parsed && typeof parsed === "object") {
      if (Array.isArray((parsed as Record<string, unknown>).products)) {
        return parsed as Record<string, unknown>;
      }
      const inner = (parsed as Record<string, unknown>).data as Record<string, unknown> | undefined;
      if (inner && Array.isArray(inner.products)) return inner;
    }
  } catch {
    // این بلوک JSON معتبر نبود -- طبیعیه، همه‌ی window.xxx= ها مربوط به داده‌ی محصول نیستن
  }
  return null;
}

// استخراج داده‌ی صفحه‌ی سرچ از HTML -- با چندتا استراتژی، تا اگه ترندیول اسم
// متغیر رو عوض کرد (مثلاً دیگه اسمش __single-search-result__PROPS نبود)، خودمون
// بتونیم بدون دخالت دستی پیداش کنیم
function extractSearchDataFromHtml(html: string): Record<string, unknown> | null {
  // استراتژی ۱: همون اسم دقیقی که مستند کردیم
  const knownMarker = 'window["__single-search-result__PROPS"]=';
  const knownStart = html.indexOf(knownMarker);
  if (knownStart !== -1) {
    const from = knownStart + knownMarker.length;
    const end = html.indexOf("</script>", from);
    if (end !== -1) {
      let raw = html.slice(from, end).trim();
      if (raw.endsWith(";")) raw = raw.slice(0, -1);
      const result = tryExtractProductsData(raw);
      if (result) return result;
    }
  }

  // استراتژی ۲: هر window["..."]= یا window.xxx= دیگه‌ای که شکل داده‌ش شبیه پاسخ
  // سرچ باشه -- برای وقتی ترندیول اسم متغیر رو عوض کرده باشه
  const assignmentPattern = /window(?:\["[^"]+"\]|\.[A-Za-z0-9_$]+)\s*=\s*/g;
  let match: RegExpExecArray | null;
  while ((match = assignmentPattern.exec(html)) !== null) {
    const from = match.index + match[0].length;
    if (html[from] !== "{") continue; // فقط اگه بلافاصله یه آبجکت شروع بشه امتحان کن
    const end = html.indexOf("</script>", from);
    if (end === -1) continue;
    let raw = html.slice(from, end).trim();
    if (raw.endsWith(";")) raw = raw.slice(0, -1);
    const result = tryExtractProductsData(raw);
    if (result) return result;
  }

  return null;
}

async function fetchFirstPageFromHtml(pageUrl: string): Promise<TrendyolLiveFetchResult> {
  // این تابع دو نوع «شکست گذرا» داره که هردو معمولاً یعنی کوکی ضدبات کهنه/
  // مسموم شده: (۱) status بلاک (403/429)، (۲) status عادی ۲۰۰ ولی هیچ‌کدوم از
  // استراتژی‌های استخراج جواب ندادن -- که اغلب یعنی یه صفحه‌ی چالش/کپچا با
  // status=200 برگشته، نه خطای واقعی. برای هر دو حالت، یه‌بار jar رو ریست و
  // دوباره امتحان می‌کنیم قبل از اینکه واقعاً شکست رو گزارش بدیم.
  let attempt = 0;
  let res: Response<string>;
  let html = "";
  let extracted: Record<string, unknown> | null = null;
  let blocked = false;

  for (;;) {
    attempt++;
    res = await gotScraping({
      url: pageUrl,
      headerGeneratorOptions: HEADER_GENERATOR_OPTIONS,
      cookieJar: trendyolCookieJar,
      throwHttpErrors: false,
    });

    blocked = BLOCK_STATUS_CODES.has(res.statusCode);
    if (!blocked && (res.statusCode < 200 || res.statusCode >= 300)) {
      // خطای غیر گذرا (404, 500, ...) -- retry فایده‌ای نداره
      throw buildTrendyolFetchError("دریافت صفحه‌ی ترندیول", res, attempt > 1);
    }

    if (!blocked) {
      html = res.body as string;
      extracted = extractSearchDataFromHtml(html);
      if (extracted) break; // موفق -- از حلقه خارج شو
    }

    if (attempt >= 2) break; // این دومین تلاش هم بود -- دیگه retry نکن

    console.warn(
      `[trendyol] تلاش ${attempt} برای صفحه‌ی HTML ناموفق (status=${res.statusCode}${
        blocked ? "، کد بلاک" : "، داده پیدا نشد"
      }) -- jar ریست می‌شه و دوباره امتحان می‌شه`
    );
    resetTrendyolCookieJar();
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  }

  if (!extracted) {
    // آخرین راه قبل از تسلیم شدن: got-scraping (HTTP client ساده) اصلاً
    // نمی‌تونه چالش جاوااسکریپتی کلادفلر رو حل کنه؛ یه مرورگر واقعی
    // (Playwright) می‌تونه. اگه این هم جواب نداد (مثلاً کپچای تعاملی سخت‌تر
    // برگشته)، مسیر فعلی (throw/اعلان به ادمین) بدون تغییر ادامه پیدا می‌کنه
    const browserResult = await fetchTrendyolPageViaBrowser(pageUrl).catch((err) => {
      console.warn("[trendyol] fallback مرورگر هم شکست خورد:", err);
      return null;
    });
    if (browserResult) {
      html = browserResult.body;
      extracted = extractSearchDataFromHtml(html);
      if (extracted) {
        console.warn(`[trendyol] با مرورگر Playwright موفق شد (بعد از شکست got-scraping): ${pageUrl}`);
      }
    }
  }

  if (!extracted) {
    const retried = attempt > 1;
    if (blocked) {
      throw buildTrendyolFetchError("دریافت صفحه‌ی ترندیول", res, retried);
    }

    // هیچ استراتژی‌ای جواب نداد -- به ادمین‌ها خبر بده که نیاز به بررسی دستیه
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const looksLikeChallenge = /captcha|attention required|cloudflare|access denied|are you human/i.test(html);
    const snippet = bodySnippetOf(html.slice(0, 400));
    const diagnostic = [
      "استخراج داده از صفحه‌ی ترندیول با همه‌ی روش‌های شناخته‌شده شکست خورد -- ساختار صفحه احتمالاً عوض شده.",
      `آدرس: ${pageUrl}`,
      `آدرس نهایی بعد از ریدایرکت: ${res.url ?? pageUrl}`,
      `کد وضعیت: ${res.statusCode}`,
      `تعداد تلاش: ${attempt}${retried ? " (بعد از ریست jar بازم شکست خورد)" : ""}`,
      `طول HTML دریافتی: ${html.length} کاراکتر`,
      titleMatch ? `عنوان صفحه: ${titleMatch[1]}` : "تگ <title> پیدا نشد",
      looksLikeChallenge ? "⚠️ احتمالاً یه صفحه‌ی چالش/کپچا برگشته (نه صفحه‌ی واقعی)" : "",
      `تکه‌ی اول HTML: ${snippet}`,
    ]
      .filter(Boolean)
      .join(" | ");

    await notifyAdminsOnce(
      "⚠️ واکشی خودکار ترندیول خراب شده",
      `⚠️ واکشی خودکار ترندیول خراب شده و نیاز به بررسی دستی داره. جزئیات فنی: ${diagnostic}`
    ).catch((notifyErr) => {
      // اگه خودِ اعلان هم خطا داد، نباید کل درخواست رو بترکونه -- فقط لاگ کن
      console.error("خطا در ارسال اعلان به ادمین:", notifyErr);
    });

    throw new Error(diagnostic);
  }
  return await parseSearchPayload(extracted, deriveStorefrontOrigin(pageUrl));
}

// از خودِ آدرس API (که شامل wc و pi هست) بهترین حدس ممکن برای هدر
// x-web-req-originalurl رو می‌سازه -- طبق نمونه‌ی واقعی، این هدر مسیر صفحه‌ای
// هست که کاربر توش بوده (یعنی صفحه‌ی *قبل* از صفحه‌ای که الان با pi جدید
// درخواست می‌شه)، نه خودِ صفحه‌ی مقصد
function guessOriginalUrl(apiUrl: string): string {
  try {
    const u = new URL(apiUrl);
    const wc = u.searchParams.get("wc");
    const pi = Number(u.searchParams.get("pi") ?? "1");
    const prevPi = Math.max(1, pi - 1);
    const params = new URLSearchParams();
    if (wc) params.set("wc", wc);
    if (prevPi > 1) params.set("pi", String(prevPi));
    const qs = params.toString();
    return qs ? `/sr?${qs}` : "/sr";
  } catch {
    return "/sr";
  }
}

async function fetchNextPageFromApi(apiUrl: string): Promise<TrendyolLiveFetchResult> {
  const storefrontOrigin = deriveStorefrontOrigin(apiUrl);
  const { res, retried } = await requestTrendyolWithRetry(() =>
    gotScraping({
      url: apiUrl,
      headerGeneratorOptions: HEADER_GENERATOR_OPTIONS,
      cookieJar: trendyolCookieJar,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        origin: storefrontOrigin,
        "x-web-req-host": storefrontOrigin.replace("https://", ""),
        "x-web-req-originalurl": guessOriginalUrl(apiUrl),
        "x-web-req-source": "single-search-result",
      },
      throwHttpErrors: false,
      responseType: "json",
    })
  );
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw buildTrendyolFetchError("دریافت صفحه‌ی بعدی ترندیول", res, retried);
  }
  const json = res.body as Record<string, unknown>;
  // فرض بر اینه که ساختار پاسخ این API هم مشابه data.products/_links باشه --
  // چون هنوز یه پاسخ خام واقعی از این اندپوینت خاص نداریم، هر دو حالت رو امتحان می‌کنیم
  const payloadData = (json.data ?? json) as Record<string, unknown>;
  return await parseSearchPayload(payloadData, storefrontOrigin);
}

// نقطه‌ی ورود اصلی -- url می‌تونه لینک صفحه‌ی سرچ ترندیول باشه (Category.trendyolUrl)
// یا لینک صفحه‌ی بعدی (از nextUrl همین تابع)
export async function fetchTrendyolProductsFromUrl(url: string): Promise<TrendyolLiveFetchResult> {
  const cached = liveCache.get(url);
  let result: TrendyolLiveFetchResult;

  if (cached && cached.expiresAt > Date.now()) {
    result = cached.data;
  } else {
    // فرق صفحه‌ی HTML (اولین صفحه، از سایت اصلی مثل trendyol.com یا trendyol-milla.com)
    // با اندپوینت JSON صفحه‌های بعدی (که آدرسش شامل discovery-*-service هست) --
    // این‌طوری فقط به یه دامنه‌ی خاص (trendyol.com) قفل نیست
    const isHtmlPage = !url.includes("/discovery-");
    result = isHtmlPage ? await fetchFirstPageFromHtml(url) : await fetchNextPageFromApi(url);
    liveCache.set(url, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  // تبدیل قیمت از لیر به تومان همیشه اینجا (بعد از خوندن از کش هم) انجام
  // می‌شه، نه قبلش -- چون liveCache تا ۱ ساعت زنده می‌مونه ولی نرخ ارز ممکنه
  // هر لحظه توی پنل ادمین عوض بشه. با map کردن یه آرایه‌ی *جدید*، خودِ
  // آبجکت‌های داخل liveCache دست‌نخورده می‌مونن (وگرنه با mutate مستقیم،
  // دفعه‌ی بعد که از کش خونده می‌شد، دوباره روی قیمتِ از قبل تبدیل‌شده اعمال
  // می‌شد و قیمت چندبرابر غلط می‌شد)
  return await withTomanPrices(result);
}

async function withTomanPrices(result: TrendyolLiveFetchResult): Promise<TrendyolLiveFetchResult> {
  const tryRate = await getExchangeRateInfo("TRY");
  return {
    ...result,
    products: result.products.map((p) => ({
      ...p,
      price: p.price != null ? applyExchangeRate(p.price, tryRate) : null,
      originalPrice: p.originalPrice != null ? applyExchangeRate(p.originalPrice, tryRate) : null,
    })),
  };
}

