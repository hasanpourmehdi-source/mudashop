import { gotScraping } from "got-scraping";
import {
  HEADER_GENERATOR_OPTIONS,
  trendyolCookieJar,
  requestTrendyolWithRetry,
  buildTrendyolFetchError,
} from "@/lib/trendyol";
import { translateTrendyolTitle, translateTrendyolAttributeText } from "@/lib/trendyolTitleTranslation";
import { getExchangeRateInfo, applyExchangeRate } from "@/lib/exchangeRate";
import { fetchTrendyolPageViaBrowser } from "@/lib/trendyolBrowserFetch";

// ============================================================================
// صفحه‌ی جزئیات محصول ترندیول -- فاز ۱: فقط بخش بالای صفحه (SSR)
// ============================================================================
// طبق بررسی HTML واقعی صفحه‌ی محصول (docs/trendyol-api-notes.md بخش مربوطه):
//
//   ۱. <script type="application/ld+json"> با @type: "ProductGroup" -- شامل
//      نام، برند، دسته، همه‌ی رنگ‌ها (hasVariant[]) با عکس و قیمت SEO (نه
//      لزوماً قیمت لحظه‌ای/تخفیف واقعی)، و attributes (additionalProperty[])
//
//   ۲. PuzzleJs.emit("4", "envoy", "__PRODUCT_DETAIL__DATALAYER", {...}) --
//      یه بلوک GTM analytics که قیمت *واقعی* لحظه‌ای رو داره:
//      product_price (نهایی), product_original_price (خط‌خورده),
//      product_discounted_price, product_quantity (موجودی رشته‌ای ساده)
//
// این دو منبع با هم ترکیب می‌شن چون هرکدوم چیزی رو داره که دیگری نداره.

export type TrendyolProductVariantColor = {
  contentId: string; // sku در JSON-LD -- همون شناسه‌ای که در URL /p-{id} میاد
  colorName: string; // از فیلد color در JSON-LD (اسم رنگ، گاهی با پسوند کد داخلی)
  image: string;
  url: string;
  price: number | null; // قیمت SEO این رنگ (نه لزوماً دقیق/لحظه‌ای)
};

export type TrendyolProductDetail = {
  contentId: string;
  name: string; // عنوان اصلی ترکی
  nameFa: string; // عنوان ترجمه‌شده
  brand: string | null;
  categoryName: string | null;
  images: string[];
  colorVariants: TrendyolProductVariantColor[]; // شامل خودِ محصول فعلی هم می‌شه
  attributes: { name: string; value: string }[]; // additionalProperty -- جنس، یقه، آستین و...
  sizes: string[]; // از hasVariant[].size (یکسان برای همه‌ی رنگ‌ها معمولاً)
  price: number | null; // قیمت نهایی لحظه‌ای (product_price از dataLayer)
  originalPrice: number | null; // قیمت قبل از تخفیف (product_original_price)
  inStock: boolean;
  quantity: number | null;
  url: string;
};

// بلوک <script type="application/ld+json"> که @type: "ProductGroup" داره رو پیدا می‌کنه
// (ممکنه چندتا json-ld روی صفحه باشه، مثلاً breadcrumb هم جداست)
// بلوک <script type="application/ld+json"> محصول رو پیدا می‌کنه -- ترندیول
// بسته به این‌که محصول چندتا رنگ/واریانت داشته باشه یا نه، یا @type:
// "ProductGroup" (با hasVariant[]) یا @type: "Product" ساده (تک‌رنگ، بدون
// hasVariant) می‌سازه. هردو رو برمی‌گردونیم، به‌همراه این‌که کدوم نوع بود.
function extractProductJsonLd(
  html: string
): { data: Record<string, unknown>; isGroup: boolean } | null {
  const scriptPattern = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let match: RegExpExecArray | null;
  while ((match = scriptPattern.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed && parsed["@type"] === "ProductGroup") return { data: parsed, isGroup: true };
      if (parsed && parsed["@type"] === "Product") return { data: parsed, isGroup: false };
    } catch {
      // این بلوک JSON معتبر نبود یا محصول نبود (مثلاً WebPage) -- برو بعدی
    }
  }
  return null;
}

