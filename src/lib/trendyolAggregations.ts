import { gotScraping } from "got-scraping";
import type { ExternalSiteKind } from "@prisma/client";
import {
  HEADER_GENERATOR_OPTIONS,
  trendyolCookieJar,
  resetTrendyolCookieJar,
  buildTrendyolFetchError,
  siteKindToRootDomain,
} from "@/lib/trendyol";

// از خودِ صفحه‌ی محصولات (که با fetchTrendyolProductsFromUrl می‌گیریم) یه لینک
// _links.aggregation میاد که دقیقاً همین اندپوینت رو با همون wc/wg نشون می‌ده --
// چون این الگو کاملاً قابل‌پیش‌بینیه (فقط "products" با "aggregations" عوض
// می‌شه)، به‌جای فچ کردن کل صفحه‌ی محصول (که فقط برای گرفتن یه لینک زیاده‌رویه)،
// مستقیم خودمون می‌سازیمش. قبلاً همیشه apigw.trendyol.com هاردکد بود -- یعنی
// حتی وقتی wc/wg مخصوص میلا بود، این تابع از کاتالوگ *ترندیول* جواب می‌گرفت
// (باگ اصلی که باعث می‌شد فیلترهای میلا با کد/برند غلط کش شن)
function aggregationsBase(site: ExternalSiteKind): string {
  return `https://apigw.${siteKindToRootDomain(site)}/discovery-sfint-search-service/api/search/aggregations`;
}

export type TrendyolAggregationValue = {
  id: string;
  text: string;
  count: number;
};

export type TrendyolAggregationGroup = {
  title: string;
  filterKey: string;
  filterField: string;
  filterType: string;
  order: number; // ترتیب واقعی نمایش همین گروه توی خودِ ترندیول
  values: TrendyolAggregationValue[];
};

function buildAggregationsUrl(params: { wc?: string; wg?: string; wb?: string }, site: ExternalSiteKind): string {
  const qs = new URLSearchParams({
    promotionSearch: "false",
    stickyShellNavigation: "true",
    isDynamicRenderingAgent: "false",
    channelId: "1",
    subPathStrategy: "no-subpath",
    tyPlusStripViewEnabled: "true",
    pi: "1",
    pageSize: "24",
  });
  if (params.wc) qs.set("wc", params.wc);
  if (params.wg) qs.set("wg", params.wg);
  if (params.wb) qs.set("wb", params.wb);
  return `${aggregationsBase(site)}?${qs.toString()}`;
}

// این اندپوینت (مثل صفحه‌بندی محصولات) بدون کوکی‌های session واقعی (توکن JWT،
// csrf-secret، __cf_bm) با 403 رد می‌شه -- این کوکی‌ها فقط با یه بازدید واقعی
// از یه صفحه‌ی HTML ساخته می‌شن. اگه توی این پروسه‌ی سرور هنوز هیچ صفحه‌ای از
// همین دامنه فچ نشده باشه، این تابع اول یه صفحه‌ی معمولیِ همون سایت رو
// "گرم‌کننده" می‌گیره تا جار کوکی‌های واقعی رو بگیره، بعد درخواست اصلی رو
// می‌زنه. اگه گرم‌کردن هم شکست بخوره، بی‌خیالش می‌شیم و می‌ذاریم خودِ درخواست
// اصلی (که ممکنه با کوکی‌های موجود کافی باشه) امتحان بشه. جداگانه به‌ازای هر
// دامنه ردیابی می‌شه -- گرم‌بودنِ trendyol.com به این معنی نیست که
// trendyol-milla.com هم کوکی‌های session معتبر داره (هرکدوم دامنه‌ی جدایی
// دارن، کوکی‌های session هم مثل JWT/csrf-secret دامنه‌محورن، نه کوکی‌های
// کشور/زبانِ ساده‌ای که seedTrendyolCookies روی هر دو ست می‌کنه)
const warmedUpDomains = new Set<string>();
async function ensureWarmedUp(rootDomain: string): Promise<void> {
  if (warmedUpDomains.has(rootDomain)) return;
  try {
    await gotScraping({
      url: `https://www.${rootDomain}/`,
      headerGeneratorOptions: HEADER_GENERATOR_OPTIONS,
      cookieJar: trendyolCookieJar,
      throwHttpErrors: false,
    });
    warmedUpDomains.add(rootDomain);
  } catch {
    // مشکلی نیست -- درخواست اصلی با همون کوکی‌های موجود امتحان می‌شه
  }
}

// می‌گیره و فقط گروه‌های خواسته‌شده رو برمی‌گردونه؛ اگه wantedTitles داده
// نشه، همه‌ی گروه‌ها (فعلاً همه‌ی ~۳۰ تا) برمی‌گردن -- برای همگام‌سازی کامل
// توی پنل ادمین. site مشخص می‌کنه از کاتالوگِ کدوم سایت (ترندیول یا میلا)
// جواب بگیریم -- پیش‌فرض TRENDYOL برای سازگاری با فراخوانی‌های قدیمی‌ای که
// هنوز site نمی‌فرستن
export async function fetchTrendyolAggregations(
  params: { wc?: string; wg?: string; wb?: string },
  wantedTitles?: string[],
  site: ExternalSiteKind = "TRENDYOL"
): Promise<TrendyolAggregationGroup[]> {
  const rootDomain = siteKindToRootDomain(site);
  const origin = `https://www.${rootDomain}`;
  await ensureWarmedUp(rootDomain);

  const url = buildAggregationsUrl(params, site);
  const res = await gotScraping({
    url,
    headerGeneratorOptions: HEADER_GENERATOR_OPTIONS,
    cookieJar: trendyolCookieJar,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      origin,
    },
    throwHttpErrors: false,
    responseType: "json",
  });
  if (res.statusCode < 200 || res.statusCode >= 300) {
    // اگه با کوکی گرم هم بازم رد شد (معمولاً یعنی __cf_bm کهنه/مسموم شده)،
    // کل jar رو ریست می‌کنیم و دوباره گرمش می‌کنیم -- فقط یه بار retry
    resetTrendyolCookieJar();
    warmedUpDomains.delete(rootDomain);
    await ensureWarmedUp(rootDomain);
    const retryRes = await gotScraping({
      url,
      headerGeneratorOptions: HEADER_GENERATOR_OPTIONS,
      cookieJar: trendyolCookieJar,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        origin,
      },
      throwHttpErrors: false,
      responseType: "json",
    });
    if (retryRes.statusCode < 200 || retryRes.statusCode >= 300) {
      throw buildTrendyolFetchError("دریافت فیلترهای ترندیول", retryRes, true);
    }
    return parseAggregationBody(retryRes.body as Record<string, unknown>, wantedTitles);
  }
  return parseAggregationBody(res.body as Record<string, unknown>, wantedTitles);
}

function parseAggregationBody(
  body: Record<string, unknown>,
  wantedTitles?: string[]
): TrendyolAggregationGroup[] {
  const groups = (body.aggregation as Record<string, unknown>[]) ?? [];

  return groups
    .filter((g) => !wantedTitles || wantedTitles.includes(g.title as string))
    .map((g) => ({
      title: g.title as string,
      filterKey: g.filterKey as string,
      filterField: g.filterField as string,
      filterType: g.filterType as string,
      order: Number(g.order ?? 999),
      values: ((g.values as Record<string, unknown>[]) ?? []).map((v) => ({
        id: String(v.id),
        text: v.text as string,
        count: Number(v.count ?? 0),
      })),
    }));
}
