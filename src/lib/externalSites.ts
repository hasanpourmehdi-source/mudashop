import type { ExternalSiteKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { TRENDYOL_TOP_SECTIONS } from "@/lib/trendyolTopSections";
import { fetchTrendyolAggregations } from "@/lib/trendyolAggregations";
import { suggestTranslation } from "@/lib/trendyolTranslationDictionary";
import { siteSlugToKind, MILLA_HOUSE_BRAND_IDS } from "@/lib/trendyol";

export type SelectedAttributeFilter = {
  attributeName: string; // مثلاً "جنسیت" یا "سایز"
  value: string; // مثلاً "مردانه" یا "L"
};

// یه attributeName ساختگی برای دسته‌بندی خام ترندیول (از TrendyolCategoryCache،
// نه از دسته‌بندی مزون). وقتی توی selectedAttrs این اسم دیده بشه، value همون
// پارامتر آماده‌ست (مثلاً "wc=82") و مستقیم توی URL نهایی گذاشته می‌شه، بدون
// جست‌وجوی Attribute/ExternalSiteAttributeParam -- چون کاربر مستقیم از فیلتر
// «دسته‌بندی (بر اساس جنسیت)» صفحه‌ی سایت خارجی این رو انتخاب کرده
export const TRENDYOL_RAW_CATEGORY_SENTINEL = "__trendyolCategory";

// چندتا آیدی دسته‌بندی می‌تونن با کاما توی یه param واحد بیان («wc=104443,1123,104444»)،
// ولی خودِ attrs توی URL هم چندتا توکن رو با کاما از هم جدا می‌کنه -- اگه کاماهای
// داخلی param رمزگذاری نشن، split کلی روی همون کاماها این param رو تیکه‌تیکه
// می‌کنه و آیدی‌های بعد از اولی رو گم می‌کنه. برای همین هرجا این param وارد یه
// توکن attrs می‌شه، کاماهاش با _ جایگزین می‌شن؛ و هرجا که واقعاً لازمه (جست‌وجوی
// دیتابیس، یا ساخت URL نهایی ترندیول) دوباره به کاما برمی‌گردن -- محلی، بدون
// اینکه خودِ توکن ذخیره‌شده توی URL/چیپ‌ها تغییر کنه (که باید سرتاسر یکدست بمونه)
export function encodeTrendyolCategoryParam(param: string): string {
  return param.replace(/,/g, "_");
}
export function decodeTrendyolCategoryParam(encoded: string): string {
  return encoded.replace(/_/g, ",");
}

// حذف نیم‌فاصله/فاصله برای مقایسه -- «تی‌شرت» (با نیم‌فاصله) و «تیشرت» (بدون)
// باید دقیقاً یه چیز درنظر گرفته بشن، وگرنه یه تفاوت تایپی محض باعث می‌شه
// match واقعی از دست بره
function normalizeFaForMatch(text: string): string {
  return text.replace(/[‌\s]/g, "");
}

// یه wc= واحد می‌تونه بین چندتا مسیر خیلی متفاوت مشترک باشه، چون خودِ ترندیول
// همون دسته رو زیر چند منو کراس‌لیست کرده (مثلاً «Tişört» هم زیر Kadın/Erkek
// عادی، هم زیر Anne & Çocuk به‌عنوان لباس نوزاد). درخواستِ واقعی به سایت خارجی
// (چون فقط wc= می‌فرسته) در هر صورت یکیه، ولی برای *نمایش* (چیپ سایدبار، برچسبِ
// resolveParam) باید عمومی‌ترین/بزرگ‌سالانه‌ترین مسیر انتخاب شه -- نه هرکدوم که
// findFirst اول برگردوند (که می‌تونست مثلاً به‌جای «تی‌شرت» عمومی، «زیرپوش
// تی‌شرت» زیر نوزاد رو نشون بده)
const SPECIALIZED_CATEGORY_PATH_MARKERS = ["Anne & Çocuk", "Spor & Outdoor", "Büyük Beden"];
export function pickRepresentativeCategoryRow<T extends { path: string }>(rows: T[]): T | null {
  if (rows.length === 0) return null;
  return rows.find((r) => !SPECIALIZED_CATEGORY_PATH_MARKERS.some((m) => r.path.includes(m))) ?? rows[0];
}

// وقتی متنِ سرچ دقیقاً اسمِ فارسیِ (ترجمه‌شده‌ی) یه دسته‌بندیِ واقعیه (مثلاً
// «تیشرت»)، به‌جای یه سرچ متنیِ خام، همون رفتار کلیک‌کردن روی دسته رو شبیه‌سازی
// می‌کنیم -- چیک‌باکسش توی سایدبار تیک می‌خوره و فیلترهای واقعی همون دسته
// (برند/رنگ/سایز) هم ظاهر می‌شن. عمداً مقایسه با nameFa (نه ترجمه‌ی ترکی) --
// چون یه مفهوم می‌تونه چندتا املای ترکیِ متفاوت داشته باشه («Tişört» در برابر
// «T-shirt»)، ولی معمولاً فقط یه املای فارسیِ رایج داره. فقط تطبیق دقیق (نه
// substring) -- چون یه match نادقیق ممکنه کاربر رو به یه دسته‌ی کاملاً غلط ببره
export async function matchSearchQueryToCategory(rawFaQuery: string, site: ExternalSiteKind): Promise<string | null> {
  const normalized = normalizeFaForMatch(rawFaQuery.trim());
  if (!normalized) return null;
  const rows = await prisma.trendyolCategoryCache.findMany({
    where: { site, confirmedEmpty: false, nameFa: { not: null } },
    select: { param: true, nameFa: true, path: true },
  });
  const exact = rows.filter((r) => r.nameFa && normalizeFaForMatch(r.nameFa) === normalized);
  return pickRepresentativeCategoryRow(exact)?.param ?? null;
}

export type ParsedSearchQueryFilters = {
  categoryParam: string | null;
  gender: string | null;
  colorValueId: string | null;
};

// عبارت‌های سرچِ ترکیبی («تیشرت دخترانه قرمز») هرکدوم از سه بعدِ متفاوت رو
// توضیح می‌دن: خودِ محصول (دسته‌بندی)، جنسیت، و رنگ (از TrendyolFilterCache
// واقعیِ همین سایت). هرکدوم که کلمه‌به‌کلمه دقیقاً پیدا بشه از عبارت جدا می‌شه؛
// باقیِ کلمات (اگه چیزی مونده باشه) به‌عنوان اسمِ دسته‌بندی امتحان می‌شه.
//
// نکته‌ی مهم درباره‌ی جنسیت: جدولِ Attribute مزون ۶ مقدار داره (مردانه/زنانه/
// بچگانه/دخترانه/پسرانه/یونیسکس)، ولی خودِ ترندیول به‌عنوان یه سایتِ بیرونی
// فقط دوتاش (مردانه/زنانه -- wg=1/wg=2) رو واقعاً می‌شناسه؛ «مادر و کودک»
// (بچگانه/دخترانه/پسرانه) روی ترندیول یه بخشِ دسته‌بندیه، نه یه جنسیتِ فیلترپذیر.
// اگه اینجا هر ۶ تا رو match می‌کردیم، جستجوی «... دخترانه ...» یه توکنِ
// attrs=جنسیت~دخترانه می‌ساخت که buildExternalSiteUrl هیچ نگاشتی براش پیدا
// نمی‌کنه و بی‌صدا نادیده می‌گیره -- ظاهراً «تیک خورده» ولی عملاً بی‌اثر. برای
// همین فقط مقادیری که واقعاً یه ExternalSiteAttributeParam (نگاشت به wg=) روی
// همین سایت دارن، به‌عنوان match پذیرفته می‌شن
export async function parseSearchQueryToFilters(rawQuery: string, siteSlug: string): Promise<ParsedSearchQueryFilters> {
  const words = rawQuery.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { categoryParam: null, gender: null, colorValueId: null };

  const site = siteSlugToKind(siteSlug);
  const externalSite = await prisma.externalSite.findUnique({ where: { slug: siteSlug } });
  const genderParams = externalSite
    ? await prisma.externalSiteAttributeParam.findMany({
        where: { siteId: externalSite.id, attribute: { name: "جنسیت" }, value: { not: null } },
        select: { value: true },
      })
    : [];
  // برای *تشخیص* کلمه‌ی جنسیت (تا از عبارت جدا و از قاطی‌شدن با اسمِ دسته‌بندی
  // جلوگیری بشه) هر ۶ مقدارِ جدولِ Attribute مزون قبول می‌شه؛ ولی برای واقعاً
  // *اعمال‌شدن* به‌عنوان فیلتر، فقط مقادیری که روی همین سایت نگاشتِ واقعی دارن
  // (بالا) قبول می‌شن -- وگرنه یه توکنِ ظاهراً-تیک‌خورده ولی بی‌اثر می‌ساختیم
  const allGenderValues = await prisma.attributeValue.findMany({
    where: { attribute: { name: "جنسیت" } },
    select: { value: true },
  });
  const colorRows = await prisma.trendyolFilterCache.findMany({
    where: { site, groupTitleTr: "Renk" },
    select: { valueId: true, nameFa: true },
  });

  let gender: string | null = null;
  let colorValueId: string | null = null;
  const remainingWords: string[] = [];

  for (const word of words) {
    const normalized = normalizeFaForMatch(word);
    const isGenderWord = allGenderValues.some((v) => normalizeFaForMatch(v.value) === normalized);
    if (isGenderWord) {
      if (!gender) {
        const genderMatch = genderParams.find((p) => p.value && normalizeFaForMatch(p.value) === normalized);
        if (genderMatch?.value) gender = genderMatch.value;
      }
      // چه این سایت واقعاً پشتیبانی کنه چه نه، از عبارتِ باقی‌مانده حذف می‌شه --
      // وگرنه مثلاً «دخترانه» (که ترندیول نگاشتی براش نداره) توی «تیشرت دخترانه»
      // می‌موند و match دقیقِ خودِ «تیشرت» رو هم خراب می‌کرد
      continue;
    }
    if (!colorValueId) {
      const colorMatch = colorRows.find((c) => c.nameFa && normalizeFaForMatch(c.nameFa) === normalized);
      if (colorMatch) {
        colorValueId = colorMatch.valueId;
        continue;
      }
    }
    remainingWords.push(word);
  }

  const remainingText = remainingWords.join(" ");
  const categoryParam = remainingText ? await matchSearchQueryToCategory(remainingText, site) : null;

  return { categoryParam, gender, colorValueId };
}

// رنگ و برند هم مثل دسته‌بندی «خام»ان (مستقیم از aggregations واقعی ترندیول
// میان)، ولی برخلاف دسته‌بندی، چندانتخابی واقعی‌ان -- یعنی چندتا مقدار باید با
// هم توی یه پارامتر (wcl=19,3 یا wb=43,300) ادغام بشن، نه هرکدوم پارامتر جدا.
// برای همین value این‌ها فقط خودِ آیدی خامه (نه "wcl=19" کامل)، تا بشه راحت
// join کرد
export const TRENDYOL_RAW_COLOR_SENTINEL = "__trendyolColor";
export const TRENDYOL_RAW_BRAND_SENTINEL = "__trendyolBrand";

// ویژگی‌های خاصِ هر دسته (مثل «Çanta Tipi»، «Ekran Boyut Aralığı») -- پارامتر
// عمومی "attr=<filterKey>|<valueId>" داره (مثلاً attr=314|1196861)؛ چندتا
// انتخاب مختلف (حتی از گروه‌های متفاوت) با کاما جمع می‌شن. value این سنتینل
// از قبل خودِ "filterKey|valueId" کاملـه (تا بشه مستقیم join کرد)
export const TRENDYOL_RAW_ATTR_SENTINEL = "__trendyolAttr";

// ویژگی‌های خاص هر دسته (مثل «Çanta Tipi») پارامتر عمومی "attr=" دارن، ولی
// «Beden» (سایز) قاعده‌ی خودش رو داره -- پارامترش "vr=" ه (تأیید‌شده با تست
// واقعی: vr=size|group-l)، نه attr=. برای همین یه سنتینل جدا داره؛ value این
// سنتینل هم مثل attr از قبل کامل "size|group-6xl" کاملـه
export const TRENDYOL_RAW_VARIANT_SENTINEL = "__trendyolVariant";

// «Avantajlı Ürünler» (تگ‌های کمپینی) -- پارامتر tag=<id1,id2>
export const TRENDYOL_RAW_TAG_SENTINEL = "__trendyolTag";

// «Satıcı Tipi» -- پارامتر mb=<id1,id2>
export const TRENDYOL_RAW_MERCHANT_BADGE_SENTINEL = "__trendyolMerchantBadge";

// فیات (بازه‌ی قیمت، پیش‌فرض‌های آماده مثل "500-1000") -- تک‌انتخابی، پارامتر
// prc=<value> مستقیم (چون خودِ آیدی هر پیش‌فرض از قبل به شکل "min-max"ه)
export const TRENDYOL_RAW_PRICE_SENTINEL = "__trendyolPrice";

// امتیاز محصول (مثلاً "۴ ستاره به بالا") -- تک‌انتخابی، پارامتر pr=<value>
export const TRENDYOL_RAW_RATING_SENTINEL = "__trendyolRating";

// لینک محصولات یه سایت خارجی (ترندیول، ترندیول‌میلا، ...) رو برای یه دسته‌بندی +
// چندتا فیلتر ویژگی (جنسیت، سایز، ...) می‌سازه، بر اساس نگاشت‌هایی که توی پنل
// ادمین (ExternalSite -> ExternalSiteCategoryParam / ExternalSiteAttributeParam)
// تعریف شده. اگه نگاشتی برای یه بخش پیدا نشه، همون بخش رو نادیده می‌گیره (لینک
// کلی‌تری می‌سازه، به‌جای اینکه کامل شکست بخوره).
// حروف خاص ترکی هم باید به معادل ساده‌شون تبدیل بشن (مثلاً اگه ادمین دقیقاً
// همون برچسب ترکی سایت مقصد رو کپی کرده باشه، مثل «Büyük Boy» -> buyuk-boy)
const TURKISH_CHAR_MAP: Record<string, string> = {
  ü: "u",
  ş: "s",
  ı: "i",
  ğ: "g",
  ç: "c",
  ö: "o",
};

// طبق نمونه‌های واقعی ترندیول: کاما («۳۹,۵»)، فاصله («Büyük Boy» -> buyuk-boy)،
// و علامت + («50 x 60 + 60 x 100» -> 50-x-60---60-x-100) همه با خط‌تیره
// جایگزین می‌شن -- هرکدوم جدا (نه اینکه چندتا پشت‌سرهم یه خط‌تیره بشن، برای
// همین از [ ] ساده استفاده می‌کنیم نه [ ]+ که رشته‌های پشت‌سرهم رو یکی می‌کنه)
export function normalizeUrlValue(value: string): string {
  const lowered = value.trim().toLowerCase();
  const transliterated = lowered.replace(/[üşığçö]/g, (ch) => TURKISH_CHAR_MAP[ch] ?? ch);
  return transliterated.replace(/[\s,+]/g, "-");
}

// sharedKey توی دیتابیس به‌صورت خام ذخیره می‌شه (مثلاً "vr=size|") چون ادمین
// دقیقاً همون چیزی که تو URL واقعی ترندیول دیده رو کپی می‌کنه. ولی "|" یه کاراکتر
// خامه که تو query string معتبر نیست -- باید حتماً %7C بشه، وگرنه ترندیول 404
// می‌ده (برخلاف "=" و "&" که بخشی از ساختار خود query هستن و نباید encode بشن)
export function encodeRawPipe(part: string): string {
  return part.replace(/\|/g, "%7C");
}

export async function buildExternalSiteUrl(
  siteSlug: string,
  categorySlug: string | null,
  selectedAttrs: SelectedAttributeFilter[] = []
): Promise<string | null> {
  const site = await prisma.externalSite.findUnique({ where: { slug: siteSlug } });
  if (!site || !site.isActive) return null;

  const parts: string[] = [];

  if (categorySlug) {
    const category = await prisma.category.findUnique({ where: { slug: categorySlug } });
    if (category) {
      const categoryParam = await prisma.externalSiteCategoryParam.findUnique({
        where: { siteId_categoryId: { siteId: site.id, categoryId: category.id } },
      });
      if (categoryParam) parts.push(encodeRawPipe(categoryParam.param));
    }
  }

  // بعضی ویژگی‌ها (مثل «سایز حرفی»، «سایز عددی»، «سایز سنی») باید زیر یه کلید
  // مشترک (مثلاً "vr=size|") جمع بشن -- هرکدوم قالب تبدیل مقدار خودشو داره، ولی
  // نتیجه‌هاشون با _ به‌هم می‌چسبن و کلید فقط یه‌بار میاد
  const sharedGroups = new Map<string, string[]>();
  const rawColorIds: string[] = [];
  const rawBrandIds: string[] = [];
  const rawAttrPairs: string[] = []; // هرکدوم از قبل "filterKey|valueId"ه
  const rawVariantPairs: string[] = []; // مخصوص «Beden» -- هرکدوم از قبل "size|valueId"ه
  const rawTagIds: string[] = [];
  const rawMerchantBadgeIds: string[] = [];
  let rawPriceValue: string | null = null; // تک‌انتخابی
  let rawRatingValue: string | null = null; // تک‌انتخابی

  let rawCategoryValue: string | null = null; // تک‌انتخابی -- اگه چندتا رسید، آخری برنده‌ست

  for (const filter of selectedAttrs) {
    // انتخاب دسته‌بندی خام ترندیول (از جدول TrendyolCategoryCache، بر اساس
    // جنسیت فیلتر شده) -- مقدارش از قبل خودِ پارامتر آماده‌ست (مثلاً "wc=82")،
    // نیازی به جست‌وجوی Attribute/ExternalSiteAttributeParam نداره. حتی اگه
    // به هر دلیلی (باگ سمت کلاینت) چندتا توکن دسته‌بندی هم‌زمان برسه، فقط
    // آخری رو نگه می‌داریم -- ترندیول با دو تا wc= جدا کلاً رد می‌ده
    if (filter.attributeName === TRENDYOL_RAW_CATEGORY_SENTINEL) {
      rawCategoryValue = decodeTrendyolCategoryParam(filter.value);
      continue;
    }
    // رنگ و برند خام -- چندانتخابی، پس فقط جمع می‌کنیم؛ بعد از حلقه یه‌جا با
    // هم به wcl=/wb= تبدیل می‌شن
    if (filter.attributeName === TRENDYOL_RAW_COLOR_SENTINEL) {
      rawColorIds.push(filter.value);
      continue;
    }
    if (filter.attributeName === TRENDYOL_RAW_BRAND_SENTINEL) {
      rawBrandIds.push(filter.value);
      continue;
    }
    // ویژگی‌های خاصِ دسته -- value از قبل خودِ "filterKey|valueId"ه
    if (filter.attributeName === TRENDYOL_RAW_ATTR_SENTINEL) {
      rawAttrPairs.push(filter.value);
      continue;
    }
    if (filter.attributeName === TRENDYOL_RAW_VARIANT_SENTINEL) {
      rawVariantPairs.push(filter.value);
      continue;
    }
    if (filter.attributeName === TRENDYOL_RAW_TAG_SENTINEL) {
      rawTagIds.push(filter.value);
      continue;
    }
    if (filter.attributeName === TRENDYOL_RAW_MERCHANT_BADGE_SENTINEL) {
      rawMerchantBadgeIds.push(filter.value);
      continue;
    }
    // فیات و امتیاز تک‌انتخابی‌ان -- اگه به هر دلیلی چندتا توکن باشه، آخری برنده‌ست
    if (filter.attributeName === TRENDYOL_RAW_PRICE_SENTINEL) {
      rawPriceValue = filter.value;
      continue;
    }
    if (filter.attributeName === TRENDYOL_RAW_RATING_SENTINEL) {
      rawRatingValue = filter.value;
      continue;
    }

    const attribute = await prisma.attribute.findUnique({ where: { name: filter.attributeName } });
    if (!attribute) continue;

    const encodedValue = encodeURIComponent(normalizeUrlValue(filter.value));

    // اول دنبال mapping دقیق همین مقدار بگرد (مثل جنسیت=مردانه)
    const exactMatch = await prisma.externalSiteAttributeParam.findUnique({
      where: {
        siteId_attributeId_value: { siteId: site.id, attributeId: attribute.id, value: filter.value },
      },
    });
    if (exactMatch) {
      const transformed = exactMatch.paramTemplate.includes("{value}")
        ? exactMatch.paramTemplate.replace("{value}", encodedValue)
        : exactMatch.paramTemplate;
      if (exactMatch.sharedKey) {
        const list = sharedGroups.get(exactMatch.sharedKey) ?? [];
        if (!list.includes(transformed)) list.push(transformed);
        sharedGroups.set(exactMatch.sharedKey, list);
      } else {
        parts.push(encodeRawPipe(transformed));
      }
      continue;
    }

    // وگرنه دنبال قالب عمومی این ویژگی بگرد (value=null، مثل سایز)
    const genericTemplate = await prisma.externalSiteAttributeParam.findFirst({
      where: { siteId: site.id, attributeId: attribute.id, value: null },
    });
    if (genericTemplate) {
      const transformed = genericTemplate.paramTemplate.replace("{value}", encodedValue);
      if (genericTemplate.sharedKey) {
        const list = sharedGroups.get(genericTemplate.sharedKey) ?? [];
        // چندتا ویژگی مختلف (سایز کفش، سایز عددی، ...) ممکنه بعد از تبدیل، دقیقاً
        // یه مقدار یکسان تولید کنن (مثلاً هر سه‌تا "42") -- برای جلوگیری از
        // "vr=size|42_42_42" فقط یه‌بار اضافه‌ش می‌کنیم
        if (!list.includes(transformed)) list.push(transformed);
        sharedGroups.set(genericTemplate.sharedKey, list);
      } else {
        parts.push(encodeRawPipe(transformed));
      }
    }
  }

  // هر گروه مشترک رو با _ به‌هم بچسبون و به‌عنوان یه پارامتر واحد اضافه کن
  for (const [sharedKey, values] of sharedGroups) {
    parts.push(encodeRawPipe(`${sharedKey}${values.join("_")}`));
  }

  // چندتا رنگ/برند انتخاب‌شده رو با کاما توی یه پارامتر واحد ادغام کن (مثلاً
  // wcl=19,3،‌ نه wcl=19&wcl=3 -- ترندیول فقط شکل اول رو درست می‌فهمه)
  if (rawCategoryValue) parts.push(encodeRawPipe(rawCategoryValue));
  if (rawColorIds.length > 0) parts.push(`wcl=${rawColorIds.join(",")}`);
  if (rawBrandIds.length > 0) {
    parts.push(`wb=${rawBrandIds.join(",")}`);
  } else if (siteSlugToKind(siteSlug) === "TRENDYOL_MILLA") {
    // میلا یه فروشگاه تک‌مجموعه‌ست -- بدون این محدودیت، جست‌وجوی wc= خام روی
    // میلا نتایجی از هر برندی برمی‌گردوند که هیچ‌وقت واقعاً روی میلا فروخته
    // نمی‌شن؛ خودِ سایت واقعی هم همیشه با wb= همین ۶ آیدی محدودش می‌کنه.
    // فقط وقتی کاربر خودش برندی انتخاب نکرده اعمال می‌شه (مثل پیش‌فرض جنسیت)
    parts.push(`wb=${MILLA_HOUSE_BRAND_IDS}`);
  }
  if (rawAttrPairs.length > 0) parts.push(`attr=${encodeRawPipe(rawAttrPairs.join(","))}`);
  if (rawVariantPairs.length > 0) parts.push(`vr=${encodeRawPipe(rawVariantPairs.join(","))}`);
  if (rawTagIds.length > 0) parts.push(`tag=${rawTagIds.join(",")}`);
  if (rawMerchantBadgeIds.length > 0) parts.push(`mb=${rawMerchantBadgeIds.join(",")}`);
  if (rawPriceValue) parts.push(`prc=${rawPriceValue}`);
  if (rawRatingValue) parts.push(`pr=${rawRatingValue}`);

  if (parts.length === 0) return null; // هیچ نگاشتی پیدا نشد، لینک بی‌معنی می‌شه (فقط baseUrl خام)

  return `${site.baseUrl}${parts.join("&")}`;
}

export type ActiveFilterChip = { token: string; label: string };

// برای هرکدوم از فیلترهای فعلاً انتخاب‌شده (دسته‌بندی، جنسیت، رنگ، برند، ...)
// یه برچسب فارسی خوانا برمی‌گردونه -- برای نمایش به‌صورت چیپ‌های قابل‌حذف بالای
// نتایج، دقیقاً مثل ردیف فیلترهای فعال خودِ ترندیول
export async function resolveActiveFilterChips(
  selectedAttrs: SelectedAttributeFilter[],
  siteSlug: string
): Promise<ActiveFilterChip[]> {
  const site = siteSlugToKind(siteSlug);
  const chips: ActiveFilterChip[] = [];

  // برای رنگ/برند/تگ/نوع‌فروشنده، باید اول filterKey واقعی همون گروه رو پیدا
  // کنیم (چون توی توکن فقط valueId ذخیره شده، نه filterKey) -- از عنوان
  // سرگروهی که موقع sync ذخیره شده استفاده می‌کنیم
  const GROUP_TITLE_FOR_SENTINEL: Record<string, string> = {
    [TRENDYOL_RAW_COLOR_SENTINEL]: "Renk",
    [TRENDYOL_RAW_BRAND_SENTINEL]: "Marka",
    [TRENDYOL_RAW_TAG_SENTINEL]: "Avantajlı Ürünler",
    [TRENDYOL_RAW_MERCHANT_BADGE_SENTINEL]: "Satıcı Tipi",
  };
  const neededGroupTitles = Object.values(GROUP_TITLE_FOR_SENTINEL);
  const groupHeaders = await prisma.trendyolFilterCache.findMany({
    where: { site, valueId: "", nameTr: { in: neededGroupTitles } },
    select: { nameTr: true, filterKey: true },
  });
  const filterKeyByGroupTitle = new Map(groupHeaders.map((g) => [g.nameTr, g.filterKey]));

  // اگه یه valueId توی TrendyolFilterCache نبود (چون هیچ‌وقت با همگام‌سازی
  // دستی ادمین دیده نشده)، به‌جای نمایش خودِ آیدی خام بالای لیست، از خودِ
  // ترندیول زنده می‌پرسیم -- دقیقاً همون فال‌بکی که سایدبار
  // (trendyol-filters/route.ts) هم برای مقادیر ناشناخته استفاده می‌کنه (متن
  // ترکی به‌جای آیدی خام). چون این‌جا selectedAttrs دسته‌بندی رو هم می‌تونه
  // شامل بشه، همون wc رو (اگه بود) به aggregations می‌دیم تا مقادیر درست
  // همون دسته برگردن
  const categoryFilter = selectedAttrs.find((f) => f.attributeName === TRENDYOL_RAW_CATEGORY_SENTINEL);
  const wcForLiveLookup = categoryFilter ? decodeTrendyolCategoryParam(categoryFilter.value) : undefined;
  const pendingByGroupTitle = new Map<
    string,
    { valueId: string; filterKey: string; chip: ActiveFilterChip }[]
  >();
  // ویژگی‌ها/سایزها (attr=/vr=) از قبل خودِ filterKey رو توی توکن دارن، پس
  // نیازی به نگاشتِ groupTitle→filterKey ندارن -- فقط اگه کش نشده باشن، یکجا
  // با یه fetchTrendyolAggregations بدون فیلترِ عنوان (همه‌ی گروه‌ها) حل می‌شن
  const pendingAttrItems: { filterKey: string; valueId: string; chip: ActiveFilterChip }[] = [];

  for (const filter of selectedAttrs) {
    const token = `${filter.attributeName}~${filter.value}`;

    if (filter.attributeName === "جنسیت") {
      chips.push({ token, label: filter.value });
      continue;
    }

    if (filter.attributeName === TRENDYOL_RAW_CATEGORY_SENTINEL) {
      const decodedParam = decodeTrendyolCategoryParam(filter.value);
      // اگه این دقیقاً وکِ ریشه‌ی یکی از ۸ بخش غیرجنسیتیه (نه یه زیرشاخه‌ی
      // واقعی توی جدول)، ردیفی توی TrendyolCategoryCache برایش پیدا نمی‌شه --
      // لیبل باید همون اسم فارسیِ خودِ بخش باشه، نه رشته‌ی خام wc=...
      const sectionMatch = TRENDYOL_TOP_SECTIONS.find((s) => !s.isGenderSection && s.rootWc === decodedParam);
      if (sectionMatch) {
        chips.push({ token, label: sectionMatch.fa });
        continue;
      }
      const cached = await prisma.trendyolCategoryCache.findFirst({ where: { site, param: decodedParam } });
      chips.push({ token, label: cached?.nameFa ?? cached?.nameTr ?? filter.value });
      continue;
    }

    if (filter.attributeName === TRENDYOL_RAW_PRICE_SENTINEL) {
      const [min, max] = filter.value.split("-");
      chips.push({ token, label: `قیمت: ${min ?? 0} تا ${max ?? "∞"} لیر` });
      continue;
    }

    if (filter.attributeName === TRENDYOL_RAW_RATING_SENTINEL) {
      chips.push({ token, label: `امتیاز ${filter.value}+` });
      continue;
    }

    if (filter.attributeName === TRENDYOL_RAW_ATTR_SENTINEL || filter.attributeName === TRENDYOL_RAW_VARIANT_SENTINEL) {
      const [attrFilterKey, valueId] = filter.value.split("|");
      const cached = await prisma.trendyolFilterCache.findUnique({
        where: { site_filterKey_valueId: { site, filterKey: attrFilterKey, valueId } },
      });
      const chip = { token, label: cached?.nameFa ?? cached?.nameTr ?? filter.value };
      chips.push(chip);
      // اگه هنوز کش نشده (مثلاً سایزی که تازه از سرچ/گرید انتخاب شده، نه از
      // سایدبار سینک‌شده)، به‌جای نشون‌دادنِ خودِ توکنِ خام (filterKey|valueId)،
      // پایین‌تر یکجا با aggregations زنده جایگزینش می‌کنیم
      if (!cached) pendingAttrItems.push({ filterKey: attrFilterKey, valueId, chip });
      continue;
    }

    const groupTitle = GROUP_TITLE_FOR_SENTINEL[filter.attributeName];
    if (groupTitle) {
      const filterKey = filterKeyByGroupTitle.get(groupTitle);
      const cached = filterKey
        ? await prisma.trendyolFilterCache.findUnique({
            where: { site_filterKey_valueId: { site, filterKey, valueId: filter.value } },
          })
        : null;
      const chip = { token, label: cached?.nameFa ?? cached?.nameTr ?? filter.value };
      chips.push(chip);
      if (!cached && filterKey) {
        if (!pendingByGroupTitle.has(groupTitle)) pendingByGroupTitle.set(groupTitle, []);
        pendingByGroupTitle.get(groupTitle)!.push({ valueId: filter.value, filterKey, chip });
      }
      continue;
    }

    // بقیه (فیلترهای عادی مزون) -- همون مقدار خام، این‌جا نیازی به ترجمه نداره
    chips.push({ token, label: `${filter.attributeName}: ${filter.value}` });
  }

  if (pendingByGroupTitle.size > 0) {
    for (const [groupTitle, pending] of pendingByGroupTitle) {
      try {
        const [group] = await fetchTrendyolAggregations({ wc: wcForLiveLookup }, [groupTitle], site);
        if (!group) continue;
        const textById = new Map(group.values.map((v) => [v.id, v.text]));
        for (const p of pending) {
          const text = textById.get(p.valueId);
          if (!text) continue;
          p.chip.label = text;
          // کش کن تا دفعه‌ی بعد دیگه نیازی به فچ زنده نباشه -- اگه فرهنگ‌لغت
          // یه معادل دقیق شناخته‌شده داشت، همون‌جا با nameFaSuggested=true پر
          // می‌شه (دقیقاً مثل همگام‌سازی دستیِ ادمین)
          const suggested = await suggestTranslation(text);
          await prisma.trendyolFilterCache.upsert({
            where: { site_filterKey_valueId: { site, filterKey: p.filterKey, valueId: p.valueId } },
            update: { nameTr: text },
            create: {
              site,
              filterKey: p.filterKey,
              valueId: p.valueId,
              nameTr: text,
              nameFa: suggested,
              nameFaSuggested: suggested !== null,
              groupTitleTr: groupTitle,
            },
          });
        }
      } catch {
        // زنده هم شکست خورد -- همون آیدی خام (که قبلاً به‌عنوان لیبل موقت
        // گذاشته شده) می‌مونه؛ حداقل صفحه از کار نمی‌افته
      }
    }
  }

  if (pendingAttrItems.length > 0) {
    try {
      // بدون فیلترِ عنوان -- چون filterKey رو از قبل داریم، نیازی به دونستنِ
      // عنوانِ ترکیِ گروه (مثل «Beden») نیست؛ فقط لازمه بین همه‌ی گروه‌های
      // برگشتی، گروهِ هم‌filterKey رو پیدا کنیم
      const allGroups = await fetchTrendyolAggregations({ wc: wcForLiveLookup }, undefined, site);
      for (const p of pendingAttrItems) {
        const group = allGroups.find((g) => g.filterKey === p.filterKey);
        const value = group?.values.find((v) => v.id === p.valueId);
        if (!value) continue;
        p.chip.label = value.text;
        const suggested = await suggestTranslation(value.text);
        await prisma.trendyolFilterCache.upsert({
          where: { site_filterKey_valueId: { site, filterKey: p.filterKey, valueId: p.valueId } },
          update: { nameTr: value.text },
          create: {
            site,
            filterKey: p.filterKey,
            valueId: p.valueId,
            nameTr: value.text,
            nameFa: suggested,
            nameFaSuggested: suggested !== null,
            groupTitleTr: group?.title,
          },
        });
      }
    } catch {
      // زنده هم شکست خورد -- همون توکنِ خامِ filterKey|valueId که قبلاً
      // به‌عنوان لیبلِ موقت گذاشته شده می‌مونه؛ حداقل صفحه از کار نمی‌افته
    }
  }

  return chips;
}

// همه‌ی سایت‌های فعال رو برای یه دسته‌بندی + فیلترها برمی‌گردونه (برای نمایش چندتا
// بج «TY»، «ترندیول‌میلا» و... کنار هم توی منو)
export async function buildAllExternalSiteUrls(
  categorySlug: string | null,
  selectedAttrs: SelectedAttributeFilter[] = []
): Promise<{ siteName: string; siteSlug: string; url: string }[]> {
  const sites = await prisma.externalSite.findMany({ where: { isActive: true } });
  const results: { siteName: string; siteSlug: string; url: string }[] = [];

  for (const site of sites) {
    const url = await buildExternalSiteUrl(site.slug, categorySlug, selectedAttrs);
    if (url) results.push({ siteName: site.name, siteSlug: site.slug, url });
  }

  return results;
}

export type SiteDefaultFilters = {
  categorySlug: string | null;
  attrs: SelectedAttributeFilter[];
};

// فیلترهایی که ادمین به‌عنوان «صفحه‌ی اول» این سایت تیک زده -- وقتی کاربر بدون
// هیچ فیلتر دستی وارد صفحه‌ی این سایت می‌شه، همین‌ها به‌جای فید خامِ صفحه‌ی اصلی
// (یا پیام خالی) استفاده می‌شن
export async function getSiteDefaultFilters(siteSlug: string): Promise<SiteDefaultFilters> {
  const site = await prisma.externalSite.findUnique({
    where: { slug: siteSlug },
    include: {
      categoryParams: { where: { isDefault: true }, include: { category: true } },
      attributeParams: { where: { isDefault: true }, include: { attribute: true } },
    },
  });
  if (!site) return { categorySlug: null, attrs: [] };

  return {
    categorySlug: site.categoryParams[0]?.category.slug ?? null,
    attrs: site.attributeParams
      .filter((ap) => ap.value !== null)
      .map((ap) => ({ attributeName: ap.attribute.name, value: ap.value as string })),
  };
}

// دسته‌بندی و هر ویژگی مستقل از هم پیش‌فرض می‌گیرن، نه به‌صورت همه‌یا-هیچ.
// این مهمه چون بعضی سایت‌ها (مثل ترندیول فعلی) اصلاً دسته‌بندی پیش‌فرض ثبت
// نکردن، بلکه یه مقدار پیش‌فرض روی خودِ ویژگی «جنسیت» (wg=1) دارن که نقش
// "دامنه"/scope رو بازی می‌کنه -- بدونش خیلی از فیلترهای دیگه (فقط سایز، فقط
// رنگ، ...) روی ترندیول 404 می‌دن، چون این سایت هیچ‌وقت بدون یه wg= یا wc=
// جواب نمی‌ده. برای همین: برای هر ویژگی‌ای که پیش‌فرض داره، فقط وقتی کاربر
// خودش برای همون ویژگی (نه هر ویژگی‌ای) مقداری انتخاب نکرده باشه، پیش‌فرضش
// اضافه می‌شه. همین تابع هم توی صفحه‌ی سرور و هم توی API اعتبارسنجی فیلتر
// استفاده می‌شه تا دو جا منطق متفاوتی نداشته باشن
// پیش‌فرض «جنسیت» فقط برای بخش‌های جنسیتی (زنانه/مردانه -- Kadın/Erkek) معنی
// داره؛ توی بخش‌های دیگه (سوپرمارکت، آرایشی، الکترونیک، ...) خودِ ترندیول اصلاً
// جنسیتی نمی‌شناسه، پس اعمال خودکارش اونجا هم منطقی نیست هم باعث می‌شه کاربر
// نتونه با برداشتن تیک جنسیت واقعاً بی‌اثرش کنه (چون همین تابع دوباره برش می‌گردونه).
// یه پیش‌فرضِ ثابت («جنسیت سایت») هم اصلاً معنی ندارد -- اگه خودِ دسته‌بندی
// جنسیت مشخصی داره (مثلاً «Kişisel Bakım» زیر Erkek)، باید دقیقاً همون جنسیت
// اعمال بشه، نه جنسیتِ پیش‌فرضِ کلِ سایت (که ممکنه برعکسش باشه و نتیجه‌ی
// کاملاً بی‌ربط/خالی بده -- دقیقاً همون چیزی که روی میلا برای wc=89 دیده شد)
async function resolveGenderForCategory(
  rawCategoryParam: string,
  site: ExternalSiteKind
): Promise<{ scoped: boolean; gender: "زنانه" | "مردانه" | null }> {
  // توکن‌های وکِ ریشه‌ی ۸ بخش غیرجنسیتی (که از trendyolTopSections.ts میان، نه
  // خودِ TrendyolCategoryCache -- چون خودِ ترندیول برای «کل بخش» به‌جای wc= به
  // یه صفحه‌ی بوتیک لینک می‌ده) هیچ ردیفی توی جدول ندارن؛ اگه این‌جا رد بشن،
  // fallback پایین (چون ردیفی پیدا نمی‌شه) به‌اشتباه scoped=true برمی‌گردوند و
  // «جنسیت: زنانه» رو به‌زور به نتایجِ مثلاً «خانه و زندگی» اضافه می‌کرد
  if (TRENDYOL_TOP_SECTIONS.some((s) => !s.isGenderSection && s.rootWc === rawCategoryParam)) {
    return { scoped: false, gender: null };
  }
  // همون wc= می‌تونه زیر چندتا مسیر متفاوت تکرار شده باشه (کراس‌لیست خودِ
  // ترندیول) -- findFirst یه ردیفِ دلبخواهی برمی‌گردوند که ممکن بود کاملاً
  // بی‌ربط باشه (مثلاً «Tişört» که هم زیر Kadın/Erkek عادیه هم زیر Anne & Çocuk
  // به‌عنوان لباس نوزاد). این‌جا *همه‌ی* مسیرهای این wc= رو می‌بینیم: فقط اگه
  // همه‌شون دقیقاً یه جنسیت رو نشون بدن (مثلاً همه Erkek)، همون تحمیل می‌شه؛
  // اگه بین جنسیت‌ها مشترکه یا اصلاً جنسیتی نیست، بهتره جنسیتی تحمیل نشه
  const rows = await prisma.trendyolCategoryCache.findMany({ where: { site, param: rawCategoryParam } });
  if (rows.length === 0) {
    // مسیرش رو نمی‌دونیم -- برای عدم تغییر رفتار قبلی، همچنان فرض می‌کنیم
    // جنسیتی هست، ولی جنسیتِ خاصی رو تحمیل نمی‌کنیم (gender: null یعنی
    // صدازننده به پیش‌فرضِ کلِ سایت برگردد -- تنها جایی که واقعاً معنی دارد:
    // خودِ لندینگ سایت)
    return { scoped: true, gender: null };
  }
  const topSections = new Set(rows.map((r) => r.path.split(" > ")[0]));
  if (topSections.size === 1) {
    const only = [...topSections][0];
    if (only === "Kadın") return { scoped: true, gender: "زنانه" };
    if (only === "Erkek") return { scoped: true, gender: "مردانه" };
  }
  return { scoped: false, gender: null };
}

export async function resolveEffectiveFilters(
  siteSlug: string,
  category: string | null,
  attrs: SelectedAttributeFilter[],
  // اسم ترکی بخشی که کاربر از نوار افقی/گرید ۱۰تایی انتخاب کرده، قبل از این‌که
  // هنوز به یه دسته‌بندی خام واقعی (wc=) درلدون کرده باشه -- خودِ این بخش‌ها
  // پارامتر دسته‌بندی مستقل ندارن، پس نمی‌شه از رو attrs تشخیصشون داد
  explicitTopSection?: string | null
): Promise<{ categorySlug: string | null; attrs: SelectedAttributeFilter[] }> {
  const defaults = await getSiteDefaultFilters(siteSlug);
  const categorySlug = category || defaults.categorySlug;

  const rawCategoryToken = attrs.find((a) => a.attributeName === TRENDYOL_RAW_CATEGORY_SENTINEL);
  const genderInfo = rawCategoryToken
    ? await resolveGenderForCategory(decodeTrendyolCategoryParam(rawCategoryToken.value), siteSlugToKind(siteSlug))
    : explicitTopSection
      ? {
          scoped: explicitTopSection === "Kadın" || explicitTopSection === "Erkek",
          gender:
            explicitTopSection === "Kadın"
              ? ("زنانه" as const)
              : explicitTopSection === "Erkek"
                ? ("مردانه" as const)
                : null,
        }
      : { scoped: true, gender: null }; // بدون هیچ دسته/بخشی -- لندینگِ خودِ سایت، پیش‌فرض کل‌سایت معنی دارد

  const selectedAttrNames = new Set(attrs.map((a) => a.attributeName));
  const missingDefaults = defaults.attrs
    .filter((d) => !selectedAttrNames.has(d.attributeName) && (d.attributeName !== "جنسیت" || genderInfo.scoped))
    // اگه خودِ دسته‌بندی جنسیتِ مشخصی دارد (مثلاً «Kişisel Bakım» زیر Erkek)،
    // همون جنسیت جای مقدار پیش‌فرضِ کل‌سایت می‌نشیند -- نه برعکسش
    .map((d) => (d.attributeName === "جنسیت" && genderInfo.gender ? { ...d, value: genderInfo.gender } : d));
  const effectiveAttrs = [...attrs, ...missingDefaults];

  return { categorySlug, attrs: effectiveAttrs };
}

export type SiteFilterOptions = {
  site: { id: string; name: string; slug: string; baseUrl: string };
  categories: { id: string; name: string; slug: string }[];
  // هر ویژگی + مقادیر قابل‌انتخابش برای همین سایت (یا مقادیر ثبت‌شده‌ی خاص، یا
  // اگه قالب عمومی داشت، همه‌ی مقادیر واقعی همون ویژگی توی خودمون)
  // groupName: اگه این ویژگی عضو یه AttributeGroup باشه (مثلا "سایز لباس" و "سایز
  // کفش" هر دو عضو سرگروه "سایز")، همین جا میاد -- سمت UI باید این‌ها رو زیر یه
  // بخش فیلتر واحد به اسم سرگروه نشون بده (دقیقاً مثل فیلترهای مزون)، ولی هر مقدار
  // موقع ارسال هنوز با attributeName واقعی خودش (نه اسم سرگروه) به سرور می‌ره
  attributeFilters: {
    attributeId: string;
    attributeName: string;
    groupName: string | null;
    values: string[];
  }[];
};

// فقط دسته‌بندی‌ها و ویژگی‌هایی که واقعاً برای این سایت نگاشت ثبت شده رو برمی‌گردونه --
// برای ساختن فرم فیلتر مخصوص هر سایت (نه کل فیلترهای مزون)
export async function getSiteFilterOptions(siteSlug: string): Promise<SiteFilterOptions | null> {
  const site = await prisma.externalSite.findUnique({
    where: { slug: siteSlug },
    include: {
      categoryParams: { include: { category: { select: { id: true, name: true, slug: true } } } },
      attributeParams: {
        include: {
          attribute: {
            include: {
              values: { orderBy: { order: "asc" } },
              group: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!site || !site.isActive) return null;

  const categories = site.categoryParams.map((cp) => cp.category);

  // گروه‌بندی attributeParams بر اساس ویژگی
  const byAttribute = new Map<
    string,
    { name: string; groupName: string | null; specificValues: string[]; hasGenericTemplate: boolean; allValues: string[] }
  >();
  for (const ap of site.attributeParams) {
    const key = ap.attributeId;
    if (!byAttribute.has(key)) {
      byAttribute.set(key, {
        name: ap.attribute.name,
        groupName: ap.attribute.group?.name ?? null,
        specificValues: [],
        hasGenericTemplate: false,
        allValues: ap.attribute.values.map((v) => v.value),
      });
    }
    const entry = byAttribute.get(key)!;
    if (ap.value === null) entry.hasGenericTemplate = true;
    else entry.specificValues.push(ap.value);
  }

  const attributeFilters = Array.from(byAttribute.entries()).map(([attributeId, entry]) => ({
    attributeId,
    attributeName: entry.name,
    groupName: entry.groupName,
    // اگه قالب عمومی داره، همه‌ی مقادیر واقعی همون ویژگی مزون قابل‌انتخابن؛
    // وگرنه فقط همون مقادیر خاصی که ادمین نگاشت کرده
    values: entry.hasGenericTemplate ? entry.allValues : entry.specificValues,
  }));

  return {
    site: { id: site.id, name: site.name, slug: site.slug, baseUrl: site.baseUrl },
    categories,
    attributeFilters,
  };
}
