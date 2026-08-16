import { NextResponse } from "next/server";
import { fetchTrendyolProductDetail } from "@/lib/trendyolProductDetail";
import { logTrendyolFetchFailure } from "@/lib/trendyolFetchLog";

// ALLOWED_HOSTS مشابه src/app/api/trendyol/live/route.ts -- فقط اجازه‌ی fetch
// از دامنه‌های ترندیول شناخته‌شده رو می‌ده
const ALLOWED_HOSTS = [
  "www.trendyol.com",
  "trendyol.com",
  "www.trendyol-milla.com",
  "trendyol-milla.com",
];

function isAllowedUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ALLOWED_HOSTS.includes(hostname);
  } catch {
    return false;
  }
}

// برای «نگاه سریع» روی کارت گرید -- جزئیات کامل (رنگ‌ها، سایزها، قیمت) رو
// بدون رفتن به صفحه‌ی جدا برمی‌گردونه؛ همون fetchTrendyolProductDetail که
// صفحه‌ی محصول واقعی هم استفاده می‌کنه، پس قیمت‌ها همیشه از قبل به تومان
// تبدیل‌شده‌ن (applyExchangeRate توی خودِ trendyolProductDetail.ts انجام می‌شه)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url || !isAllowedUrl(url)) {
    return NextResponse.json({ error: "پارامتر url نامعتبر است" }, { status: 400 });
  }

  try {
    const product = await fetchTrendyolProductDetail(url);
    if (!product) {
      return NextResponse.json({ error: "محصول پیدا نشد" }, { status: 404 });
    }
    return NextResponse.json(product);
  } catch (err) {
    console.warn("خطا در واکشی نگاه سریع محصول ترندیول:", err);
    await logTrendyolFetchFailure({ url, error: String(err), source: "product-detail" });
    return NextResponse.json(
      { error: "دریافت جزئیات محصول ناموفق بود", detail: String(err) },
      { status: 502 }
    );
  }
}
