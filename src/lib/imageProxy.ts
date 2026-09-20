// عکس‌های محصولِ ترندیول/میلا از cdn.dsmcdn.com میان، ولی این CDN جلوی
// embedِ عکس از یه دامنه‌ی خارجی (مثلِ سایتِ ما) رو می‌گیره -- عکس مستقیم
// (navigate) باز می‌شه، ولی همون آدرس توی <img> یه سایتِ دیگه لود نمی‌شه
// (به‌احتمالِ زیاد بر اساسِ هدرِ Sec-Fetch-Site که از سمتِ کلاینت هم قابلِ
// حذف/جعل نیست). راه‌حل: به‌جای لینکِ مستقیم، از روتِ داخلیِ
// api/image-proxy رد می‌شیم که خودش سمتِ سرور (نه مرورگرِ کاربر) عکس رو
// می‌گیره و به کاربر تحویل می‌ده -- سرور-به-سرور این محدودیت رو نداره.
const ALLOWED_HOSTS = new Set(["cdn.dsmcdn.com"]);

export function toProxiedImageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.hostname)) return url;
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  } catch {
    return url;
  }
}

export function isAllowedImageProxyHost(hostname: string): boolean {
  return ALLOWED_HOSTS.has(hostname);
}
