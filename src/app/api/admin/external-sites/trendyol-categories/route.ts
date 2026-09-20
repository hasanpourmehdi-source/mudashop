import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import type { Prisma } from "@prisma/client";
import { foldTurkish } from "@/lib/turkishText";
import { siteSlugToKind } from "@/lib/trendyol";

// Cloudflareِ ترندیول گاهی به یه fallback مرورگرِ واقعی (Playwright) نیاز داره که
// خودش می‌تونه ~۱۵-۲۰ ثانیه طول بکشه -- مهلتِ پیش‌فرضِ Vercel (۱۰ ثانیه) کافی نیست
export const maxDuration = 60;

// این روت دیگه هر بار زنده از ترندیول فچ نمی‌کنه -- روی جدول محلی
// TrendyolCategoryCache سرچ می‌کنه (که با «به‌روزرسانی همه» -- روت sync کنار
// همین فایل -- پر/به‌روز می‌شه). سرچ روی nameFa (ترجمه‌ی فارسی)، nameTr
// (اسم اصلی ترکی، برای مواردی که هنوز ترجمه نشدن)، path، و param (مثلا
// "wc=82") انجام می‌شه.
// query params:
//   q                 - عبارت جست‌وجو (فارسی، ترکی، یا خودِ عدد wc)
//   untranslatedOnly  - "1" یعنی فقط ردیف‌هایی که هنوز nameFa ندارن
//   suggestedOnly     - "1" یعنی فقط ردیف‌هایی که ترجمه‌شون پیشنهادی/تأییدنشده‌ست
export async function GET(request: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const untranslatedOnly = searchParams.get("untranslatedOnly") === "1";
  const suggestedOnly = searchParams.get("suggestedOnly") === "1";
  const site = siteSlugToKind(searchParams.get("site") ?? "trendyol");
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);

  const conditions: Prisma.TrendyolCategoryCacheWhereInput[] = [{ site }];
  if (untranslatedOnly) conditions.push({ nameFa: null });
  if (suggestedOnly) conditions.push({ nameFaSuggested: true });
  const where: Prisma.TrendyolCategoryCacheWhereInput = { AND: conditions };

  // q فولدشده مقایسه می‌شه (نه contains خام SQL) -- بین "Canta" و "Çanta"
  // نباید فرقی باشه. تعداد کل ردیف‌ها (کمتر از هزار) به‌اندازه‌ی کافی کمه که
  // فچ‌کردن همه و فیلترکردن توی جاوااسکریپت مشکلی نداشته باشه
  try {
    const rows = await prisma.trendyolCategoryCache.findMany({ where, orderBy: { path: "asc" } });
    const foldedQ = q ? foldTurkish(q) : "";
    const filtered = foldedQ
      ? rows.filter(
          (r) =>
            foldTurkish(r.nameTr).includes(foldedQ) ||
            foldTurkish(r.path).includes(foldedQ) ||
            r.param.includes(q) ||
            (r.nameFa ?? "").includes(q)
        )
      : rows;
    return NextResponse.json({ results: filtered.slice(0, limit), total: filtered.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "خطا در جست‌وجوی دسته‌بندی‌ها";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
