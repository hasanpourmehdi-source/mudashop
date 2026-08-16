import { prisma } from "@/lib/prisma";
import { notifyAdminsOnce } from "@/lib/adminAlerts";

const SOURCE_LABELS: Record<string, string> = {
  "check-url": "بررسی فیلتر",
  "page-load": "لود صفحه",
  "load-more": "بارگذاری بیشتر",
  "trendyol-filters": "دریافت رنگ/برند",
  "product-detail": "صفحه‌ی جزئیات محصول",
  "search": "جستجوی متنی",
  "similar-products": "محصولات مشابه",
  checkout: "نهایی‌کردن سفارش",
  "order-stock-check": "بررسی موجودی سفارش",
};

// هر جا یه درخواست به ترندیول شکست بخوره (چه اعتبارسنجی فیلتر قبل از commit،
// چه لود اولیه‌ی صفحه، چه «بارگذاری بیشتر»، چه دریافت رنگ/برند)، این تابع
// صداش می‌شه. عمداً fire-and-forget و توی try/catch جدا پیچیده شده -- اگه
// خودِ ثبت لاگ به هر دلیلی خطا بده، نباید باعث خراب شدن جریان اصلی (نمایش
// پیام به کاربر) بشه
export async function logTrendyolFetchFailure(params: {
  url: string;
  error: string;
  source: "check-url" | "page-load" | "load-more" | "trendyol-filters" | "product-detail" | "search" | "similar-products" | "best-sellers" | "checkout" | "order-stock-check";
  siteSlug?: string;
}) {
  try {
    await prisma.trendyolFetchLog.create({
      data: {
        url: params.url,
        error: params.error,
        source: params.source,
        siteSlug: params.siteSlug ?? null,
      },
    });
  } catch (err) {
    console.error("ثبت لاگ خطای ترندیول هم ناموفق بود:", err);
  }

  // یه اعلان هم به همه‌ی ادمین‌ها می‌ره -- با prefix مبتنی بر منبع (نه خودِ
  // URL)، چون اگه همون فیلتر خاص چندبار پشت‌سرهم خطا بده، نباید ده‌ها اعلان
  // تکراری بسازه (notifyAdminsOnce خودش این تکرار رو توی ۲۴ ساعت دیدوپ می‌کنه)
  try {
    const label = SOURCE_LABELS[params.source] ?? params.source;
    const prefix = `خطای ترندیول (${label})`;
    await notifyAdminsOnce(
      prefix,
      `${prefix}: دریافت محصولات از ترندیول ناموفق بود.\nURL: ${params.url}\nخطا: ${params.error}`,
      "/admin/trendyol-fetch-logs"
    );
  } catch (err) {
    console.error("ارسال اعلان ادمین برای خطای ترندیول ناموفق بود:", err);
  }
}