// PuzzleJs.emit("4", "envoy", "__PRODUCT_DETAIL__DATALAYER", {...}); -- استخراج آبجکت سوم
function extractProductDetailDataLayer(html: string): Record<string, unknown> | null {
  const marker = '__PRODUCT_DETAIL__DATALAYER",';
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  const from = idx + marker.length;
  // خودِ آبجکت از اولین { شروع میشه؛ باید براکت‌های تودرتو رو بشماریم چون
  // JSON.parse ساده با substring ناقص کار نمی‌کنه اگه دنبال closing brace نادرست بگردیم
  const objStart = html.indexOf("{", from);
  if (objStart === -1) return null;
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  for (let i = objStart; i < html.length; i++) {
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
      if (depth === 0) {
        const raw = html.slice(objStart, i + 1);
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

// خیلی از عکس‌های واقعی محصول (چند زاویه) هم‌مسیرِ og:image هستن، فقط پیشوند
// shard (مثلاً "ty1907") و پوشه‌ی نهایی (هش/فایل) فرق می‌کنه. دو سبک مسیر از
// ترندیول دیده شده که عمق پوشه‌شون فرق داره:
//   - PLM: .../prod/PLM/<۴ سگمنت ثابت>/<پوشه‌ی هش متغیر>/<۰..N>_org_zoom.jpg
//     (شماره‌ی زاویه توی خودِ اسم فایل کدگذاری شده)
//   - QC_PREP: .../prod/QC_PREP/<تاریخ>/<شماره دوره>/<پوشه‌ی هش یکتا برای هر عکس>/1_org_zoom.jpg
//     (اسم فایل همیشه "1_org_zoom.jpg"ه، فقط پوشه‌ی هش هر عکس فرق می‌کنه)
// چون تعداد سگمنت‌های مشترک بین این دو سبک فرق می‌کنه، به‌جای فرض تعداد ثابت،
// «همه‌چیز بین prod/<نوع پردازش> و آخرین دو سگمنت (پوشه‌ی هش + اسم فایل)» رو
// به‌عنوان مسیر مشترک در نظر می‌گیریم
function extractImageGroupPath(ogImage: string): { prefix: string; middlePath: string } | null {
  const match = ogImage.match(/\/prod\/([A-Za-z0-9_]+)\/(.+)\/[^/]+\/\d+_org_zoom\.jpg$/);
  return match ? { prefix: match[1], middlePath: match[2] } : null;
}

// همه‌ی زاویه‌های عکس همین محصول رو از روی مسیر مشترک پیدا می‌کنه -- برای
// صفحاتی (مثل میلا، یا محصولات ترندیول با سبک عکسِ QC_PREP) که JSON-LD ندارن
// یا JSON-LD فقط یه عکس داره، ولی گالری واقعی توی خودِ HTML هست
function extractGalleryImagesFromHtml(html: string, ogImage: string | null): string[] {
  if (!ogImage) return [];
  const group = extractImageGroupPath(ogImage);
  if (!group) return [ogImage];
  const escPrefix = group.prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escMiddle = group.middlePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `https://cdn\\.dsmcdn\\.com/(?:mnresize/\\d+/\\d+/)?[^/"'\\s]+/prod/${escPrefix}/${escMiddle}/[^/"'\\s]+/(\\d+)_org_zoom\\.jpg`,
    "g"
  );
  const seen = new Set<string>();
  const found: { index: number; url: string }[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const cleanUrl = match[0].replace(/\/mnresize\/\d+\/\d+/, "");
    if (seen.has(cleanUrl)) continue;
    seen.add(cleanUrl);
    found.push({ index: Number(match[1]), url: cleanUrl });
  }
  if (found.length === 0) return [ogImage];
  // اگه شماره‌های متفاوتی توی اسم فایل‌ها بود (سبک PLM)، طبق همون ترتیب بچین --
  // وگرنه (سبک QC_PREP که همه‌شون "1_org_zoom" هستن) همون ترتیب ظاهرشدن توی
  // HTML رو حفظ کن، که خودش ترتیب واقعی گالریه
  const distinctIndexes = new Set(found.map((f) => f.index)).size;
  if (distinctIndexes > 1) found.sort((a, b) => a.index - b.index);
  return found.map((f) => f.url);
}

function extractOgImage(html: string): string | null {
  const match = html.match(/<meta\s+property="og:image"\s+content="([^"]*)"/);
  return match ? match[1] : null;
}

// از یه ایندکس مشخص (بلافاصله بعد از یه marker مثل ':') براکت‌های تودرتو رو
// می‌شمره تا انتهای واقعی آرایه/آبجکت JSON رو پیدا کنه -- substring ساده کار
// نمی‌کنه چون طول دقیق از قبل معلوم نیست
function extractBracketedJson(html: string, startIdx: number, openChar: "[" | "{", closeChar: "]" | "}"): string | null {
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
    if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) return html.slice(startIdx, i + 1);
    }
  }
  return null;
}

