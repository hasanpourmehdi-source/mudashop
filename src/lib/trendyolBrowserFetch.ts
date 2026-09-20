import { siteUrl } from "@/lib/seo";

// قبلاً این فایل مستقیم منطقِ Playwright+stealth رو (توی یه پروسه‌ی Node جدا، با
// execFile) اجرا می‌کرد. مشکل: چون این فایل import مستقیم نداشت (execFile با
// مسیرِ رشته‌ای)، ردیابیِ خودکارِ Next.js نمی‌دیدش، پس next.config.ts صریحاً
// مجبور بود این باندلِ ~۸۶ مگابایتی (Playwright+@sparticuz/chromium) رو به
// هر روتی که (مستقیم/غیرمستقیم) این فایل رو import می‌کرد اضافه کنه -- که
// می‌شد ۶۶ روتِ مختلف، هرکدوم با کپیِ خودشون از همون باندل. با ۵ دیپلویِ
// نگه‌داشته‌شده، این یعنی ۶۶×۸۶مگ×۵ ≈ ده‌ها گیگ -- دقیقاً همون چیزی که سهمیه‌ی
// Function Storage ورسل (۱۰ گیگ) رو دوباره پُر کرد (۲۰۲۶/۰۹/۰۹، با اینکه یه
// روز قبلش از ۲۷۹ روت به ۶۶ روت کم شده بود).
//
// فیکس: خودِ اجرای Playwright به یه روتِ داخلیِ تنها منتقل شد
// (src/app/api/internal/trendyol-browser-fetch) که تنها جاییه که این باندل رو
// حمل می‌کنه. این فایل الان فقط یه فچِ ساده‌ی سرور-به-سرور به همون روته --
// امضا/رفتار برای فراخوان‌ها (trendyol.ts، trendyolProductDetail.ts) دقیقاً
// همون قبلیه، هیچ تغییری لازم نداشتن
export async function fetchTrendyolPageViaBrowser(
  url: string,
): Promise<{ statusCode: number; body: string }> {
  const secret = process.env.TRENDYOL_BROWSER_FETCH_SECRET;
  if (!secret) {
    throw new Error("TRENDYOL_BROWSER_FETCH_SECRET تنظیم نشده");
  }
  const res = await fetch(siteUrl("/api/internal/trendyol-browser-fetch"), {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-secret": secret },
    body: JSON.stringify({ url }),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`fetchTrendyolPageViaBrowser ناموفق (${res.status}): ${detail}`);
  }
  return (await res.json()) as { statusCode: number; body: string };
}
