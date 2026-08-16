import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { fetchTrendyolAggregations } from "@/lib/trendyolAggregations";
import { suggestTranslation } from "@/lib/trendyolTranslationDictionary";
import { siteSlugToKind } from "@/lib/trendyol";

// «به‌روزرسانی» -- یه wc/wg نمونه (مثلاً از یه دسته‌ی پرمحصول) می‌گیره و همه‌ی
// ~۳۰ گروه فیلتر واقعی ترندیول (نه فقط رنگ/برند) رو با تمام مقادیرشون توی
// TrendyolFilterCache می‌ریزه. برای هر گروه، هم خودِ عنوان گروه (valueId="")
// هم تک‌تک مقادیرش ذخیره می‌شن. برندها (که اسم خاصن) معمولاً پیشنهاد ترجمه
// نمی‌گیرن -- نمایش بعداً به‌جاش از nameTr استفاده می‌کنه.
export async function POST(request: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const wc = typeof body?.wc === "string" ? body.wc.trim() : undefined;
  const wg = typeof body?.wg === "string" ? body.wg.trim() : undefined;
  const siteSlug = typeof body?.siteSlug === "string" ? body.siteSlug.trim() : "";

  if (!wc && !wg) {
    return NextResponse.json({ error: "حداقل یکی از wc یا wg رو بده" }, { status: 400 });
  }
  if (!siteSlug) {
    // این wc/wg نمونه فقط برای *یه* سایت معنی داره -- ترندیول و میلا کاتالوگ
    // جدا دارن، پس بدون این‌که مشخص کنیم نمونه از کدوم سایته، نمی‌شه فهمید
    // aggregations باید از کدوم دامنه (apigw.trendyol.com یا
    // apigw.trendyol-milla.com) خونده بشه
    return NextResponse.json({ error: "مشخص کن این نمونه برای کدوم سایت است" }, { status: 400 });
  }
  const site = siteSlugToKind(siteSlug);

  try {
    const groups = await fetchTrendyolAggregations({ wc, wg }, undefined, site); // بدون wantedTitles یعنی همه

    if (groups.length === 0) {
      return NextResponse.json({ error: "هیچ گروه فیلتری برنگشت" }, { status: 502 });
    }

    const existingKeys = new Set(
      (
        await prisma.trendyolFilterCache.findMany({ where: { site }, select: { filterKey: true, valueId: true } })
      ).map((r) => `${r.filterKey}::${r.valueId}`)
    );

    let inserted = 0;
    let updated = 0;
    let autoSuggested = 0;

    const rows: { filterKey: string; valueId: string; nameTr: string; groupTitleTr: string | null }[] = [];
    for (const g of groups) {
      rows.push({ filterKey: g.filterKey, valueId: "", nameTr: g.title, groupTitleTr: null });
      for (const v of g.values) {
        rows.push({ filterKey: g.filterKey, valueId: v.id, nameTr: v.text, groupTitleTr: g.title });
      }
    }

    // suggestTranslation حالا async‌ه (از همون دیکشنری مشترک عنوان محصولات
    // می‌خونه) -- باید قبل از ساختن batchِ تراکنش، همه‌ی پیشنهادها از قبل
    // resolve بشن (چون map داخل $transaction نمی‌تونه async باشه)
    const suggestionByKey = new Map<string, string | null>();
    for (const row of rows) {
      const key = `${row.filterKey}::${row.valueId}`;
      if (!existingKeys.has(key)) {
        suggestionByKey.set(key, await suggestTranslation(row.nameTr));
      }
    }

    const BATCH_SIZE = 200;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      await prisma.$transaction(
        batch.map((row) => {
          const key = `${row.filterKey}::${row.valueId}`;
          const isNew = !existingKeys.has(key);
          if (isNew) inserted++;
          else updated++;
          const suggested = isNew ? suggestionByKey.get(key) ?? null : null;
          if (suggested !== null) autoSuggested++;
          return prisma.trendyolFilterCache.upsert({
            where: { site_filterKey_valueId: { site, filterKey: row.filterKey, valueId: row.valueId } },
            update: { nameTr: row.nameTr, groupTitleTr: row.groupTitleTr },
            create: {
              site,
              filterKey: row.filterKey,
              valueId: row.valueId,
              nameTr: row.nameTr,
              groupTitleTr: row.groupTitleTr,
              nameFa: suggested,
              nameFaSuggested: suggested !== null,
            },
          });
        })
      );
    }

    return NextResponse.json({ total: rows.length, inserted, updated, autoSuggested });
  } catch (err) {
    const message = err instanceof Error ? err.message : "خطا در همگام‌سازی فیلترهای ترندیول";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