// لیست سایزهای واقعاً قابل‌انتخاب (نه فقط سایزِ همین محصول) -- توی صفحه‌ی میلا
// به‌شکل "variants":[{"itemNumber":...,"value":"S","inStock":true,...},...] میاد
function extractSizesFromHtml(html: string): string[] {
  const marker = '"variants":[';
  const idx = html.indexOf(marker);
  if (idx === -1) return [];
  const raw = extractBracketedJson(html, idx + marker.length - 1, "[", "]");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { value?: unknown }[];
    return parsed.map((v) => v.value).filter((v): v is string => typeof v === "string" && v.length > 0);
  } catch {
    return [];
  }
}

// ویژگی‌های فنی محصول (جنس، یقه، آستین، ...) -- توی صفحه‌ی میلا به‌شکل
// "attributes":[{"key":{"name":...},"value":{"name":...}},...] میاد (حتی
// کامل‌تر از additionalProperty خودِ JSON-LD ترندیول)
function extractRawAttributesFromHtml(html: string): { name: string; value: string }[] {
  const marker = '"attributes":[{"key"';
  const idx = html.indexOf(marker);
  if (idx === -1) return [];
  const raw = extractBracketedJson(html, idx + '"attributes":'.length, "[", "]");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { key?: { name?: unknown }; value?: { name?: unknown } }[];
    return parsed
      .map((a) => ({ name: String(a.key?.name ?? ""), value: String(a.value?.name ?? "") }))
      .filter((a) => a.name && a.value);
  } catch {
    return [];
  }
}

// وقتی صفحه‌ی محصول JSON-LD نداره (مثلاً میلا -- برخلاف خودِ ترندیول، این بلوک
// رو خالی می‌فرسته) ولی dataLayer آنالیتیکس (__PRODUCT_DETAIL__DATALAYER) واقعی
// و پره، بهترین اطلاعاتی که از همین یه منبع + گالری عکس + سایز/ویژگی‌های فنیِ
// خودِ HTML (که به‌شکل داده‌ی خام JS، نه JSON-LD، توی صفحه هست) درمیاد رو جمع
// می‌کنیم. فقط چیزی که واقعاً پیدا نشد (رنگ‌های دیگه‌ی محصول) خالی می‌مونه --
// کامپوننت‌های صفحه‌ی محصول از قبل با آرایه‌ی خالی مشکلی ندارن
async function buildDetailFromDataLayerOnly(
  dataLayer: Record<string, unknown>,
  html: string,
  productUrl: string
): Promise<TrendyolProductDetail | null> {
  const name = typeof dataLayer.product_pname === "string" ? dataLayer.product_pname : null;
  const contentId = String(dataLayer.product_contentid ?? dataLayer.product_productid ?? extractContentIdFromUrl(productUrl) ?? "");
  if (!name || !contentId) return null;

  const ogImage = extractOgImage(html);
  const images = extractGalleryImagesFromHtml(html, ogImage);
  const mainImage = images[0] ?? "";
  const sizes = extractSizesFromHtml(html);
  const rawAttributes = extractRawAttributesFromHtml(html);

  const price = typeof dataLayer.product_price === "number" ? dataLayer.product_price : null;
  const originalPrice =
    typeof dataLayer.product_original_price === "number" ? dataLayer.product_original_price : price;
  const quantity =
    typeof dataLayer.product_quantity === "string" ? Number(dataLayer.product_quantity) || null : null;

  const nameFa = await translateTrendyolTitle(name);
  const attributes = await Promise.all(
    rawAttributes.map(async (a) => ({
      name: await translateTrendyolAttributeText(a.name),
      value: await translateTrendyolAttributeText(a.value),
    }))
  );
  const tryRate = await getExchangeRateInfo("TRY");
  const priceInToman = price != null ? applyExchangeRate(price, tryRate) : null;
  const originalPriceInToman = originalPrice != null ? applyExchangeRate(originalPrice, tryRate) : null;

  return {
    contentId,
    name,
    nameFa,
    brand: typeof dataLayer.product_brand === "string" ? dataLayer.product_brand : null,
    categoryName: typeof dataLayer.product_categoryname === "string" ? dataLayer.product_categoryname : null,
    images,
    colorVariants: mainImage
      ? [{ contentId, colorName: "", image: mainImage, url: productUrl, price: null }]
      : [],
    attributes,
    sizes,
    price: priceInToman,
    originalPrice: originalPriceInToman,
    inStock: dataLayer.product_status === "Available",
    quantity,
    url: productUrl,
  };
}

