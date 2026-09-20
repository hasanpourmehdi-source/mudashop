import { gotScraping } from "got-scraping";
import { prisma } from "@/lib/prisma";
import {
  HEADER_GENERATOR_OPTIONS,
  trendyolCookieJar,
  requestTrendyolWithRetry,
  buildTrendyolFetchError,
} from "@/lib/trendyol";
import {
  translateTrendyolTitle,
  translateTrendyolAttributeText,
  translateTurkishPhrase,
  translateCampaignName,
  withCategoryPrefix,
} from "@/lib/trendyolTitleTranslation";
import { filterOutHiddenCampaigns } from "@/lib/trendyolHiddenCampaigns";
// نکته: برای ترجمه‌ی خودِ کمپین‌ها (جمله‌ی کامل مثل "2 Adet ve Üzeri 40 TL
// İndirim") عمداً از translateTrendyolAttributeText استفاده می‌شه، نه
// translateTurkishPhrase -- چون این دومی (مثل خودِ عنوان محصول) ترتیبِ
// بلوک‌های ترجمه‌شده رو معکوس می‌کنه (فرضِ صفت-قبل-از-اسمِ ترکی) و کلماتِ
// ناشناخته رو کامل حذف می‌کنه؛ هردو برای یه جمله‌ی کامل (نه عبارتِ توصیفی)
// نتیجه‌ی مغشوش/ناقص می‌دهد
import { getExchangeRateInfo, applyExchangeRate, type ExchangeRateInfo } from "@/lib/exchangeRate";
import { fetchTrendyolPageViaBrowser } from "@/lib/trendyolBrowserFetch";
import { toProxiedImageUrl } from "@/lib/imageProxy";

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

// id همون promotions[].id ترندیول است -- لینک ورود به کمپین
// (`https://www.trendyol.com/sr?prm={id}`) دقیقاً از همینه ساخته می‌شود
export type TrendyolCampaignBadge = {
  id: number;
  text: string;
  rawNameTr: string; // اسمِ خامِ ترکی -- برای اینکه ادمین (اگه ترجمه ناقص بود) بتونه ازش الگو بسازه
  matchedFormula: boolean; // آیا یه فرمولِ ادمین‌ساخته این اسم رو پوشش داد؟
  // سه‌تای زیر فقط وقتی matchedFormula=true مقدار دارن -- برای اینکه ادمین
  // بتونه همون‌جا (کنارِ خودِ بجِ کمپین) فرمولِ ازقبل‌مچ‌شده رو ویرایش کنه،
  // بدونِ رفتن به صفحه‌ی جداگانه‌ی «فرمول‌ها»
  formulaId: string | null;
  matchedPatternTr: string | null;
  matchedTemplateFa: string | null;
  endsAt: string | null;
  discountType: string | null;
  sampleImages: string[]; // خالی یعنی یا هنوز چیزی جمع نشده یا این کمپین (مثلِ تخفیفِ سبدخرید) اصلاً عکس نمی‌گیره
};

