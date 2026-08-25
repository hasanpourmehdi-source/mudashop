// ساخت لینک رهگیری آنلاین از روی کد رهگیری + روش ارسال. روش ارسال مهمه چون:
//  - «پست پیشتاز/پست سفارشی» → پست (tracking.post.ir)
//  - «تیپاکس» → تیپاکس (tipaxonline.com)
//  - «پیک موتوری» → شماره تماس است نه کد رهگیری → لینکی نداره
// اگه روش ارسال معلوم نباشه، از روی الگوی کد حدس می‌زنیم (۱۰ رقمی = پست، بقیه = تیپاکس)
export function trackingUrl(code: string, shippingMethod?: string | null): string | null {
  const trimmed = code.replace(/\s+/g, "");
  if (!trimmed) return null;

  const method = shippingMethod?.trim() ?? "";
  if (method.includes("تیپاکس")) {
    return `https://www.tipaxonline.com/tracking/?trackingcode=${encodeURIComponent(trimmed)}`;
  }
  if (method.includes("پست")) {
    return `https://tracking.post.ir/SearchIndex.aspx?igc=${encodeURIComponent(trimmed)}`;
  }
  if (method === "پیک موتوری") return null;

  // fallback: الگوی کد
  if (/^\d{10}$/.test(trimmed)) {
    return `https://tracking.post.ir/SearchIndex.aspx?igc=${encodeURIComponent(trimmed)}`;
  }
  return `https://www.tipaxonline.com/tracking/?trackingcode=${encodeURIComponent(trimmed)}`;
}