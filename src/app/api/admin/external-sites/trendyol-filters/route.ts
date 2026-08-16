import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import type { Prisma } from "@prisma/client";
import { foldTurkish } from "@/lib/turkishText";
import { siteSlugToKind } from "@/lib/trendyol";

// سرچ روی جدول محلی TrendyolFilterCache -- q روی nameFa/nameTr/groupTitleTr
// می‌گرده. untranslatedOnly یعنی فقط ردیف‌هایی که هنوز nameFa ندارن.
//
// جست‌وجوی q فولدشده‌ست (نه contains خام SQL) -- چون بین "Kırmızı" و
// "Kirmizi" (یا هرچی که ادمین راحت‌تر تایپ کنه) نباید فرقی باشه؛ تعداد کل
// ردیف‌ها (چند هزار تا) به‌اندازه‌ی کافی کمه که فچ‌کردن همه و فیلترکردن توی
// جاوااسکریپت مشکلی نداشته باشه
export async function GET(request: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const untranslatedOnly = searchParams.get("untranslatedOnly") === "1";
  const suggestedOnly = searchParams.get("suggestedOnly") === "1";
  const groupsOnly = searchParams.get("groupsOnly") === "1"; // فقط سربرگ گروه‌ها (valueId="")
  const site = siteSlugToKind(searchParams.get("site") ?? "trendyol");
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 300);

  const conditions: Prisma.TrendyolFilterCacheWhereInput[] = [{ site }];
  if (untranslatedOnly) conditions.push({ nameFa: null });
  if (suggestedOnly) conditions.push({ nameFaSuggested: true });
  if (groupsOnly) conditions.push({ valueId: "" });
  const where: Prisma.TrendyolFilterCacheWhereInput = { AND: conditions };

  const rows = await prisma.trendyolFilterCache.findMany({
    where,
    orderBy: [{ groupTitleTr: "asc" }, { nameTr: "asc" }],
  });

  const foldedQ = q ? foldTurkish(q) : "";
  const filtered = foldedQ
    ? rows.filter(
        (r) =>
          foldTurkish(r.nameTr).includes(foldedQ) ||
          foldTurkish(r.groupTitleTr ?? "").includes(foldedQ) ||
          (r.nameFa ?? "").includes(q)
      )
    : rows;

  return NextResponse.json({ results: filtered.slice(0, limit) });
}
