import { gotScraping } from "got-scraping";
import {
  HEADER_GENERATOR_OPTIONS,
  trendyolCookieJar,
  requestTrendyolWithRetry,
  buildTrendyolFetchError,
} from "@/lib/trendyol";

// endpoint عمومی و بدون نیاز به احراز هویت (قبلاً در تحقیق APIهای ترندیول
// تأیید شده بود) -- برای پیدا کردن ID عددی برند از روی اسمش، چون در صفحه‌ی
// محصول فقط اسم برند رو داریم (نه ID)، ولی endpoint محصولات مشابه به
// `brandId` عددی نیاز داره.
// نمونه‌ی پاسخ: [{"id":2519456,"name":"Framgan","luxury":false}]

// کش ساده‌ی حافظه‌ای: این نگاشت عملاً همیشگیه (برندهای ترندیول ID جدید
// نمی‌گیرن)، پس فقط با ری‌استارت سرور خالی می‌شه -- فقط نتایج موفق رو کش
// می‌کنیم، نه شکست‌های گذرا (که باید دوباره امتحان بشن)
const brandIdCache = new Map<string, number | null>();

async function searchTrendyolBrandsByName(name: string): Promise<Array<{ id: number; name: string }>> {
  const url = `https://apigw.trendyol.com/integration/product/brands/by-name?name=${encodeURIComponent(name)}`;
  const { res, retried } = await requestTrendyolWithRetry(() =>
    gotScraping({
      url,
      headerGeneratorOptions: HEADER_GENERATOR_OPTIONS,
      cookieJar: trendyolCookieJar,
      headers: { accept: "application/json" },
      throwHttpErrors: false,
      responseType: "json",
    })
  );

  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw buildTrendyolFetchError("جستجوی ID برند ترندیول", res, retried);
  }

  return (res.body as Array<{ id: number; name: string }>) ?? [];
}

export async function resolveTrendyolBrandId(brandName: string): Promise<number | null> {
  if (brandIdCache.has(brandName)) return brandIdCache.get(brandName)!;

  try {
    let list = await searchTrendyolBrandsByName(brandName);

    // «Trendyolmilla Man» (و مشابه‌هاش) توی دایرکتوریِ برندهای ترندیول با همین
    // اسمِ دقیق ثبت نشده -- تأیید شده با تستِ مستقیم: جستجوی «Trendyolmilla Man»
    // چیزی برنمی‌گردونه، ولی خودِ برندِ رسمیِ مردانه زیرِ اسمِ «TRENDYOL MAN»
    // (بدونِ «milla») ثبت شده. یه بار با حذفِ «milla» هم امتحان می‌کنیم
    if (list.length === 0 && /^trendyolmilla\s+\S/i.test(brandName)) {
      list = await searchTrendyolBrandsByName(brandName.replace(/trendyolmilla/i, "Trendyol"));
    }

    // هنوز هیچی؟ (مثلاً «Trendyolmilla Woman»/«Trendyolmilla Kids» -- که برخلافِ
    // مردانه، برندِ جدایی توی ترندیول ندارن) برندِ عمومیِ میلا (بدونِ پسوندِ
    // جنسیت/دسته) رو fallback بگیر -- برای این‌که «محصولات مشابه» بی‌خودی
    // کامل حذف نشه؛ بهتر از هیچیه چون این endpoint فقط شخصی‌سازیه
    if (list.length === 0 && /^trendyolmilla\b/i.test(brandName.trim())) {
      list = await searchTrendyolBrandsByName("Trendyolmilla");
    }

    // تطبیق دقیق (case-insensitive) روی اسم -- اگه چندتا نتیجه‌ی مشابه اومد
    // (مثلاً "Framgan" و "Framgan Kids")، فقط دقیقاً هم‌نام رو قبول کن، وگرنه
    // اولین نتیجه رو fallback بگیر
    const exact = list.find((b) => b.name.toLowerCase() === brandName.toLowerCase());
    const id = exact?.id ?? list[0]?.id ?? null;
    brandIdCache.set(brandName, id);
    return id;
  } catch (err) {
    console.error(`[resolveTrendyolBrandId] یافتن ID برند "${brandName}" ناموفق بود:`, err);
    return null; // عمداً کش نمی‌شه -- شاید خطای گذرا بوده، دفعه‌ی بعد دوباره امتحان کن
  }
}