// فروشنده‌ی فعلیِ این لیستینگ (merchantListing.merchant) و «فروشنده‌های دیگه‌ی
// همین محصول» (merchantListing.otherMerchants[] -- نه otherMerchantsVariants
// که برخلافِ اسمش فقط سایزهای دیگه از همون فروشنده رو نشون می‌ده، نه فروشنده‌ی
// دیگه). قیمت‌ها به تومان تبدیل شدن (نه لیرِ خام)
export type TrendyolCurrentSeller = {
  merchantId: number;
  name: string;
  score: number | null;
  scoreColor: string | null;
  price: number | null;
  originalPrice: number | null;
  // همون price/originalPrice به لیر، بدونِ تبدیل -- برای تولتیقِ ادمین (هاورِ
  // موس روی قیمت) تا نرخِ تبدیل سریع قابلِ‌تأیید باشه، بدونِ رفتن به لاگِ نرخِ ارز
  priceTL: number | null;
  originalPriceTL: number | null;
  campaignLabel: string | null; // مثلاً "٪۲ تخفیفِ سبدخرید" -- وقتی discountedPrice از sellingPrice کمتره
  variantLabel: string | null;
};
export type TrendyolOtherSeller = {
  merchantId: number;
  name: string;
  score: number | null;
  scoreColor: string | null;
  price: number | null;
  originalPrice: number | null;
  priceTL: number | null;
  originalPriceTL: number | null;
  campaignLabel: string | null;
  inStock: boolean;
  freeCargo: boolean;
  variantLabel: string | null; // مثلاً "سایز: S" -- همون قراردادِ AddToCartForm
};

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
  // اسم خامِ ترکیِ دسته‌بندی (قبل از ترجمه) -- categoryName بالا از قبل ترجمه
  // شده، پس برای تطبیق با TrendyolCategoryCache.nameTr (که کلیدش ترکیه، نه
  // فارسی) باید همین فیلد استفاده بشه، نه categoryName
  categoryNameTr: string | null;
  images: string[];
  colorVariants: TrendyolProductVariantColor[]; // شامل خودِ محصول فعلی هم می‌شه
  attributes: { name: string; value: string }[]; // additionalProperty -- جنس، یقه، آستین و...
  sizes: string[]; // از hasVariant[].size (یکسان برای همه‌ی رنگ‌ها معمولاً)
  price: number | null; // قیمت نهایی لحظه‌ای (product_price از dataLayer)
  originalPrice: number | null; // قیمت قبل از تخفیف (product_original_price)
  priceTL: number | null; // همان قیمت‌ها به لیر (بدون تبدیل) برای پوستر اینستاگرام
  originalPriceTL: number | null;
  inStock: boolean;
  quantity: number | null;
  url: string;
  campaignBadges: TrendyolCampaignBadge[]; // کمپین‌های واقعی («۲ عدد و بیشتر ۴۰ لیر تخفیف» و مشابه) -- ترجمه‌شده، همراه با id برای لینک ورود به کمپین
  currentSeller: TrendyolCurrentSeller | null;
  otherSellers: TrendyolOtherSeller[]; // مرتب‌شده بر اساس ارزون‌ترین اول
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
  // بعضی صفحات (مخصوصاً میلا) بقیه‌ی عکس‌های گالری رو توی یه بلوکِ JSON با
  // اسلش‌های escape‌شده (\u002F یا \/ -- روش معمولِ جاوااسکریپت برای جلوگیری از
  // برخورد با </script>) embed می‌کنن، نه اسلشِ خام؛ رجکسِ زیر فقط اسلشِ خام رو
  // می‌شناسه، پس قبل از جست‌وجو یک‌بار همه‌شون رو به اسلشِ معمولی برمی‌گردونیم
  const normalizedHtml = html.replace(/\\u002[Ff]/g, "/").replace(/\\\//g, "/");
  const escPrefix = group.prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escMiddle = group.middlePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `https://cdn\\.dsmcdn\\.com/(?:mnresize/\\d+/\\d+/)?[^/"'\\s]+/prod/${escPrefix}/${escMiddle}/[^/"'\\s]+/(\\d+)_org_zoom\\.jpg`,
    "g"
  );
  const seen = new Set<string>();
  const found: { index: number; url: string }[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(normalizedHtml)) !== null) {
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

// کمپین‌های واقعی («۲ عدد و بیشتر ۴۰ لیر تخفیف» و مشابه، همون چیزی که توی
// خودِ صفحه‌ی ترندیول زیر «ÜRÜNÜN KAMPANYALARI» نشون داده می‌شه) داخل
// window["__envoy__SHARED_PROPS"]={"product":{...,"promotions":[...]}} توی
// خودِ HTML embed شده -- بارگذاری کلاینت‌ساید نیست، همین fetch اولیه داره.
// ممکنه این آرایه چندبار توی HTML تکرار شده باشه (یکی تودرتوی merchantListing)
// که محتوای یکسان دارن، پس فقط اولین occurrence رو می‌گیریم
// وقتی کاربرِ واقعیِ ترندیول روی یکی از این کمپین‌ها کلیک می‌کند، به
// `https://www.trendyol.com/sr?prm={id}` می‌رود -- صفحه‌ی فیلترشده‌ی همان
// کمپین با همه‌ی امکانات فیلتر. این id همون `promotions[].id` است، پس همراه
// با اسم نگه‌اش می‌داریم تا بشه دقیقاً همون لینک را ساخت. کمپین‌های
// «کارگو/ارسال رایگان» (promotionDiscountType: "Cargo") عمداً حذف می‌شن --
// طبق نظرِ صریح، نیازی نیست به مشتری نشون داده شن
function extractCampaignPromotions(
  html: string
): { id: number; name: string; endsAt: string | null; discountType: string | null }[] {
  const marker = '"promotions":[';
  const idx = html.indexOf(marker);
  if (idx === -1) return [];
  const raw = extractBracketedJson(html, idx + marker.length - 1, "[", "]");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as {
      id?: unknown;
      name?: unknown;
      promotionDiscountType?: unknown;
      promotionEndDate?: unknown;
    }[];
    const seen = new Set<number>();
    const result: { id: number; name: string; endsAt: string | null; discountType: string | null }[] = [];
    for (const p of parsed) {
      if (typeof p.id !== "number" || typeof p.name !== "string" || !p.name || seen.has(p.id)) continue;
      if (p.promotionDiscountType === "Cargo") continue;
      seen.add(p.id);
      result.push({
        id: p.id,
        name: p.name,
        endsAt: typeof p.promotionEndDate === "string" ? p.promotionEndDate : null,
        discountType: typeof p.promotionDiscountType === "string" ? p.promotionDiscountType : null,
      });
    }
    return result;
  } catch {
    return [];
  }
}

