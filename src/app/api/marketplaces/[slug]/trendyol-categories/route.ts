import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TRENDYOL_TOP_SECTIONS } from "@/lib/trendyolTopSections";
import { siteSlugToKind } from "@/lib/trendyol";
import { pickRepresentativeCategoryRow } from "@/lib/externalSites";

// این روت عمومیه (نه ادمین) -- مشتری‌ها موقع مرور صفحه‌ی سایت خارجی صداش
// می‌زنن. کار سلسله‌مراتبیه: بدون parentPath، فقط زیرشاخه‌ی مستقیمِ خودِ بخش
// اصلی رو می‌ده (مثلاً «Giyim»، «Ayakkabı»)؛ با parentPath (مثلاً
// "Kadın > Giyim")، فقط زیرشاخه‌ی مستقیمِ همون گره رو می‌ده (مثلاً «Elbise»،
// «Tişört»). این‌طوری وقتی کاربر یه دسته رو تیک می‌زنه، سمت کلاینت با همون
// path این دسته دوباره همین روت رو صدا می‌زنه و لیست به زیرگروه‌هاش محدود می‌شه.
//
// resolveParam: مسیر جداگونه -- به‌جای section/parentPath، یه param خام
// (مثلاً "wc=82") می‌گیره و کل مسیرش رو برمی‌گردونه (برای بازسازی سایدبار وقتی
// کاربر مستقیم از یه لینک -- مثلاً منوی سه‌خط -- وارد شده و categoryStack
// محلی‌ش هنوز خالیه)
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = siteSlugToKind(slug);
  const { searchParams } = new URL(request.url);
  const resolveParam = searchParams.get("resolveParam");

  if (resolveParam) {
    // ریشه‌ی ۸ بخش غیرجنسیتی (rootWc توی trendyolTopSections.ts) یه اتحاد
    // ساخته‌شده‌ست، نه یه پارامتر واقعی که به‌عنوان یه ردیف توی
    // TrendyolCategoryCache وجود داشته باشه -- برای همین قبل از جست‌وجوی
    // دیتابیس، اول مستقیم با خودِ این ۸ مقدار مقایسه می‌کنیم؛ وگرنه کلیک روی
    // این بخش‌ها از منوی بالا هیچ‌وقت توی سایدبار به‌عنوان «انتخاب‌شده» شناخته
    // نمی‌شد (چون findFirst پایین همیشه null برمی‌گردوند)
    const matchedRootSection = TRENDYOL_TOP_SECTIONS.find((s) => s.rootWc === resolveParam);
    if (matchedRootSection) {
      return NextResponse.json({ topSection: matchedRootSection.turkish, stack: [] });
    }

    // همون param می‌تونه زیر چندتا مسیر کاملاً متفاوت تکرار شده باشه (کراس‌لیست
    // خودِ ترندیول، مثلاً «Tişört» هم زیر Kadın/Erkek عادی هم زیر Anne & Çocuk
    // به‌عنوان لباس نوزاد) -- findFirst یه ردیفِ دلبخواهی برمی‌گردوند که ممکنه
    // برچسبِ کاملاً بی‌ربطی (مثلاً «زیرپوش تی‌شرت») به‌جای دسته‌ی عمومی نشون بده
    const candidateRows = await prisma.trendyolCategoryCache.findMany({ where: { site, param: resolveParam } });
    const row = pickRepresentativeCategoryRow(candidateRows);
    if (!row) {
      return NextResponse.json({ topSection: null, stack: [] });
    }
    const segments = row.path.split(" > ");
    const topSectionTurkish = segments[0];
    // چیپ‌های زنجیره -- از عمق ۲ به بعد (عمق ۱ فقط خودِ بخش اصلیه، چیپ نیست)
    const prefixes = segments.slice(1).map((_, i) => segments.slice(0, i + 2).join(" > "));
    const chainRows = await prisma.trendyolCategoryCache.findMany({
      where: { site, path: { in: prefixes } },
      select: { param: true, nameFa: true, nameTr: true, path: true },
    });
    const byPath = new Map(chainRows.map((r) => [r.path, r]));
    const stack = prefixes
      .map((p) => byPath.get(p))
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map((r) => ({
        param: r.param,
        label: r.nameFa ?? r.nameTr,
        path: r.path,
        hasChildren: false, // فقط برای نمایش چیپ لازمه، نه drill-down دوباره
      }));
    return NextResponse.json({ topSection: topSectionTurkish, stack });
  }

  // section همون اسم ترکیِ خودِ بخشه (نه لیبل فارسی) -- دقیقاً همون مقداری
  // که سایدبار توی selectedTopSection نگه می‌داره، بدون نیاز به ترجمه‌ی رفت‌وبرگشتی
  const sectionParam = searchParams.get("section") ?? "";
  const parentPath = searchParams.get("parentPath");

  const section = TRENDYOL_TOP_SECTIONS.some((s) => s.turkish === sectionParam) ? sectionParam : null;
  if (!section) {
    return NextResponse.json({ results: [] });
  }

  // parentPath باید واقعاً زیرمجموعه‌ی همون بخش اصلی باشه (جلوگیری از دیدن
  // دسته‌های بخش دیگه با دستکاری URL)
  const basePath = parentPath && parentPath === section ? section : parentPath?.startsWith(`${section} > `) ? parentPath : section;

  const prefix = `${basePath} > `;
  // confirmedEmpty=false: دسته‌هایی که قبلاً (روی همین سایت) صفر محصول
  // برگردوندن دیگه توی لیست انتخاب پیشنهاد نمی‌شن -- مخصوصاً برای میلا که
  // دسته‌بندی‌های ترندیول بهش کپی شده ولی خیلی‌هاشون محصولی ندارن
  const rows = await prisma.trendyolCategoryCache.findMany({
    where: { site, path: { startsWith: prefix }, confirmedEmpty: false },
    select: { param: true, nameFa: true, nameTr: true, path: true },
  });

  // فقط زیرشاخه‌ی مستقیم (یه سطح بعد از پیشوند، نه عمیق‌تر)
  const directChildren = rows.filter((r) => !r.path.slice(prefix.length).includes(" > "));

  const mapped = directChildren.map((r) => ({
    param: r.param,
    label: r.nameFa ?? r.nameTr,
    nameTr: r.nameTr,
    path: r.path,
    // آیا این گره خودش هم زیرشاخه داره؟ (برای نشون‌دادن فلش/امکان drill کردن)
    hasChildren: rows.some((other) => other.path.startsWith(`${r.path} > `)),
  }));

  // اگه دو تا دسته‌ی متفاوت (wc جدا) به یه ترجمه‌ی فارسی یکسان ختم شده باشن
  // (مثلاً «Kaban» و «Palto» هر دو «پالتو»)، توی همین لیست قابل‌تشخیص نیستن --
  // برای همون‌هایی که تکراری‌ان، اسم ترکی اصلی رو هم جلوش می‌ذاریم
  const labelCounts = new Map<string, number>();
  for (const m of mapped) labelCounts.set(m.label, (labelCounts.get(m.label) ?? 0) + 1);

  const results = mapped
    .map((m) => ({
      param: m.param,
      label: (labelCounts.get(m.label) ?? 0) > 1 ? `${m.label} (${m.nameTr})` : m.label,
      path: m.path,
      hasChildren: m.hasChildren,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "fa"));

  return NextResponse.json({ results });
}
