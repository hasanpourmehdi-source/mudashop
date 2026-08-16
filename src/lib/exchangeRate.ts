import { prisma } from "@/lib/prisma";

// نرخ ارز رو دیتابیس نگه می‌داره، ولی چون قیمت هر محصول ترندیول توی هر صفحه‌ی
// گرید (۳۰-۴۰ محصول) باید تبدیل بشه، اگه به‌ازای هر محصول یه query جدا بزنیم
// فشار بی‌مورد روی SQLite میاد. برای همین یه کش خیلی کوتاه‌مدت حافظه‌ای داریم؛
// موقع ذخیره‌ی نرخ جدید از پنل ادمین (updateExchangeRate) بلافاصله invalidate
// می‌شه، پس بیشتر از چند دقیقه هیچ‌وقت نرخ کهنه نمایش داده نمی‌شه.
const CACHE_TTL_MS = 5 * 60 * 1000;

export type ExchangeRateInfo = {
  rate: number;
  profitPercent: number;
};

const cache = new Map<string, { data: ExchangeRateInfo; expiresAt: number }>();

// طبق تصمیم صریح مهدی: نرخ باید همیشه «نرخ روز» (لحظه‌ی محاسبه) باشه، نه نرخ
// قفل‌شده‌ی لحظه‌ی سفارش -- وگرنه با نوسان ارز ضرر می‌کنیم. برای همین اینجا
// هیچ snapshot ای گرفته/ذخیره نمی‌شه؛ هر بار که قیمتی باید نمایش داده بشه،
// همین تابع صدا زده می‌شه.
export async function getExchangeRateInfo(currency: string): Promise<ExchangeRateInfo> {
  const cached = cache.get(currency);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const row = await prisma.exchangeRate.findUnique({ where: { currency } });
  // اگه ادمین هنوز نرخ این ارز رو ثبت نکرده، صفر برمی‌گردونیم (نه یه عدد فرضی
  // گمراه‌کننده) -- صفر باعث می‌شه قیمت صفر/نامعتبر توی UI مشخص بشه که نیاز به
  // تنظیم نرخ توی پنل ادمین هست
  const data: ExchangeRateInfo = row
    ? { rate: row.rate, profitPercent: row.profitPercent }
    : { rate: 0, profitPercent: 0 };

  cache.set(currency, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

// اعمال نرخ روی یه مبلغ ارزی خام -> عدد تومانی، رند شده به نزدیک‌ترین ۱۰۰۰
// تومان (سه رقم آخر صفر) -- وگرنه ضرب قیمت ارزی در نرخ اعشاری/درصد سود عددی
// مثل ۲۶۶٬۴۳۲ تومان می‌ده که برای قیمت‌گذاری فروشگاه ایرانی غیرطبیعیه
export function applyExchangeRate(amount: number, info: ExchangeRateInfo): number {
  const raw = amount * info.rate * (1 + info.profitPercent / 100);
  return Math.round(raw / 1000) * 1000;
}

// میان‌بر برای وقتی فقط یه مبلغ تک داریم (برای چندتا مبلغ از یه ارز، بهتره
// یه بار getExchangeRateInfo بگیری و applyExchangeRate رو تکرار کنی -- این
// تابع خودش برای هر صدا یه query می‌زنه)
export async function convertToToman(amount: number, currency: string): Promise<number> {
  const info = await getExchangeRateInfo(currency);
  return applyExchangeRate(amount, info);
}

// موقع ذخیره‌ی نرخ جدید از پنل ادمین صدا زده می‌شه تا کش کهنه نمونه
export function invalidateExchangeRateCache(currency?: string) {
  if (currency) cache.delete(currency);
  else cache.clear();
}