// merchantListing کلِ اطلاعاتِ فروشِ این لیستینگ رو داره: فروشنده‌ی فعلی
// (merchant) و آرایه‌ی otherMerchants[] (هر کدوم با variants[] خودش که
// price.sellingPrice داره) -- همینجا توی همون window["__envoy__SHARED_PROPS"]
// که برای promotions هم استفاده می‌کنیم embed شده، پس اسکرپِ جدا/زنده لازم نداره
function extractMerchantListing(html: string): {
  merchant: Record<string, unknown> | null;
  winnerVariant: Record<string, unknown> | null;
  otherMerchants: Record<string, unknown>[];
} {
  const marker = '"merchantListing":{';
  const idx = html.indexOf(marker);
  if (idx === -1) return { merchant: null, winnerVariant: null, otherMerchants: [] };
  const raw = extractBracketedJson(html, idx + marker.length - 1, "{", "}");
  if (!raw) return { merchant: null, winnerVariant: null, otherMerchants: [] };
  try {
    const parsed = JSON.parse(raw) as {
      merchant?: Record<string, unknown>;
      winnerVariant?: Record<string, unknown>;
      otherMerchants?: Record<string, unknown>[];
    };
    return {
      merchant: parsed.merchant ?? null,
      winnerVariant: parsed.winnerVariant ?? null,
      otherMerchants: Array.isArray(parsed.otherMerchants) ? parsed.otherMerchants : [],
    };
  } catch {
    return { merchant: null, winnerVariant: null, otherMerchants: [] };
  }
}

// اسمِ ویژگی‌هایی که معمولاً به‌عنوانِ variantAttributes میان -- فقط این چندتای
// پرتکرار رو مستقیم ترجمه می‌کنیم (بدونِ فراخوانیِ async دیکشنری کاملِ سایت،
// چون این تابع باید sync بمونه)؛ بقیه با همون اسمِ خامِ ترکی نشون داده می‌شن،
// که بازم بهتر از هیچی نشون‌ندادنه
const KNOWN_ATTRIBUTE_NAMES_FA: Record<string, string> = {
  Beden: "سایز",
  Renk: "رنگ",
};

// یه واریانت (variantAttributes) رو به برچسبِ نمایشی مثلِ "سایز: S" تبدیل می‌کنه.
// وقتی هیچ ویژگیِ نوعِ Size‌ای نیست (مثلاً محصولی که فقط رنگ داره، نه سایز)،
// همون ویژگیِ موجود رو با اسمِ خودش نشون می‌دیم -- نه اینکه هیچی نشون ندیم
function variantLabelFromAttributes(variant: Record<string, unknown> | null | undefined): string | null {
  const attrs = Array.isArray(variant?.variantAttributes)
    ? (variant!.variantAttributes as Record<string, unknown>[])
    : [];
  if (attrs.length === 0) return null;
  return (
    attrs
      .filter(
        (a): a is Record<string, unknown> & { attributeValue: string } => typeof a.attributeValue === "string"
      )
      .map((a) => {
        const rawName = typeof a.attributeName === "string" ? a.attributeName : null;
        const label =
          a.attributeType === "Size" ? "سایز" : rawName ? (KNOWN_ATTRIBUTE_NAMES_FA[rawName] ?? rawName) : "ویژگی";
        return `${label}: ${a.attributeValue}`;
      })
      .join(" / ") || null
  );
}

