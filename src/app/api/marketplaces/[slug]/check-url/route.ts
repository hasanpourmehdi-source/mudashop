import { NextResponse } from "next/server";
import { buildExternalSiteUrl, resolveEffectiveFilters, type SelectedAttributeFilter } from "@/lib/externalSites";
import { fetchTrendyolProductsFromUrl } from "@/lib/trendyol";
import { logTrendyolFetchFailure } from "@/lib/trendyolFetchLog";

// این روت برای اعتبارسنجی «قبل از اعمال» فیلترهای سایت‌های خارجیه: کامپوننت
// فیلتر (سمت کلاینت) قبل از اینکه واقعا URL صفحه رو عوض کنه، اینجا می‌پرسه
// «اگه این فیلتر رو اضافه کنم، سایت مقصد جواب می‌ده یا 404؟». چون این یه
// درخواست واقعی از مرورگره (نه fetch سمت سرور توی خود صفحه)، توی تب Network
// مرورگر هم دیده می‌شه -- برای دیباگ کردن نگاشت‌های اشتباه پنل ادمین مفیده
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let body: { category?: string | null; attrs?: SelectedAttributeFilter[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "بدنه‌ی درخواست نامعتبر است" }, { status: 400 });
  }

  const { categorySlug, attrs } = await resolveEffectiveFilters(
    slug,
    body.category ?? null,
    body.attrs ?? []
  );

  const url = await buildExternalSiteUrl(slug, categorySlug, attrs);
  if (!url) {
    // هیچ نگاشتی پیدا نشد -- به‌جای رد کردن فیلتر، مثل حالت «بدون فیلتر» رفتار می‌کنیم
    return NextResponse.json({ ok: true, url: null });
  }

  try {
    await fetchTrendyolProductsFromUrl(url);
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "خطا در دریافت محصولات";
    console.warn(`[check-url/${slug}] rejected:`, url, message);
    await logTrendyolFetchFailure({ url, error: message, source: "check-url", siteSlug: slug });
    return NextResponse.json({ ok: false, url, error: message });
  }
}
