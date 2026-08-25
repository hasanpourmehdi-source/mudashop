// توابع خالص برای ساختن لینک داخلی صفحه‌ی محصول ترندیول -- بدون "use client"
// تا هم توی کامپوننت‌های سرور (صفحه‌ی سفارش و مشابه) هم کلاینت قابل استفاده
// باشه؛ فقط از فایل مربوط به کامپوننت TrendyolProductLink جدا شده

// از آدرس کامل ترندیول (مثلاً https://www.trendyol.com/mavi/cep-detayli-...-p-896710400)
// اسلاگ سئو (بخش قبل از -p-) رو درمیاره -- برای ساختن لینک داخلی مداشاپ
// به‌شکل /products/trendyol/{contentId}-{slug}
export function extractSeoSlugFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const path = new URL(url).pathname;
    const match = path.match(/\/([a-z0-9-]+)-p-\d+/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// لینک داخلی صفحه‌ی جزئیات محصول در مداشاپ -- contentId اول میاد تا همیشه
// قابل‌پارس باشه، حتی اگه slug خالی یا عجیب بود
export function internalTrendyolProductHref(
  contentId: string | number,
  url: string | null | undefined,
  attrsQuery?: string
): string {
  const slug = extractSeoSlugFromUrl(url);
  const base = slug ? `/products/trendyol/${contentId}-${slug}` : `/products/trendyol/${contentId}`;
  return attrsQuery ? `${base}?attrs=${encodeURIComponent(attrsQuery)}` : base;
}