// قیمتِ نهایی + قیمتِ «قبل از تخفیف» + برچسبِ کمپین رو از روی یه واریانت
// می‌سازه. عمداً درصدِ تخفیف رو خودمون از رویِ نسبتِ قیمت‌ها حساب می‌کنیم (نه از
// روی متنِ خامِ کمپینِ ترندیول که ترجمه‌ش قابلِ‌اعتماد نیست) --
// discountedPrice پایین‌تر از sellingPrice یعنی یه «تخفیفِ سبدخرید» فعالِ اضافه
// روی قیمتِ عادی هست؛ وگرنه فقط تخفیفِ معمولیِ originalPrice/sellingPrice رو نشون می‌دیم
function computePriceInfo(variant: Record<string, unknown> | null | undefined): {
  price: number | null;
  originalPrice: number | null;
  campaignLabel: string | null;
} {
  const priceObj = variant?.price as Record<string, unknown> | undefined;
  const sellingPrice = (priceObj?.sellingPrice as Record<string, unknown> | undefined)?.value as number | undefined;
  const discountedPrice = (priceObj?.discountedPrice as Record<string, unknown> | undefined)?.value as
    | number
    | undefined;
  const originalPrice = (priceObj?.originalPrice as Record<string, unknown> | undefined)?.value as
    | number
    | undefined;

  const finalPrice = discountedPrice ?? sellingPrice ?? null;
  if (finalPrice == null) return { price: null, originalPrice: null, campaignLabel: null };

  if (discountedPrice != null && sellingPrice != null && discountedPrice < sellingPrice) {
    const pct = Math.round((1 - discountedPrice / sellingPrice) * 100);
    return {
      price: discountedPrice,
      originalPrice: sellingPrice,
      campaignLabel: pct > 0 ? `٪${pct.toLocaleString("fa-IR")} تخفیفِ سبدخرید` : null,
    };
  }

  if (originalPrice != null && originalPrice > finalPrice) {
    return { price: finalPrice, originalPrice, campaignLabel: null };
  }

  return { price: finalPrice, originalPrice: null, campaignLabel: null };
}

// هر فروشنده ممکنه چند variant (مثلاً چند سایز) داشته باشه -- ارزون‌ترینش رو
// به‌عنوان قیمتِ نماینده‌ی اون فروشنده نشون می‌دیم
function cheapestVariant(variants: unknown): {
  price: number | null;
  originalPrice: number | null;
  campaignLabel: string | null;
  inStock: boolean;
  freeCargo: boolean;
  variantLabel: string | null;
} {
  const empty = {
    price: null,
    originalPrice: null,
    campaignLabel: null,
    inStock: false,
    freeCargo: false,
    variantLabel: null,
  };
  if (!Array.isArray(variants)) return empty;
  let best: Record<string, unknown> | null = null;
  let bestPrice = Infinity;
  for (const v of variants as Record<string, unknown>[]) {
    const price = v?.price as Record<string, unknown> | undefined;
    const sellingPrice = (price?.sellingPrice as Record<string, unknown> | undefined)?.value;
    if (typeof sellingPrice !== "number" || sellingPrice >= bestPrice) continue;
    best = v;
    bestPrice = sellingPrice;
  }
  if (!best) return empty;
  const { price, originalPrice, campaignLabel } = computePriceInfo(best);
  return {
    price,
    originalPrice,
    campaignLabel,
    inStock: Boolean(best.inStock),
    freeCargo: Boolean(best.freeCargo),
    variantLabel: variantLabelFromAttributes(best),
  };
}

function extractSellers(
  html: string,
  tryRate: ExchangeRateInfo
): { currentSeller: TrendyolCurrentSeller | null; otherSellers: TrendyolOtherSeller[] } {
  const { merchant, winnerVariant, otherMerchants } = extractMerchantListing(html);

  const scoreOf = (m: Record<string, unknown>) => m.sellerScore as Record<string, unknown> | undefined;

  const currentSeller: TrendyolCurrentSeller | null =
    merchant && typeof merchant.id === "number" && typeof merchant.name === "string"
      ? (() => {
          const { price, originalPrice, campaignLabel } = computePriceInfo(winnerVariant);
          return {
            merchantId: merchant.id,
            name: merchant.name,
            score: (scoreOf(merchant)?.value as number | undefined) ?? null,
            scoreColor: (scoreOf(merchant)?.color as string | undefined) ?? null,
            price: price != null ? applyExchangeRate(price, tryRate) : null,
            originalPrice: originalPrice != null ? applyExchangeRate(originalPrice, tryRate) : null,
            priceTL: price,
            originalPriceTL: originalPrice,
            campaignLabel,
            variantLabel: variantLabelFromAttributes(winnerVariant),
          };
        })()
      : null;

  const otherSellers: TrendyolOtherSeller[] = otherMerchants
    .filter((m): m is Record<string, unknown> => typeof m.id === "number" && typeof m.name === "string")
    .map((m) => {
      const { price, originalPrice, campaignLabel, inStock, freeCargo, variantLabel } = cheapestVariant(m.variants);
      return {
        merchantId: m.id as number,
        name: m.name as string,
        score: (scoreOf(m)?.value as number | undefined) ?? null,
        scoreColor: (scoreOf(m)?.color as string | undefined) ?? null,
        price: price != null ? applyExchangeRate(price, tryRate) : null,
        originalPrice: originalPrice != null ? applyExchangeRate(originalPrice, tryRate) : null,
        priceTL: price,
        originalPriceTL: originalPrice,
        campaignLabel,
        inStock,
        freeCargo,
        variantLabel,
      };
    })
    .filter((s) => s.price != null)
    .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));

  return { currentSeller, otherSellers };
}

