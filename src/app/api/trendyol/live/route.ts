import { NextResponse } from "next/server";
import { fetchTrendyolProductsFromUrl } from "@/lib/trendyol";
import { logTrendyolFetchFailure } from "@/lib/trendyolFetchLog";

// Cloudflareِ ترندیول گاهی به یه fallback مرورگرِ واقعی (Playwright) نیاز داره که
// خودش می‌تونه ~۱۵-۲۰ ثانیه طول بکشه -- مهلتِ پیش‌فرضِ Vercel (۱۰ ثانیه) کافی نیست
export const maxDuration = 60;

// این روت رو هم صفحه‌ی سرور (برای بار اول) و هم دکمه‌ی «بارگذاری بیشتر» سمت
// کلاینت (برای صفحه‌های بعدی، با nextUrl) صدا می‌زنن.
// دامنه‌های امنی که این روت اجازه‌ی fetch ازشون رو داره -- وقتی سایت جدیدی (زارا،
// آدیداس، ...) از پنل «سایت‌های خارجی» اضافه شد، دامنه‌ش هم باید اینجا اضافه بشه
const ALLOWED_HOSTS = [
  "www.trendyol.com",
  "trendyol.com",
  "public.trendyol.com",
  "apigw.trendyol.com",
  "www.trendyol-milla.com",
  "trendyol-milla.com",
  "public.trendyol-milla.com",
  "apigw.trendyol-milla.com",
];

function isAllowedUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ALLOWED_HOSTS.includes(hostname);
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url || !isAllowedUrl(url)) {
    return NextResponse.json({ error: "پارامتر url نامعتبر است" }, { status: 400 });
  }

  try {
    const result = await fetchTrendyolProductsFromUrl(url);
    return NextResponse.json(result);
  } catch (err) {
    console.warn("خطا در واکشی محصولات ترندیول:", err);
    await logTrendyolFetchFailure({ url, error: String(err), source: "load-more" });
    return NextResponse.json(
      { error: "دریافت محصولات از ترندیول ناموفق بود" },
      { status: 502 }
    );
  }
}
