import { gotScraping } from "got-scraping";
import {
  HEADER_GENERATOR_OPTIONS,
  trendyolCookieJar,
  requestTrendyolWithRetry,
  buildTrendyolFetchError,
} from "@/lib/trendyol";

// منوی ناوبری اصلی ترندیول (که توی هر صفحه‌ای، از جمله خود صفحه‌ی اصلی، به‌عنوان
// یه بلوک JSON توی HTML جاسازی شده) کدهای wc= واقعی رو داره -- برخلاف
// /integration/product/product-categories که یه سیستم آیدی کاملاً جدا و
// نامرتبط با wc= داره (تأیید شده با نمونه‌ی واقعی: "Giyim" توی اون API آیدی
// ۵۲۲ داره، ولی wc واقعیش ۸۲ است).

export type TrendyolNavNode = {
  id?: number;
  title?: string;
  webUrl?: string;
  children?: TrendyolNavNode[];
};

export type FlatTrendyolNavCategory = {
  // پارامتر کامل و آماده‌ی استفاده، مثلا "wc=82" یا "wc=104443,1123,104444"
  param: string;
  name: string;
  path: string;
};

// دیگه هیچ آدرس پیش‌فرض ثابتی نداریم -- همیشه باید صریحاً یه آدرس داده بشه
// (چون بعداً ممکنه آدرس trendyol-milla.com هم داده بشه، نه فقط trendyol.com)

// این بلوک همیشه بلافاصله بعد از پایان آرایه‌ی "sections" میاد -- یه نشونه‌ی
// عمومی که به یه اسم دسته‌بندی خاص (مثل "Kadın" بودن اولین آیتم) وابسته نیست
const CATEGORIES_MARKER = '],"categories":[{"id":';

async function fetchTrendyolNavSourceHtml(url: string): Promise<string> {
  // fetch ساده اینجا کار نمی‌کنه (۴۰۳ می‌گیریم) -- طبق تجربه‌ی قبلی توی
  // trendyol.ts، ترندیول بر اساس IP جغرافیایی سرور (خارج از ترکیه) قبل از
  // هر صفحه‌ای ریدایرکت/بلاک می‌کنه؛ باید از got-scraping (که fingerprint
  // مرورگر واقعی رو شبیه‌سازی می‌کنه) + همون کوکی «ترکیه رو انتخاب کردم»
  // استفاده کنیم -- دقیقاً همون ترکیبی که برای واکشی صفحات محصول جواب داده
  const { res, retried } = await requestTrendyolWithRetry(() =>
    gotScraping({
      url,
      headerGeneratorOptions: HEADER_GENERATOR_OPTIONS,
      cookieJar: trendyolCookieJar,
      throwHttpErrors: false,
    })
  );
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw buildTrendyolFetchError("دریافت صفحه‌ی منبع ترندیول", res, retried);
  }
  return res.body as string;
}

// درون خودِ HTML، دنبال بلوک "categories":[...] می‌گرده و با شمارش براکت‌ها
// (با درنظر گرفتن رشته‌ها، که ممکنه توش [ یا ] باشه) دقیقاً همون آرایه رو جدا
// می‌کنه -- چون این بلوک جزئی از یه شیء JSON خیلی بزرگ‌تره، نمی‌شه کل صفحه رو
// یهو JSON.parse کرد
function extractNavCategoriesJson(html: string): TrendyolNavNode[] {
  const markerIdx = html.indexOf(CATEGORIES_MARKER);
  if (markerIdx === -1) {
    throw new Error(
      "بلوک ناوبری دسته‌بندی‌ها توی صفحه پیدا نشد -- شاید ساختار صفحه‌ی ترندیول عوض شده"
    );
  }
  const start = markerIdx + '],"categories":'.length; // اشاره به خودِ '['

  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end === -1) {
    throw new Error("پارس بلوک دسته‌بندی‌ها ناموفق بود (براکت‌ها بسته نشدن)");
  }

  const jsonSlice = html.slice(start, end);
  try {
    return JSON.parse(jsonSlice) as TrendyolNavNode[];
  } catch {
    throw new Error(
      `پارس JSON بلوک دسته‌بندی‌ها ناموفق بود. ۳۰۰ کاراکتر اول: ${jsonSlice.slice(0, 300)}`
    );
  }
}

export async function fetchTrendyolNavCategories(sourceUrl: string): Promise<TrendyolNavNode[]> {
  const html = await fetchTrendyolNavSourceHtml(sourceUrl);
  return extractNavCategoriesJson(html);
}

// از webUrl هر گره، پارامتر واقعی wc= رو درمیاره -- دو حالت ممکنه:
// ۱. "sr?wc=101506" یا "sr?wc=104443,1123,104444" (چندتا آیدی با هم)
// ۲. یه اسلاگ زیبا مثل "kadin-canta-x-g1-c117" یا "sofra-mutfak-x-c1354"
//    (گاهی هم دنبالش query string مثل "?gag=1-2" میاد) -- عدد بعد از "-c"
//    همون آیدی‌ایه که توی wc= هم قابل‌استفاده‌ست
function extractParam(webUrl: string | undefined): string | null {
  if (!webUrl) return null;
  const wcMatch = webUrl.match(/wc=([\d,]+)/);
  if (wcMatch) return `wc=${wcMatch[1]}`;
  const slugMatch = webUrl.match(/-c(\d+)(?:[?&]|$)/);
  if (slugMatch) return `wc=${slugMatch[1]}`;
  return null;
}

// درخت تودرتو رو به لیست تخت تبدیل می‌کنه؛ گره‌هایی که پارامتر قابل‌استخراج
// ندارن (مثلا صفحات کلی «بوتیک» سطح اول) رد می‌شن، چون چیزی برای نگاشت دادن
// بهشون نیست
export function flattenTrendyolNavCategories(tree: TrendyolNavNode[]): FlatTrendyolNavCategory[] {
  const flat: FlatTrendyolNavCategory[] = [];

  function walk(nodes: TrendyolNavNode[], parentPath: string) {
    for (const node of nodes) {
      const title = (node.title ?? "").trim();
      if (!title) continue;
      const path = parentPath ? `${parentPath} > ${title}` : title;
      const param = extractParam(node.webUrl);
      if (param) {
        flat.push({ param, name: title, path });
      }
      if (node.children && node.children.length > 0) {
        walk(node.children, path);
      }
    }
  }

  walk(tree, "");
  return flat;
}
