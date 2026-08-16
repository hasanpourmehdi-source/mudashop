import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { foldTurkish } from "@/lib/turkishText";
import { invalidateTitleDictionaryCache } from "@/lib/trendyolTitleTranslation";
import { refreshUntranslatedRowsContaining } from "@/lib/trendyolTranslationDictionary";

export async function PATCH(request: Request, { params }: { params: Promise<{ cacheId: string }> }) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { cacheId } = await params;
  const body = await request.json();
  const nameFa = typeof body.nameFa === "string" ? body.nameFa.trim() || null : null;

  const current = await prisma.trendyolCategoryCache.findUnique({
    where: { id: cacheId },
    select: { nameTr: true },
  });
  if (!current) {
    return NextResponse.json({ error: "ردیف پیدا نشد" }, { status: 404 });
  }

  // همین دسته‌ی واقعی می‌تونه توی چندین مسیر/زیرشاخه‌ی مختلف تکرار شده باشه
  // (کاملاً مجازه -- مثلاً هم زیر «Kadın» هم زیر «Genç»)، یا با املای کمی
  // متفاوت (با/بدون حروف خاص ترکی) اسکرِیپ شده باشه -- برای همین ترجمه‌ی
  // ادمین باید روی همه‌ی ردیف‌هایی که نام ترکی‌شون (بعد از نادیده‌گرفتن حروف
  // خاص ترکی) دقیقاً همینه اعمال بشه، نه فقط همین یه ردیف؛ وگرنه ادمین یه‌بار
  // ترجمه می‌کنه ولی توی فیلترهای مشتری همچنان نسخه‌ی ترجمه‌نشده‌ی یه ردیف
  // دیگه‌ی همون دسته دیده می‌شه
  const foldedTarget = foldTurkish(current.nameTr);
  const allRows = await prisma.trendyolCategoryCache.findMany({ select: { id: true, nameTr: true } });
  const matchingIds = allRows.filter((r) => foldTurkish(r.nameTr) === foldedTarget).map((r) => r.id);

  try {
    await prisma.trendyolCategoryCache.updateMany({
      where: { id: { in: matchingIds } },
      data: { nameFa, nameFaSuggested: false },
    });

    // این ترجمه رو هم به دیکشنری مشترک (TrendyolTitleTermDictionary) اضافه
    // کن -- اگه از قبل نبود -- تا از این به بعد همین کلمه توی عنوان محصولات و
    // فیلترها هم خودکار شناخته بشه. اگه از قبل با ترجمه‌ی دیگه‌ای ثبت شده،
    // دست‌نخورده می‌مونه (یعنی همون یه‌جای مرکزی -- دیکشنری عنوان -- منبع اصلیه)
    if (nameFa) {
      const existingTerm = await prisma.trendyolTitleTermDictionary.findUnique({ where: { termTr: foldedTarget } });
      if (!existingTerm) {
        await prisma.trendyolTitleTermDictionary.create({
          data: { termTr: foldedTarget, termFa: nameFa, priority: foldedTarget.includes(" ") ? foldedTarget.split(" ").length : 0 },
        });
        invalidateTitleDictionaryCache();
        await refreshUntranslatedRowsContaining(foldedTarget, nameFa);
      }
    }

    const updated = await prisma.trendyolCategoryCache.findUnique({ where: { id: cacheId } });
    return NextResponse.json({ ...updated, updatedCount: matchingIds.length });
  } catch {
    return NextResponse.json({ error: "خطا در ذخیره‌سازی" }, { status: 400 });
  }
}
