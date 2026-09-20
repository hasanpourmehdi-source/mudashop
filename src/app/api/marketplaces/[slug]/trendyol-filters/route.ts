import { NextResponse } from "next/server";
import type { ExternalSiteKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchTrendyolAggregations, type TrendyolAggregationGroup } from "@/lib/trendyolAggregations";
import { logTrendyolFetchFailure } from "@/lib/trendyolFetchLog";
import { siteSlugToKind, MILLA_HOUSE_BRAND_IDS, MILLA_HOUSE_BRANDS } from "@/lib/trendyol";

// Cloudflareِ ترندیول گاهی به یه fallback مرورگرِ واقعی (Playwright) نیاز داره که
// خودش می‌تونه ~۱۵-۲۰ ثانیه طول بکشه -- مهلتِ پیش‌فرضِ Vercel (۱۰ ثانیه) کافی نیست
export const maxDuration = 60;

// wg فقط برای دو بخش جنسیتی (Kadın/Erkek) معنی داره -- خودِ Trendyol API
// (fetchTrendyolAggregations) این پارامتر رو اختیاری می‌گیره، پس برای ۸ بخش
// دیگه (Ev & Yaşam، Süpermarket، ...) بدون wg هم می‌شه aggregations رو گرفت،
// فقط بر اساس wc
const SECTION_TO_WG: Record<string, string> = {
  "Kadın": "1",
  "Erkek": "2",
};

type ParamKey = "wb" | "wcl" | "tag" | "mb" | "prc" | "pr" | "attr" | "vr";

export type DynamicFilterValue = { id: string; label: string; count: number };
export type DynamicFilterGroup = {
  key: string; // شناسه‌ی یکتا برای React، مثلاً "wb" یا "attr:314"
  title: string; // فارسی (یا ترکی اگه هنوز ترجمه نشده)
  paramKey: ParamKey;
  attrFilterKey?: string; // فقط برای paramKey="attr"
  selectionType: "MULTIPLE" | "SINGLE";
  order: number; // ترتیب واقعی نمایش همین گروه توی خودِ ترندیول
  values: DynamicFilterValue[];
};

// هر عنوان گروه (title ترکی خام از ترندیول) به پارامتر URL واقعی‌ش نگاشت
// می‌شه -- این‌ها طی چندتا تست دستی (چک کردن URL واقعی بعد از تیک زدن هرکدوم)
// تأیید شدن. فیلترهای TOGGLE (کارگو رایگان، فلاش‌سیل، ...) هنوز پارامترشون
// تأیید نشده، برای همین فعلاً نشون داده نمی‌شن
const TITLE_TO_PARAM: Record<string, ParamKey> = {
  "Marka": "wb",
  "Renk": "wcl",
  "Avantajlı Ürünler": "tag",
  "Satıcı Tipi": "mb",
  "Fiyat": "prc",
  "Ürün Puanı": "pr",
};

// این‌ها جداگونه با سیستم اختصاصی خودشون مدیریت می‌شن (دسته‌بندی با drill-down،
// جنسیت با فیلتر بالای صفحه) -- نباید دوباره به‌عنوان یه فیلتر عمومی «attr»
// هم نشون داده بشن
const EXCLUDED_GENERIC_FILTER_KEYS = new Set(["WebCategory", "WebGender"]);

// ترتیب واقعی که خودِ ترندیول نشون می‌ده (از روی عکس واقعی صفحه، نه فیلد
// «order» توی aggregations -- اون فیلد با ترتیب واقعی UI نمی‌خوند). چیزهایی
// که این‌جا نیستن (هنوز تأیید نشدن) با عدد بزرگ ته لیست میان. «Kategori» و
// «Cinsiyet» این‌جا نیستن چون سیستم اختصاصی جدا دارن و کلاینت جداگونه
// جاشون رو تنظیم می‌کنه (بین Marka و بقیه)
const DISPLAY_ORDER: Record<string, number> = {
  "Marka": 2,
  "Beden": 4,
  "Avantajlı Ürünler": 5,
  "Renk": 6,
  "Çanta Tipi": 7,
  "Ekran Boyut Aralığı": 7,
  "Suya/Tere Dayanıklılık": 7,
  "Fiyat": 8,
  "Ürün Puanı": 9,
  "Satıcı Tipi": 10,
};
function displayOrderFor(title: string): number {
  return DISPLAY_ORDER[title] ?? 50;
}

