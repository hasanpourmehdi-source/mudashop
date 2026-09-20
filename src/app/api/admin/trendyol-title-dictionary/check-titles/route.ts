import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { loadDictionary, tokenizeAndTranslate } from "@/lib/trendyolTitleTranslation";

// نسخه‌ی batchِ check-title -- به‌جای این‌که هر کارتِ محصولِ صفحه (مثلاً صفحه‌ی
// فروشگاهی با صدها محصول) خودش یه فچِ کاملاً جدا برای عنوانِ خودش بزنه (که هم
// صدها درخواستِ هم‌زمان به سرور می‌شد، هم دیکشنری رو بارها/جداگانه از DB
// می‌خوند)، این‌جا کلِ عنوان‌های همون صفحه یکجا می‌رسن: دیکشنری فقط یک‌بار لود
// می‌شه، بعد unknownTermsِ هرکدوم با همون یک دیکشنری (بدونِ فچِ اضافه‌ی DB)
// حساب و به همون ترتیبِ ورودی برگردونده می‌شه
export async function POST(req: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const rawItems = Array.isArray(body?.items) ? body.items : [];
  // سقفِ معقول -- این endpoint فقط برای عنوان‌های همون یک صفحه‌ست، نه یه
  // ابزارِ عمومیِ batchِ بی‌سقف
  const items: { title: string; brand: string | null }[] = rawItems
    .slice(0, 500)
    .map((it: { title?: unknown; brand?: unknown }) => ({
      title: typeof it?.title === "string" ? it.title : "",
      brand: typeof it?.brand === "string" ? it.brand : null,
    }));

  const dictionary = await loadDictionary();
  const results = items.map(
    (item) => tokenizeAndTranslate(item.title, dictionary, item.brand).unknownTerms
  );

  return NextResponse.json({ results });
}