async function translateCampaignBadges(html: string): Promise<TrendyolCampaignBadge[]> {
  const promotions = extractCampaignPromotions(html);
  if (promotions.length === 0) return [];
  const translated = await Promise.all(
    promotions.map(async (p) => {
      const { text, matchedFormula, formulaId, matchedPatternTr, matchedTemplateFa } = await translateCampaignName(
        p.name
      );
      return {
        id: p.id,
        text,
        rawNameTr: p.name,
        matchedFormula,
        formulaId: formulaId ?? null,
        matchedPatternTr: matchedPatternTr ?? null,
        matchedTemplateFa: matchedTemplateFa ?? null,
        endsAt: p.endsAt,
        discountType: p.discountType,
        sampleImages: [] as string[], // بعداً توسطِ recordDiscoveredCampaigns پر می‌شه
      };
    })
  );
  // طبقِ درخواستِ صریح -- کمپینی که ادمین با تیکِ «غیرفعال» مخفی کرده، از همین‌جا
  // (قبل از رسیدن به هر کدوم از مصرف‌کننده‌ها: صفحه‌ی محصول، پوستر، ...) حذف می‌شه
  return filterOutHiddenCampaigns(translated);
}

const MAX_CAMPAIGN_SAMPLE_IMAGES = 6;