async function translateMap(
  pairs: { filterKey: string; valueId: string }[],
  site: ExternalSiteKind
): Promise<Map<string, string>> {
  if (pairs.length === 0) return new Map();
  const rows = await prisma.trendyolFilterCache.findMany({
    where: { site, OR: pairs.map((p) => ({ filterKey: p.filterKey, valueId: p.valueId })) },
    select: { filterKey: true, valueId: true, nameFa: true },
  });
  const map = new Map<string, string>();
  for (const r of rows) {
    if (r.nameFa) map.set(`${r.filterKey}::${r.valueId}`, r.nameFa);
  }
  return map;
}

function toGroup(
  g: TrendyolAggregationGroup,
  paramKey: ParamKey,
  titleFa: string | undefined,
  valueLabels: Map<string, string>
): DynamicFilterGroup {
  const isSingle = g.title === "Ürün Puanı" || g.title === "Fiyat";
  const isGeneric = paramKey === "attr" || paramKey === "vr";

  // خودِ aggregations زنده‌ی ترندیول بعضی وقتا همون valueId رو دوبار توی یه
  // گروه برمی‌گردونه (مشابهِ همون کراس‌لیستِ دسته‌بندی‌ها) -- بدونِ این dedupe،
  // چک‌باکس‌های سمتِ کلاینت با کلیدِ تکراری رندر می‌شن؛ اولین occurrence رو نگه می‌داریم
  const seenIds = new Set<string>();
  const uniqueValues = g.values.filter((v) => {
    if (seenIds.has(v.id)) return false;
    seenIds.add(v.id);
    return true;
  });

  return {
    key: isGeneric ? `${paramKey}:${g.filterKey}` : paramKey,
    title: titleFa ?? g.title,
    paramKey,
    attrFilterKey: isGeneric ? g.filterKey : undefined,
    selectionType: isSingle ? "SINGLE" : "MULTIPLE",
    order: displayOrderFor(g.title),
    values: uniqueValues.map((v) => ({
      id: v.id,
      label: valueLabels.get(`${g.filterKey}::${v.id}`) ?? v.text,
      count: v.count,
    })),
  };
}

