import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import type { Prisma } from "@prisma/client";
import { invalidateTitleDictionaryCache, invalidateTitleCacheForTerm } from "@/lib/trendyolTitleTranslation";
import { foldTurkish } from "@/lib/turkishText";
import { refreshUntranslatedRowsContaining } from "@/lib/trendyolTranslationDictionary";

// سرچ روی جدول TrendyolTitleTermDictionary -- q روی termTr/termFa می‌گرده
export async function GET(request: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const limit = Math.min(Number(searchParams.get("limit")) || 100, 500);

  const where: Prisma.TrendyolTitleTermDictionaryWhereInput = q
    ? { OR: [{ termTr: { contains: q } }, { termFa: { contains: q } }] }
    : {};

  const results = await prisma.trendyolTitleTermDictionary.findMany({
    where,
    orderBy: [{ termTr: "asc" }],
    take: limit,
  });

  return NextResponse.json({ results });
}

// افزودن یه اصطلاح جدید به دیکشنری
export async function POST(request: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const body = await request.json();
  const termTr = typeof body.termTr === "string" ? foldTurkish(body.termTr.trim()) : "";
  const noTranslationNeeded = body.noTranslationNeeded === true;
  // برای «نیاز به ترجمه ندارد»، معادل فارسی همون خودِ اصطلاح ترکیه -- یعنی
  // tokenizeAndTranslate این کلمه رو دست‌نخورده عبور می‌ده، ولی چون توی
  // دیکشنری «شناخته‌شده» حساب می‌شه، دیگه توی لیست کلمات ناشناخته نمی‌آد
  const termFa = noTranslationNeeded
    ? termTr
    : typeof body.termFa === "string"
      ? body.termFa.trim()
      : "";
  const priority = typeof body.priority === "number" ? body.priority : 0;

  if (!termTr || !termFa) {
    return NextResponse.json({ error: "termTr و termFa هر دو الزامی‌اند" }, { status: 400 });
  }

  try {
    const created = await prisma.trendyolTitleTermDictionary.upsert({
      where: { termTr },
      create: { termTr, termFa, priority, noTranslationNeeded },
      update: { termFa, priority, noTranslationNeeded },
    });
    invalidateTitleDictionaryCache();
    await invalidateTitleCacheForTerm(termTr);
    await refreshUntranslatedRowsContaining(termTr, termFa);
    return NextResponse.json(created);
  } catch {
    return NextResponse.json({ error: "خطا در ذخیره‌سازی" }, { status: 400 });
  }
}