// بهترین‌تلاش -- کمپین‌های کشف‌شده‌ی این محصول رو توی جدول مشترک ثبت/به‌روز
// می‌کنه تا صفحه‌ی اصلی بتونه بدون کرالِ کاملِ ترندیول، «کمپین‌های ترندیول» رو
// نشون بده. هیچ خطایی نباید کل fetch جزئیاتِ محصول رو بترکونه. برمی‌گردونه:
// نگاشتِ campaignId -> آرایه‌ی نهاییِ عکس‌های نمونه (برای نمایشِ فوریِ همین
// صفحه، نه فقط ذخیره برای دفعه‌ی بعد) -- کمپین‌هایی از نوعِ تخفیفِ سبدخرید
// (DiscountOnBasket) اصلاً عکس جمع نمی‌کنن، چون خودِ ترندیول هم برای این نوع
// عکسِ نمونه نشون نمی‌ده
async function recordDiscoveredCampaigns(
  productUrl: string,
  badges: TrendyolCampaignBadge[],
  sampleImage: string | null
): Promise<Map<number, string[]>> {
  const result = new Map<number, string[]>();
  if (badges.length === 0) return result;
  try {
    const site = productUrl.includes("trendyol-milla") ? "TRENDYOL_MILLA" : "TRENDYOL";
    await Promise.all(
      badges.map(async (b) => {
        const showsSamples = b.discountType !== "DiscountOnBasket";
        const existing = await prisma.trendyolDiscoveredCampaign.findUnique({
          where: { campaignId_site: { campaignId: b.id, site } },
          select: { sampleImages: true },
        });
        let mergedImages: string[] = [];
        if (showsSamples) {
          const prevImages: string[] = existing?.sampleImages ? JSON.parse(existing.sampleImages) : [];
          mergedImages =
            sampleImage && !prevImages.includes(sampleImage)
              ? [...prevImages, sampleImage].slice(0, MAX_CAMPAIGN_SAMPLE_IMAGES)
              : prevImages;
        }
        result.set(b.id, mergedImages);

        await prisma.trendyolDiscoveredCampaign.upsert({
          where: { campaignId_site: { campaignId: b.id, site } },
          create: {
            campaignId: b.id,
            site,
            text: b.text,
            rawNameTr: b.rawNameTr,
            sampleImage,
            sampleImages: JSON.stringify(mergedImages),
            discountType: b.discountType,
            endsAt: b.endsAt ? new Date(b.endsAt) : null,
          },
          update: {
            text: b.text,
            rawNameTr: b.rawNameTr,
            sampleImage,
            sampleImages: JSON.stringify(mergedImages),
            discountType: b.discountType,
            endsAt: b.endsAt ? new Date(b.endsAt) : null,
            lastSeenAt: new Date(),
          },
        });
      })
    );
  } catch (err) {
    console.error("خطا در ثبتِ کمپین‌های کشف‌شده‌ی ترندیول:", err);
  }
  return result;
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
// "variants":[...] توی این صفحه‌ها چندبار تکرار می‌شه، با دو شکلِ کاملاً متفاوت:
// - شکلِ «غلط» (اسنپ‌شاتِ قیمتِ فروشنده/لیستینگِ خاص): کلیدهایی مثلِ price,
//   listingId, variantAttributes,... داره ولی هیچ‌وقت فیلدِ سطحِ‌بالای value رو نداره
// - شکلِ «درست» (لیستِ واقعیِ سایزهای قابل‌انتخابِ محصول): کلیدهاش itemNumber,
//   value, beautifiedValue, inStock,... هستن -- همیشه value داره، چه محصول
//   ۱ سایز داشته باشه چه چندتا (پس معیارِ درست «وجودِ value» ــه، نه «تعدادِ
//   مقدارهای متفاوت» -- محصولِ تک‌سایز مثلِ جوراب هیچ‌وقت با معیارِ قبلی پاس نمی‌شد)
function extractSizesFromHtml(html: string): string[] {
  const marker = '"variants":[';
  let idx = 0;
  while (true) {
    idx = html.indexOf(marker, idx);
    if (idx === -1) return [];
    const raw = extractBracketedJson(html, idx + marker.length - 1, "[", "]");
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { value?: unknown }[];
        const values = parsed.map((v) => v.value).filter((v): v is string => typeof v === "string" && v.length > 0);
        if (values.length > 0) return values;
      } catch {
        // این occurrence پارس نشد -- برو سراغِ occurrence بعدی
      }
    }
    idx += marker.length;
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
  const images = extractGalleryImagesFromHtml(html, ogImage).map(toProxiedImageUrl);
  const mainImage = images[0] ?? "";
  const sizes = extractSizesFromHtml(html);
  const rawAttributes = extractRawAttributesFromHtml(html);

  const price = typeof dataLayer.product_price === "number" ? dataLayer.product_price : null;
  const originalPrice =
    typeof dataLayer.product_original_price === "number" ? dataLayer.product_original_price : price;
  // با || null، مقدارِ واقعیِ صفر (یعنی واقعاً ناموجود) هم به‌اشتباه null
  // (یعنی «داده نداریم، نامحدود») می‌شد -- باید فقط NaN رو null کنیم، نه صفرِ واقعی
  const quantity = parseTrendyolQuantity(dataLayer.product_quantity);

  const brand = typeof dataLayer.product_brand === "string" ? dataLayer.product_brand : null;
  const rawCategoryName = typeof dataLayer.product_categoryname === "string" ? dataLayer.product_categoryname : null;
  const categoryNameFa = rawCategoryName ? (await translateTurkishPhrase(rawCategoryName)).translated : null;
  // موضوعِ اصلیِ محصول (دسته‌بندی) همیشه اولِ عنوان -- طبقِ درخواستِ صریح، تا
  // مشتری مجبور نباشه کل عنوانِ ترجمه‌شده رو بخونه تا بفهمه اصلاً چیه
  const nameFa = withCategoryPrefix(await translateTrendyolTitle(name, brand), categoryNameFa, name);
  const attributes = await Promise.all(
    rawAttributes.map(async (a) => ({
      name: await translateTrendyolAttributeText(a.name),
      value: await translateTrendyolAttributeText(a.value),
    }))
  );
  const tryRate = await getExchangeRateInfo("TRY");
  const priceInToman = price != null ? applyExchangeRate(price, tryRate) : null;
  const originalPriceInToman = originalPrice != null ? applyExchangeRate(originalPrice, tryRate) : null;
  const campaignBadges = await translateCampaignBadges(html);
  const sampleImagesByCampaign = await recordDiscoveredCampaigns(productUrl, campaignBadges, mainImage || null);
  for (const b of campaignBadges) b.sampleImages = sampleImagesByCampaign.get(b.id) ?? [];
  const { currentSeller, otherSellers } = extractSellers(html, tryRate);
  // همون فیکسِ مسیرِ اصلی (پایین‌تر، تابعِ بعدی) -- برای تخفیف‌های نوعِ
  // سبدخرید، dataLayer originalPrice رو معکوس گزارش می‌ده؛ currentSeller
  // (merchantListing) قابلِ‌اعتمادتره، وقتی موجود باشه
  const finalPrice = currentSeller?.price ?? priceInToman;
  const finalOriginalPrice = currentSeller ? currentSeller.originalPrice : originalPriceInToman;
  const finalPriceTL = currentSeller?.priceTL ?? price;
  const finalOriginalPriceTL = currentSeller ? currentSeller.originalPriceTL : originalPrice;

  return {
    contentId,
    name,
    nameFa,
    brand,
    categoryName: categoryNameFa,
    categoryNameTr: rawCategoryName,
    images,
    colorVariants: mainImage
      ? [{ contentId, colorName: "", image: mainImage, url: productUrl, price: null }]
      : [],
    attributes,
    sizes,
    price: finalPrice,
    originalPrice: finalOriginalPrice,
    priceTL: finalPriceTL,
    originalPriceTL: finalOriginalPriceTL,
    inStock: dataLayer.product_status === "Available",
    quantity,
    url: productUrl,
    campaignBadges,
    currentSeller,
    otherSellers,
  };
}