// این روت عمومیه (نه ادمین) -- بعد از انتخاب جنسیت (و اختیاراً دسته‌بندی)،
// همه‌ی فیلترهای پشتیبانی‌شده‌ی همون بخش رو با برچسب فارسی برمی‌گردونه
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = siteSlugToKind(slug);
  const { searchParams } = new URL(request.url);
  const section = searchParams.get("section") ?? "";
  const wcParam = searchParams.get("wc") ?? undefined;

  // بدون هیچ دسته‌بندی انتخاب‌شده‌ای (نه wc، نه بخش جنسیتی)، aggregations معنی نداره
  const wg = SECTION_TO_WG[section];
  if (!wg && !wcParam) {
    return NextResponse.json({ groups: [] });
  }

  try {
    // میلا یه فروشگاه تک‌مجموعه‌ست (فقط ۶ برندِ خودش) -- بدون این محدودیت،
    // aggregations خامِ میلا هزاران برندِ نامربوط (که هیچ‌وقت واقعاً روی میلا
    // فروخته نمی‌شن) برمی‌گردوند. خودِ سایت واقعی میلا هم همیشه با wb= همین
    // ۶ آیدی محدودش می‌کنه
    const wb = site === "TRENDYOL_MILLA" ? MILLA_HOUSE_BRAND_IDS : undefined;
    // بدون wantedTitles یعنی همه‌ی گروه‌ها بیان -- بعد خودمون فیلتر می‌کنیم
    const allGroups = await fetchTrendyolAggregations({ wc: wcParam, wg, wb }, undefined, site);

    const namedGroups = allGroups.filter((g) => TITLE_TO_PARAM[g.title]);
    // «Beden» (سایز) پارامتر مخصوص خودش (vr=) داره، تأیید‌شده با تست واقعی --
    // نباید مثل بقیه‌ی ویژگی‌های MAP با attr= بره، چون ترندیول ردش می‌کنه
    const variantGroups = allGroups.filter((g) => g.title === "Beden");
    const mapAttrGroups = allGroups.filter(
      (g) =>
        !TITLE_TO_PARAM[g.title] &&
        g.title !== "Beden" &&
        !EXCLUDED_GENERIC_FILTER_KEYS.has(g.filterKey) &&
        (g.filterType === "MAP" || g.filterType === "LIST")
    );

    // برای ترجمه، هم عنوان گروه‌ها هم تک‌تک مقادیرشون رو با هم می‌خوایم
    const allWantedGroups = [...namedGroups, ...variantGroups, ...mapAttrGroups];
    const titlePairs = allWantedGroups.map((g) => ({ filterKey: g.filterKey, valueId: "" }));
    const valuePairs = allWantedGroups.flatMap((g) =>
      g.values.map((v) => ({ filterKey: g.filterKey, valueId: v.id }))
    );
    const [titleLabels, valueLabels] = await Promise.all([
      translateMap(titlePairs, site),
      translateMap(valuePairs, site),
    ]);

    const resultGroups: DynamicFilterGroup[] = [];
    for (const g of namedGroups) {
      const paramKey = TITLE_TO_PARAM[g.title];
      resultGroups.push(toGroup(g, paramKey, titleLabels.get(`${g.filterKey}::`), valueLabels));
    }
    for (const g of variantGroups) {
      resultGroups.push(toGroup(g, "vr", titleLabels.get(`${g.filterKey}::`), valueLabels));
    }
    for (const g of mapAttrGroups) {
      resultGroups.push(toGroup(g, "attr", titleLabels.get(`${g.filterKey}::`), valueLabels));
    }

    // وقتی wb= از قبل شامل *همه‌ی* ۶ برندِ میلا باشه (بالا)، خودِ aggregations
    // ترندیول اصلاً گروه «Marka» رو برنمی‌گردونه (چون از دیدِ خودش چیزی برای
    // محدودترکردن نمونده) -- برای همین این گروه رو مستقیم از لیستِ ثابتِ
    // خودمون می‌سازیم، نه از پاسخ زنده، تا همیشه قابل‌اعتماد باشه
    if (site === "TRENDYOL_MILLA" && !resultGroups.some((g) => g.paramKey === "wb")) {
      resultGroups.push({
        key: "wb",
        title: "برند",
        paramKey: "wb",
        selectionType: "MULTIPLE",
        order: displayOrderFor("Marka"),
        values: MILLA_HOUSE_BRANDS.map((b) => ({ id: b.id, label: b.nameFa, count: 0 })),
      });
    }

    // دقیقاً به همون ترتیبی که خودِ ترندیول واقعاً نشون می‌ده مرتب کن (لیست
    // ثابتِ بالا، نه فیلد order خودِ API)
    resultGroups.sort((a, b) => a.order - b.order);

    return NextResponse.json({ groups: resultGroups });
  } catch (err) {
    const message = err instanceof Error ? err.message : "خطا در دریافت فیلترهای ترندیول";
    await logTrendyolFetchFailure({
      url: `wc=${wcParam ?? ""}&wg=${wg ?? ""}`,
      error: message,
      source: "trendyol-filters",
      siteSlug: slug,
    });
    return NextResponse.json({ error: message, groups: [] }, { status: 502 });
  }
}