function rawImageUrl(path: unknown): string | null {
  if (typeof path !== "string" || !path) return null;
  return path.startsWith("http") ? path : `https://cdn.dsmcdn.com${path.startsWith("/") ? "" : "/"}${path}`;
}

// از یه URL کامل ترندیول (مثلاً .../mavi/xxx-p-123456) شناسه‌ی محصول رو درمیاره
function extractContentIdFromUrl(url: string): string | null {
  const match = url.match(/-p-(\d+)(?:[?#]|$)/);
  return match ? match[1] : null;
}

export async function fetchTrendyolProductDetail(
  productUrl: string
): Promise<TrendyolProductDetail | null> {
  const { res, retried } = await requestTrendyolWithRetry(() =>
    gotScraping({
      url: productUrl,
      headerGeneratorOptions: HEADER_GENERATOR_OPTIONS,
      cookieJar: trendyolCookieJar,
      throwHttpErrors: false,
    })
  );

  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw buildTrendyolFetchError("دریافت صفحه‌ی محصول ترندیول", res, retried);
  }

  let html = res.body as string;

  let jsonLd = extractProductJsonLd(html);
  let dataLayer = extractProductDetailDataLayer(html);

  if (!jsonLd && dataLayer) {
    // بعضی سایت‌ها (مثل میلا -- برخلاف خودِ ترندیول) اصلاً JSON-LD نمی‌فرستن،
    // ولی dataLayer آنالیتیکس واقعی و کاملشون هست -- یعنی صفحه بلاک/چالش نشده،
    // فقط ساختارش فرق داره. این‌جا نباید بریم سراغ fallback مرورگر Playwright
    // (کند و بی‌فایده‌ست، چون اون صفحه هم دوباره همین ساختار رو برمی‌گردونه)،
    // مستقیم از همین دیتا + گالری عکسِ خودِ HTML یه نسخه‌ی محدودتر می‌سازیم
    // (بدون رنگ/سایز/ویژگی فنی -- این‌ها فقط توی JSON-LD بودن)
    const fallback = await buildDetailFromDataLayerOnly(dataLayer, html, productUrl);
    if (fallback) return fallback;
  }

  if (!jsonLd) {
    // آخرین راه قبل از تسلیم شدن: got-scraping (HTTP client ساده) اصلاً
    // نمی‌تونه چالش جاوااسکریپتی کلادفلر رو حل کنه؛ یه مرورگر واقعی
    // (Playwright) می‌تونه
    const browserResult = await fetchTrendyolPageViaBrowser(productUrl).catch((err) => {
      console.warn("[trendyolProductDetail] fallback مرورگر هم شکست خورد:", err);
      return null;
    });
    if (browserResult) {
      html = browserResult.body;
      jsonLd = extractProductJsonLd(html);
      dataLayer = extractProductDetailDataLayer(html);
      if (jsonLd) {
        console.warn(
          `[trendyolProductDetail] با مرورگر Playwright موفق شد (بعد از شکست got-scraping): ${productUrl}`
        );
      } else if (dataLayer) {
        const fallback = await buildDetailFromDataLayerOnly(dataLayer, html, productUrl);
        if (fallback) return fallback;
      }
    }
  }

  if (!jsonLd) {
    // دیباگ -- می‌خوایم بدونیم آیا اصلاً بلوک محصولی توی صفحه هست، یا کلاً یه
    // صفحه‌ی چالش/کپچا برگشته
    const ldBlocks = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) ?? [];
    const types = ldBlocks
      .map((block) => {
        try {
          const inner = block.replace(/<script type="application\/ld\+json">/, "").replace(/<\/script>$/, "");
          return JSON.parse(inner)["@type"];
        } catch {
          return "PARSE_ERROR";
        }
      })
      .filter(Boolean);
    console.error(
      "[fetchTrendyolProductDetail] هیچ بلوک Product/ProductGroup پیدا نشد. تعداد بلوک‌های ld+json:",
      ldBlocks.length,
      "| انواعشون:",
      types,
      "| طول HTML:",
      html.length
    );
    return null;
  }

  const { data: product, isGroup } = jsonLd;

  // productGroupID فقط روی نوع ProductGroup هست؛ برای Product ساده از sku
  // (که همون contentId خودشه) یا از خودِ URL fallback می‌کنیم
  const contentId = String(
    product.productGroupID ?? product.sku ?? extractContentIdFromUrl(productUrl) ?? ""
  );
  const name = (product.name as string) ?? "";
  const brand = ((product.brand as Record<string, unknown>)?.name as string) ?? null;

  // additionalProperty -- ویژگی‌های فنی (جنس، یقه، آستین، ...) -- در هر دو نوع یکسانه.
  // نام/مقدار هرکدوم با دیکشنری ترجمه می‌شن (نه tokenizeAndTranslate مخصوص
  // عنوان -- چون اون کلمات ناشناخته مثل "%100" رو حذف می‌کنه، برای عنوان بی‌ضرره
  // ولی برای مقدار ویژگی یعنی از دست رفتن اطلاعات واقعی محصول)
  const rawAttributes = Array.isArray(product.additionalProperty)
    ? (product.additionalProperty as Record<string, unknown>[])
    : [];
  const attributes = await Promise.all(
    rawAttributes
      .map((a) => ({ name: (a.name as string) ?? "", value: (a.unitText as string) ?? "" }))
      .filter((a) => a.name && a.value)
      .map(async (a) => ({
        name: await translateTrendyolAttributeText(a.name),
        value: await translateTrendyolAttributeText(a.value),
      }))
  );

  // عکس‌های خودِ محصول فعلی -- در ProductGroup زیر image.contentUrl[]،
  // در Product ساده گاهی مستقیم image (رشته یا آرایه) میاد
  const imageObj = product.image as Record<string, unknown> | string | string[] | undefined;
  let images: string[] = [];
  if (Array.isArray(imageObj)) {
    images = imageObj.filter((u): u is string => typeof u === "string");
  } else if (typeof imageObj === "string") {
    images = [imageObj];
  } else if (imageObj && Array.isArray((imageObj as Record<string, unknown>).contentUrl)) {
    images = ((imageObj as Record<string, unknown>).contentUrl as string[]).filter(
      (u) => typeof u === "string"
    );
  }

  // hasVariant[] -- فقط در ProductGroup موجوده (رنگ‌های دیگه). محصول تک‌رنگ
  // (Product ساده) این فیلد رو اصلاً نداره -- پس colorVariants فقط شامل خودشه
  const rawVariants =
    isGroup && Array.isArray(product.hasVariant) ? (product.hasVariant as Record<string, unknown>[]) : [];
  const colorVariants: TrendyolProductVariantColor[] = rawVariants
    .map((v) => {
      const offers = v.offers as Record<string, unknown> | undefined;
      const variantUrl = (offers?.url as string) ?? "";
      const variantContentId = (v.sku as string) ?? extractContentIdFromUrl(variantUrl) ?? "";
      return {
        contentId: variantContentId,
        colorName: (v.color as string) ?? "",
        image: rawImageUrl(v.image) ?? "",
        url: variantUrl,
        price: offers?.price ? Number(offers.price) : null,
      };
    })
    .filter((v) => v.contentId && v.image);

  // اگه خودِ محصول فعلی (نه واریانت‌هاش) توی colorVariants نبود، دستی اضافه‌ش کن --
  // چون hasVariant فقط واریانت‌های "دیگر" رو لیست می‌کنه، نه خودِ محصول جاری
  // (و برای Product ساده، این تنها عضو colorVariants می‌مونه). عکسش هم باید از
  // همون rawImageUrl رد بشه (نه مستقیم images[0])، وگرنه اگه مسیر نسبی باشه
  // پیشوند دامنه‌ی CDN رو نمی‌گیره و <img> خراب می‌شه -- دقیقاً همون نرمال‌سازی‌ای
  // که واریانت‌های hasVariant بالا می‌گیرن
  const currentColorFromLd = product.color as string | undefined;
  const currentColorImage = rawImageUrl(images[0]) ?? "";
  if (contentId && currentColorImage && !colorVariants.some((v) => v.contentId === contentId)) {
    colorVariants.unshift({
      contentId,
      colorName: currentColorFromLd ?? "",
      image: currentColorImage,
      url: productUrl,
      price: null,
    });
  }

  // سایزها -- از هر variant (اگه ProductGroup بود) یا مستقیم از خودِ محصول
  // (اگه Product ساده بود -- بعضی محصولات تک‌رنگ فیلد size رو مستقیم دارن)
  const sizesSet = new Set<string>();
  const collectSizes = (sizeField: unknown) => {
    if (Array.isArray(sizeField)) {
      for (const s of sizeField) if (typeof s === "string") sizesSet.add(s);
    } else if (typeof sizeField === "string") {
      sizesSet.add(sizeField);
    }
  };
  for (const v of rawVariants) collectSizes(v.size);
  if (!isGroup) collectSizes(product.size);

  // بعضی محصولات (مثلاً کفش) توی JSON-LD اصلاً فیلد size ندارن -- نه روی خودِ
  // Product، نه روی hasVariant -- ولی سایزهای واقعی (۴۰٫۵ تا ۴۷٫۵ با
  // in-stock/out-of-stock) همچنان توی همون بلوکِ خامِ "variants":[...] خودِ HTML
  // هستن (دقیقاً همون ساختاری که برای میلا کشف شد). پس اگه از JSON-LD هیچ
  // سایزی درنیومد، همون استخراج‌کننده‌ی خام رو روی HTML امتحان می‌کنیم
  if (sizesSet.size === 0) {
    for (const s of extractSizesFromHtml(html)) sizesSet.add(s);
  }

  // قیمت لحظه‌ای واقعی -- از dataLayer اگه بود، وگرنه fallback به offers.price (SEO)
  const seoPrice = (product.offers as Record<string, unknown> | undefined)?.price;
  const price =
    typeof dataLayer?.product_price === "number"
      ? dataLayer.product_price
      : seoPrice
        ? Number(seoPrice)
        : null;
  const originalPrice =
    typeof dataLayer?.product_original_price === "number" ? dataLayer.product_original_price : price;
  const quantity =
    typeof dataLayer?.product_quantity === "string" ? Number(dataLayer.product_quantity) || null : null;

  const nameFa = await translateTrendyolTitle(name);

  // قیمت‌های بالا (price, originalPrice, colorVariants[].price) همه به لیر
  // (TRY) هستن -- قبل از برگردوندن، با نرخ فعلی به تومان تبدیل می‌شن. این‌جا
  // مهم‌تره چون basePrice همین مقدار مستقیم توی AddToCartForm (که فرض می‌کنه
  // تومانه و با برچسب "تومان" نمایش می‌ده) استفاده می‌شه
  const tryRate = await getExchangeRateInfo("TRY");
  const priceInToman = price != null ? applyExchangeRate(price, tryRate) : null;
  const originalPriceInToman = originalPrice != null ? applyExchangeRate(originalPrice, tryRate) : null;
  const colorVariantsInToman = colorVariants.map((v) => ({
    ...v,
    price: v.price != null ? applyExchangeRate(v.price, tryRate) : null,
  }));

  return {
    contentId,
    name,
    nameFa,
    brand,
    categoryName: ((product.pattern as string) || null),
    images,
    colorVariants: colorVariantsInToman,
    attributes,
    sizes: Array.from(sizesSet),
    price: priceInToman,
    originalPrice: originalPriceInToman,
    inStock: (product.offers as Record<string, unknown> | undefined)?.availability ===
      "https://schema.org/InStock",
    quantity,
    url: productUrl,
  };
}
