import { gotScraping } from "got-scraping";
import {
  HEADER_GENERATOR_OPTIONS,
  trendyolCookieJar,
  requestTrendyolWithRetry,
  buildTrendyolFetchError,
} from "@/lib/trendyol";

export type TrendyolSellerInfo = {
  id: number;
  name: string;
  officialName: string | null;
  productCount: number;
  score: number | null;
  verified: boolean;
  bannerImage: string | null;
  rankingText: string | null; // مثلاً "En çok satan Mağaza"
};

// از یه ایندکس مشخص، براکت‌های تودرتو رو می‌شمره تا انتهای واقعی آبجکت JSON رو
// پیدا کنه -- substring ساده کار نمی‌کنه چون طول دقیق از قبل معلوم نیست
function extractBalancedJsonObject(html: string, startIdx: number): string | null {
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  for (let i = startIdx; i < html.length; i++) {
    const ch = html[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === "\\") {
      escapeNext = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return html.slice(startIdx, i + 1);
    }
  }
  return null;
}

// صفحه‌ی فروشگاه ترندیول (/magaza/<هر-اسلاگی>-m-<merchantId>) -- خودِ اسلاگ فقط
// نمایشی/سئوست و توسط ترندیول چک نمی‌شه (تست‌شده: هر اسلاگی با merchantId درست
// جواب می‌ده)، پس نیازی به دانستن اسلاگ دقیق نیست. اطلاعات فروشنده (اسم، امتیاز،
// تیک تاییدشده، تعداد محصول) توی window["__ss-home-page__PROPS"] همون صفحه‌ست --
// برخلاف کارت فروشنده‌ی داخل صفحه‌ی محصول، این یکی lazy/کلاینتی نیست
export async function fetchTrendyolSellerInfo(
  host: string,
  merchantId: string | number,
  slugHint: string
): Promise<TrendyolSellerInfo | null> {
  const url = `https://${host}/magaza/${slugHint || "seller"}-m-${merchantId}`;

  const { res, retried } = await requestTrendyolWithRetry(() =>
    gotScraping({
      url,
      headerGeneratorOptions: HEADER_GENERATOR_OPTIONS,
      cookieJar: trendyolCookieJar,
      throwHttpErrors: false,
    })
  );

  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw buildTrendyolFetchError("دریافت صفحه‌ی فروشگاه ترندیول", res, retried);
  }

  const html = res.body as string;
  const marker = 'window["__ss-home-page__PROPS"]=';
  const idx = html.indexOf(marker);
  if (idx === -1) return null;

  const from = idx + marker.length;
  const objStart = html.indexOf("{", from);
  if (objStart === -1) return null;
  const raw = extractBalancedJsonObject(html, objStart);
  if (!raw) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const store = (parsed.data as Record<string, unknown> | undefined)?.store as Record<string, unknown> | undefined;
  const seller = (store?.meta as Record<string, unknown> | undefined)?.seller as Record<string, unknown> | undefined;
  if (!seller || typeof seller.id !== "number") return null;

  const header = store?.header as Record<string, unknown> | undefined;
  const rankingInfo = header?.rankingInfo as Record<string, unknown> | undefined;
  const markers = Array.isArray(seller.markers) ? (seller.markers as Record<string, unknown>[]) : [];

  return {
    id: seller.id,
    name: (seller.name as string) ?? "",
    officialName: (seller.officialName as string) ?? null,
    productCount: typeof seller.productCount === "number" ? seller.productCount : 0,
    score: typeof seller.score === "number" ? seller.score : null,
    verified: markers.length > 0,
    bannerImage: (header?.image as string) ?? null,
    rankingText: (rankingInfo?.textbold as string) ?? (rankingInfo?.text as string) ?? null,
  };
}