// product_quantity توی dataLayer یه رشته‌ی عددیِ ساده‌ست. صفرِ واقعی (یعنی
// واقعاً ناموجود) نباید با «داده نداریم» یکی حساب شود -- فقط NaN باید null بدهد
function parseTrendyolQuantity(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

function rawImageUrl(path: unknown): string | null {
  if (typeof path !== "string" || !path) return null;
  const absolute = path.startsWith("http")
    ? path.replace(/^http:\/\//, "https://")
    : `https://cdn.dsmcdn.com${path.startsWith("/") ? "" : "/"}${path}`;
  return toProxiedImageUrl(absolute);
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

  // JSON-LD گاهی (مثلاً روی میلا) فقط یک عکس داره، ولی گالریِ واقعیِ چندزاویه
  // همچنان توی خودِ HTML (به همون سبک PLM/QC_PREP که extractGalleryImagesFromHtml
  // برایش نوشته شده) هست -- اگه از JSON-LD بیشتر از یک عکس درنیامد، همون
  // استخراج‌کننده‌ی خام رو هم امتحان می‌کنیم و اگه واقعاً بیشتر بود جایگزین می‌کنیم
  if (images.length <= 1) {
    const richerImages = extractGalleryImagesFromHtml(html, images[0] ?? extractOgImage(html));
    if (richerImages.length > images.length) images = richerImages;
  }
  // مهم: images همین‌جا خام می‌مونه (پروکسی نمی‌شه) -- کدِ زیر (colorVariants،
  // rawImageUrl(images[0])) به نسخه‌ی خامش نیاز داره، وگرنه rawImageUrl یه
  // مسیرِ نسبی (/api/image-proxy?...) رو با cdn.dsmcdn.com/ پیشوند می‌زنه و دوباره
  // پروکسی می‌کنه (پروکسیِ تودرتو). فقط درست قبل از return نهایی پروکسی می‌شه

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

  // ترتیبِ پایدارِ رنگ‌ها -- ترندیول آرایه‌ی hasVariant را برای هر صفحه با
  // ترتیبِ متفاوتی برمی‌گرداند؛ نتیجه‌اش این بود که با هر سوییچِ رنگ (که به
  // صفحه‌ی همان رنگ می‌رود)، گریدِ سواچ‌ها «جابه‌جا» دیده می‌شد. مرتب‌سازیِ
  // عددی بر اساس contentId یک ترتیبِ کانونی می‌سازد که از همه‌ی صفحاتِ یک
  // محصول یکسان درمی‌آید -- پس انتخاب رنگ فقط هایلایت می‌کند، نه جابه‌جایی
  colorVariants.sort((a, b) => Number(a.contentId) - Number(b.contentId));

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
  const quantity = parseTrendyolQuantity(dataLayer?.product_quantity);

  const rawCategoryName = (product.pattern as string) || null;
  const categoryNameFa = rawCategoryName ? (await translateTurkishPhrase(rawCategoryName)).translated : null;
  // موضوعِ اصلیِ محصول (دسته‌بندی) همیشه اولِ عنوان -- طبقِ درخواستِ صریح
  const nameFa = withCategoryPrefix(await translateTrendyolTitle(name, brand), categoryNameFa, name);

  // قیمت‌های بالا (price, originalPrice, colorVariants[].price) همه به لیر
  // (TRY) هستن -- قبل از برگردوندن، با نرخ فعلی به تومان تبدیل می‌شن. این‌جا
  // مهم‌تره چون basePrice همین مقدار مستقیم توی AddToCartForm (که فرض می‌کنه
  // تومانه و با برچسب "تومان" نمایش می‌ده) استفاده می‌شه
  const tryRate = await getExchangeRateInfo("TRY");
  const priceInToman = price != null ? applyExchangeRate(price, tryRate) : null;
  const originalPriceInToman = originalPrice != null ? applyExchangeRate(originalPrice, tryRate) : null;
  // اسم رنگ واریانت‌ها (مثل "Bordo-Fiyonk" خامِ JSON-LD) رو هم مثل بقیه‌ی
  // ویژگی‌ها ترجمه می‌کنیم -- تولتیپ/alt سوییچرِ رنگ توی صفحه‌ی محصول و نگاه
  // سریع با همین مقدار پر می‌شه و نباید ترکی بمونه. translateTrendyolAttributeText
  // تکه‌های خط‌تیره‌دار ("bordo-fiyonk") رو هم کلمه‌به‌کلمه ترجمه می‌کنه
  const colorVariantsInToman = await Promise.all(
    colorVariants.map(async (v) => ({
      ...v,
      colorName: v.colorName ? await translateTrendyolAttributeText(v.colorName) : v.colorName,
      price: v.price != null ? applyExchangeRate(v.price, tryRate) : null,
    }))
  );
  const campaignBadges = await translateCampaignBadges(html);
  const proxiedFirstImage = images[0] ? toProxiedImageUrl(images[0]) : null;
  const sampleImagesByCampaign = await recordDiscoveredCampaigns(productUrl, campaignBadges, proxiedFirstImage);
  for (const b of campaignBadges) b.sampleImages = sampleImagesByCampaign.get(b.id) ?? [];
  const { currentSeller, otherSellers } = extractSellers(html, tryRate);

  // برای تخفیف‌های نوعِ «سبدخرید» (BASKET_PROMO)، dataLayer صفحه‌ی محصول
  // product_original_price رو *معکوس* گزارش می‌ده (کمتر از product_price،
  // یعنی همون قیمتِ بعدِ تخفیفه، نه قبلش) -- دقیقاً همون رفتاری که برای
  // singlePrice.componentType==="BASKET_PROMO" توی نتایجِ سرچ هم مستند شده
  // (بالاتر، parseBasketCampaignPercent). نتیجه: originalPrice > price
  // برقرار نمی‌شه، تخفیف اصلاً نمایش داده نمی‌شه، و به‌جای قیمتِ واقعیِ
  // تخفیف‌خورده، قیمتِ کاملِ محصول به مشتری نشون داده می‌شه. currentSeller
  // (از merchantListing، همون منبعِ دقیق‌ترِ ترندیول برای مقایسه‌ی فروشنده‌ها)
  // این مشکل رو نداره -- discountedPrice/sellingPrice رو مستقیم می‌بینه، نه
  // اینکه از originalPrice حدس بزنه -- پس وقتی موجوده، به‌جای dataLayer
  // معیارِ اصلیِ قیمت/تخفیفِ محصول می‌شه
  const finalPrice = currentSeller?.price ?? priceInToman;
  const finalOriginalPrice = currentSeller ? currentSeller.originalPrice : originalPriceInToman;
  const finalPriceTL = currentSeller?.priceTL ?? price;
  const finalOriginalPriceTL = currentSeller ? currentSeller.originalPriceTL : originalPrice;

  return {
    contentId,
    name,
    nameFa,
    brand,
    categoryName: categoryNameFa,
    categoryNameTr: rawCategoryName,
    images: images.map(toProxiedImageUrl),
    colorVariants: colorVariantsInToman,
    attributes,
    sizes: Array.from(sizesSet),
    price: finalPrice,
    originalPrice: finalOriginalPrice,
    priceTL: finalPriceTL,
    originalPriceTL: finalOriginalPriceTL,
    inStock: (product.offers as Record<string, unknown> | undefined)?.availability ===
      "https://schema.org/InStock",
    quantity,
    url: productUrl,
    campaignBadges,
    currentSeller,
    otherSellers,
  };
}
