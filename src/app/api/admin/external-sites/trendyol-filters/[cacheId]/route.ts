import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import type { Prisma } from "@prisma/client";
import { foldTurkish } from "@/lib/turkishText";
import { invalidateTitleDictionaryCache } from "@/lib/trendyolTitleTranslation";
import { refreshUntranslatedRowsContaining } from "@/lib/trendyolTranslationDictionary";

export async function PATCH(request: Request, { params }: { params: Promise<{ cacheId: string }> }) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { cacheId } = await params;
  const body = await request.json();

  const data: Prisma.TrendyolFilterCacheUpdateInput = {};
  let savedNameFa: string | null = null;
  if (typeof body.nameFa === "string" || body.nameFa === null) {
    savedNameFa = typeof body.nameFa === "string" ? body.nameFa.trim() || null : null;
    data.nameFa = savedNameFa;
    data.nameFaSuggested = false;
  }
  if (typeof body.noTranslationNeeded === "boolean") {
    data.noTranslationNeeded = body.noTranslationNeeded;
  }

  try {
    const updated = await prisma.trendyolFilterCache.update({
      where: { id: cacheId },
      data,
    });

    // این ترجمه رو هم به دیکشنری مشترک (TrendyolTitleTermDictionary) اضافه
    // کن -- اگه از قبل نبود -- تا از این به بعد همین کلمه توی عنوان محصولات و
    // اسم دسته‌بندی‌ها هم خودکار شناخته بشه
    if (savedNameFa) {
      const termTr = foldTurkish(updated.nameTr);
      const existingTerm = await prisma.trendyolTitleTermDictionary.findUnique({ where: { termTr } });
      if (!existingTerm) {
        await prisma.trendyolTitleTermDictionary.create({
          data: { termTr, termFa: savedNameFa, priority: termTr.includes(" ") ? termTr.split(" ").length : 0 },
        });
        invalidateTitleDictionaryCache();
        await refreshUntranslatedRowsContaining(termTr, savedNameFa);
      }
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "ردیف پیدا نشد یا خطا در ذخیره‌سازی" }, { status: 400 });
  }
}
