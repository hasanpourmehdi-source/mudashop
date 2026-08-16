import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { TITLE_ALGO_VERSION, translateTurkishPhrase } from "@/lib/trendyolTitleTranslation";

// از ستون unknownTerms (جدا شده با "|") روی همه‌ی ردیف‌های TrendyolTitleCache
// می‌گرده و می‌شمره هر کلمه‌ی ناشناخته چندبار تکرار شده -- تا ادمین بفهمه کدوم
// کلمه بیشترین اثر رو داره اگه به دیکشنری اضافه بشه (پرتکرارترین اول).
//
// نکته‌ی مهم: unknownTerms توی TrendyolTitleCache یه عکس‌لحظه‌ایه از زمانی که
// عنوان *برای اولین بار* ترجمه شده -- اگه بعداً ادمین همون کلمه رو به دیکشنری
// اضافه کنه، این ستون خودکار به‌روز نمی‌شه (چون کش دوباره regenerate نمی‌شه مگر
// عنوان دوباره fetch بشه). برای همین قبل از نمایش، هر کلمه رو با دیکشنری فعلی
// چک می‌کنیم و هرکدوم که الان معادل داره رو از لیست حذف می‌کنیم -- وگرنه
// کلمه‌ای که همین الان ترجمه شده، هنوز به‌عنوان «ناشناخته» نشون داده می‌شه.
//
// فقط ردیف‌های همین نسخه‌ی الگوریتم رو در نظر می‌گیریم -- ردیف‌های قدیمی‌تر
// (قبل از فولدشدنِ حروف خاص ترکی، مثلاً TITLE_ALGO_VERSION قبلی) با تابعِ
// قدیمیِ tokenizeAndTranslate محاسبه شدن، پس unknownTerms‌شون ممکنه املای
// خام/فولدنشده داشته باشه (مثلاً "sırt" به‌جای "sirt") که هیچ‌وقت با
// دیکشنریِ الان (که فولدشده‌ست) مطابقت پیدا نمی‌کنه -- نتیجه‌ش این می‌شد که
// کلمه‌ای که همین الان ترجمه شده، به‌خاطر این ردیف‌های کهنه، همچنان توی لیست
// «ناشناخته» می‌ماند. این ردیف‌های کهنه با اولین بازدیدِ بعدیِ همون محصول
// خودکار regenerate می‌شن (طبق منطق translateTrendyolTitle)، پس نادیده
// گرفتنشون اینجا چیزی رو گم نمی‌کنه، فقط داده‌ی کهنه رو کنار می‌ذاره.
// برای ترجمه‌ی دقیق، صرفِ کلمه و تعداد تکرار کافی نیست -- ادمین باید چند
// نمونه‌ی واقعی که این کلمه توشون بوده رو هم ببینه تا بافتش رو بفهمه
const MAX_EXAMPLES_PER_TERM = 5;

function addTerm(counts: Map<string, number>, examples: Map<string, string[]>, term: string, example: string) {
  counts.set(term, (counts.get(term) ?? 0) + 1);
  const list = examples.get(term);
  if (list) {
    if (list.length < MAX_EXAMPLES_PER_TERM) list.push(example);
  } else {
    examples.set(term, [example]);
  }
}

export async function GET() {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const counts = new Map<string, number>();
  const examples = new Map<string, string[]>();

  const titleRows = await prisma.trendyolTitleCache.findMany({
    where: { unknownTerms: { not: null }, algorithmVersion: TITLE_ALGO_VERSION },
    select: { unknownTerms: true, originalTitle: true },
  });
  for (const row of titleRows) {
    if (!row.unknownTerms) continue;
    for (const term of row.unknownTerms.split("|")) {
      if (!term) continue;
      addTerm(counts, examples, term, row.originalTitle);
    }
  }

  // به‌جز کلمات عنوان محصولات، اسم دسته‌بندی‌ها و مقادیر فیلترهایی که هنوز
  // ترجمه نشدن (nameFa خالی) هم باید همین‌جا دیده بشن -- طبق تصمیم صریح: یه
  // لیست واحد برای ترجمه، نه این‌که ادمین باید سه‌تا صفحه‌ی جدا رو بگرده تا
  // بفهمه کجا کلمه‌ی ناشناخته هست. چون این ردیف‌ها (برخلاف TrendyolTitleCache)
  // خودشون unknownTerms ذخیره‌شده ندارن، همین الان با همون تابع مشترک
  // (translateTurkishPhrase) دوباره tokenize می‌شن -- ارزون‌ه چون دیکشنری
  // توی حافظه کش شده.
  const categoryRows = await prisma.trendyolCategoryCache.findMany({
    where: { nameFa: null },
    select: { nameTr: true, path: true },
  });
  for (const row of categoryRows) {
    const { unknownTerms } = await translateTurkishPhrase(row.nameTr);
    for (const term of unknownTerms) {
      addTerm(counts, examples, term, `[دسته‌بندی] ${row.path}`);
    }
  }

  // برندها (filterKey="WebBrand") عمداً کنار گذاشته می‌شن -- اسم خاصن، دقیقاً
  // مثل صفحه‌ی خودِ /admin/trendyol-filters که پیش‌فرض مخفی‌شون می‌کنه؛ وگرنه
  // تکه‌های اسم برند («Baby»، «Kids»، «Moda» و...) کل لیست کلمات ناشناخته رو
  // با نویز پر می‌کنن. مواردی که ادمین دستی «نیاز به ترجمه ندارد» زده هم کنار
  const filterRows = await prisma.trendyolFilterCache.findMany({
    where: { nameFa: null, noTranslationNeeded: false, filterKey: { not: "WebBrand" } },
    select: { nameTr: true, groupTitleTr: true },
  });
  for (const row of filterRows) {
    const { unknownTerms } = await translateTurkishPhrase(row.nameTr);
    for (const term of unknownTerms) {
      addTerm(counts, examples, term, `[فیلتر${row.groupTitleTr ? ` -- ${row.groupTitleTr}` : ""}] ${row.nameTr}`);
    }
  }

  // فقط کلماتی که واقعاً هنوز در دیکشنری معادل ندارن رو نگه می‌داریم
  const candidateTerms = Array.from(counts.keys());
  const existingInDictionary = candidateTerms.length
    ? await prisma.trendyolTitleTermDictionary.findMany({
        where: { termTr: { in: candidateTerms } },
        select: { termTr: true },
      })
    : [];
  const knownSet = new Set(existingInDictionary.map((e: { termTr: string }) => e.termTr));

  const result = Array.from(counts.entries())
    .filter(([term]) => !knownSet.has(term))
    .map(([term, count]) => ({ term, count, examples: examples.get(term) ?? [] }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    terms: result,
    totalCachedTitles: titleRows.length,
    totalUntranslatedCategories: categoryRows.length,
    totalUntranslatedFilters: filterRows.length,
  });
}
