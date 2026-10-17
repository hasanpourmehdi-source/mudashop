// پوستر/تگ اینستاگرام برای محصولات ترندیول -- توابع خالص (پارس ورودی، ساخت
// تگ قابل جستجو در تلگرام، ساخت کپشن). منطق رندر پوستر (کانواس) در کلاینت است.

import { hasUntranslatedLatin } from "@/lib/turkishText";

export const ALLOWED_TRENDYOL_HOSTS = [
  "www.trendyol.com",
  "trendyol.com",
  "www.trendyol-milla.com",
  "trendyol-milla.com",
];

export type ParsedTrendyolInput =
  | { type: "url"; url: string; hostname: string }
  | { type: "contentId"; contentId: string };

export function isAllowedTrendyolUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ALLOWED_TRENDYOL_HOSTS.includes(hostname);
  } catch {
    return false;
  }
}

// وقتی از خودِ اپِ موبایلِ ترندیول لینک شیر می‌شه، به‌جای لینکِ کاملِ محصول، یه
// لینکِ کوتاهِ ty.gl می‌ده -- این باید قبل از parseTrendyolInput جداگانه حل بشه
const TRENDYOL_SHORT_LINK_HOSTS = ["ty.gl"];

export function isTrendyolShortLink(url: string): boolean {
  try {
    return TRENDYOL_SHORT_LINK_HOSTS.includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

// لینکِ کوتاهِ ty.gl رو دنبال می‌کنه و لینکِ نهایی رو برمی‌گردونه. خودِ ty.gl
// پشتِ Cloudflare نیست، پس یه fetchِ ساده (بدونِ gotScraping/کوکی‌جار) کافیه.
// بسته به IP/کشورِ تشخیص‌داده‌شده، لینکِ نهایی گاهی مستقیم صفحه‌ی محصوله، گاهی
// یه صفحه‌ی میانیِ trendyol.com/en/select-country که لینکِ واقعی رو توی
// کوئری‌پارامترِ cb (یه مسیرِ نسبیِ URL-encode شده) نگه داشته -- توی این حالت،
// cb رو دیکود و به لینکِ کاملِ محصول تبدیل می‌کنیم
export async function resolveTrendyolShortLink(shortUrl: string): Promise<string | null> {
  try {
    const res = await fetch(shortUrl, { redirect: "follow" });
    const finalUrl = res.url || shortUrl;
    const parsed = new URL(finalUrl);
    if (parsed.pathname === "/en/select-country") {
      const cb = parsed.searchParams.get("cb");
      return cb ? `https://www.trendyol.com${cb}` : null;
    }
    return finalUrl;
  } catch {
    return null;
  }
}

// همون تشخیصِ trendyol در برابرِ trendyol-milla که بقیه‌ی سایت با siteSlug
// (رشته‌ی خامِ ExternalSite.slug) دست‌به‌دست می‌کنه -- برای وقتی فقط لینکِ
// محصول رو داریم (مثلاً موقعِ ثبتِ لاگِ پوسترِ اینستاگرام) و باید همون slug رو ازش دربیاریم
export function siteSlugFromUrl(url: string): "trendyol" | "trendyol-milla" {
  try {
    const { hostname } = new URL(url);
    return hostname.includes("trendyol-milla.com") ? "trendyol-milla" : "trendyol";
  } catch {
    return "trendyol";
  }
}

// لینکِ اشتراک‌گذاریِ ترندیول (چه از خودِ سایت، چه از اپ) پر از پارامترهای
// ردیابیه (utm_*، adjust_*، link_contentid) که هیچ‌کدوم برای ما لازم نیستن --
// فقط boutiqueId/merchantId (تشخیصِ فروشنده) واقعاً به کار میان. این‌ها رو
// همین‌جا (نقطه‌ی ورودیِ واحدِ همه‌ی لینک‌ها، چه مستقیم پیست‌شده چه از
// resolveTrendyolShortLink حل‌شده) پاک می‌کنیم تا هرجا بعداً این لینک
// نمایش/کپشن/کش بشه، از همون اول تمیز باشه
const TRENDYOL_TRACKING_PARAM_PREFIXES = ["utm_", "adjust_"];
const TRENDYOL_TRACKING_PARAM_EXACT = new Set(["link_contentid"]);

export function cleanTrendyolUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const toDelete: string[] = [];
    parsed.searchParams.forEach((_, key) => {
      const lower = key.toLowerCase();
      if (
        TRENDYOL_TRACKING_PARAM_EXACT.has(lower) ||
        TRENDYOL_TRACKING_PARAM_PREFIXES.some((p) => lower.startsWith(p))
      ) {
        toDelete.push(key);
      }
    });
    for (const key of toDelete) parsed.searchParams.delete(key);
    return parsed.toString();
  } catch {
    return url;
  }
}

// ورودی می‌تواند لینک کامل ترندیول یا contentId عددی باشد (مثلاً از اسلاگ
// «/product-name-p123456» یا از حافظه). خروجی null یعنی ورودی قابل‌قبول نیست.
export function parseTrendyolInput(input: string): ParsedTrendyolInput | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    return { type: "contentId", contentId: trimmed };
  }

  // لینکِ کوتاهِ ty.gl هم این‌جا «قابل‌قبول» حساب می‌شه (نه رد بشه) -- خودِ
  // لینکِ محصول نیست، ولی سمتِ سرور (پیش از fetchTrendyolProductDetail) با
  // resolveTrendyolShortLink حل می‌شه. اینجا فقط باید تشخیص بدیم که ورودی
  // یه لینکِ قابل‌استفاده‌ست، نه این‌که همین‌جا خودش رو کامل حل کنیم -- برای
  // همین فقط لینکِ کاملِ (نه کوتاهِ) قابل‌شناسایی همین‌جا پاک می‌شه
  if (/^https?:\/\//i.test(trimmed) && isAllowedTrendyolUrl(trimmed)) {
    return { type: "url", url: cleanTrendyolUrl(trimmed), hostname: new URL(trimmed).hostname };
  }
  if (/^https?:\/\//i.test(trimmed) && isTrendyolShortLink(trimmed)) {
    return { type: "url", url: trimmed, hostname: new URL(trimmed).hostname };
  }

  return null;
}

// از یه متنِ خام (نه لزوماً خودِ لینک -- مثلاً متنِ اشتراک‌گذاریِ یه اپِ دیگه یا
// چیزی که کاربر از کلیپ‌بورد پیست کرده) بهترین ورودیِ قابل‌قبول برای
// parseTrendyolInput رو استخراج می‌کنه. اگه خودِ متن یه ورودیِ معتبره (لینک یا
// contentId عددی)، همون برگردونده می‌شه؛ وگرنه دنبالِ یه لینکِ مجازِ ترندیول/میلا
// وسطِ متن می‌گرده («این لباسو ببین: https://...» -> فقط خودِ لینک)
export function extractTrendyolLinkFromText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (parseTrendyolInput(trimmed)) return trimmed;
  const match = trimmed.match(/https?:\/\/\S+/);
  if (match && parseTrendyolInput(match[0])) return match[0];
  return null;
}

// وقتی از Web Share Target باز شده باشیم (دکمه‌ی «اشتراک‌گذاری»ِ خودِ سیستم‌عامل
// روی اپِ ترندیول -> مُداشاپ رو از لیست انتخاب کرده)، مرورگر پارامترهای
// title/text/url رو توی کوئری‌استرینگ می‌فرسته (public/manifest.json::share_target).
// برخلافِ ?input= (که خودمون می‌سازیمش و همیشه تمیزه)، این‌ها متنِ خامِ اپِ
// دیگه‌ان -- همون استخراجِ extractTrendyolLinkFromText رو روشون اجرا می‌کنیم؛
// مسیرِ قدیمیِ ?input= دست‌نخورده و بدونِ اعتبارسنجی می‌مونه (رفتارِ فعلیِ
// «ساخت پست اینستاگرام» عوض نشه)
export function resolveShareTargetInput(params: URLSearchParams): string | null {
  const explicit = params.get("input");
  if (explicit) return explicit;

  for (const key of ["url", "text", "title"]) {
    const raw = params.get(key);
    if (!raw) continue;
    const extracted = extractTrendyolLinkFromText(raw);
    if (extracted) return extracted;
  }

  return null;
}

// استخراج contentId از اسلاگ/لینک ترندیول. الگوی پیوندها:
//   /brand-name/product-name-p123456789?boutiqueId=...  -> 123456789
// گاهی یک بار id=-1 تکرار می‌شود یا لینک اصلاً contentId ندارد؛ در آن صورت null.
export function extractContentIdFromSlugPath(path: string): string | null {
  const matches = path.match(/-p(\d{6,})/);
  return matches ? matches[1] : null;
}

// یک تگ کوتاه و قابل جستجو در تلگرام می‌سازد: ترکیب برند و نام محصول + بخشی از
// contentId تا منحصربه‌فرد بماند (حتی برای محصولات هم‌نام). مثال:
// «Guess مانتو شلوار» با contentId=123456789 -> «Guessمانتوشلوار123456»
export function buildTag(opts: { brand?: string | null; nameFa?: string | null; seed?: string | null }): string {
  const base = [opts.brand ?? "", opts.nameFa ?? ""]
    .map((s) => s.trim())
    .filter(Boolean)
    .join("");
  if (!base && !opts.seed) return "";
  const cleaned = base.replace(/[^\p{L}\p{N}]/gu, "");
  const suffix = opts.seed ? opts.seed.replace(/\D/g, "").slice(-6) : "";
  const combined = cleaned + suffix;
  return combined.slice(0, 40);
}

// اسمِ برند روی پوستر باید با حروفِ انگلیسیِ ساده باشه، نه حروفِ خاصِ ترکی
// (İ/ı/Ş/ş/Ğ/ğ/Ç/ç/Ö/ö/Ü/ü) -- برخلافِ foldTurkish که حروفِ کوچیک می‌سازه،
// این‌جا حروفِ بزرگ (که toUpperCase روشون اجرا می‌شه) باید حفظ بمونن
export function toEnglishBrandName(brand: string): string {
  return brand
    .replace(/İ/g, "I")
    .replace(/ı/g, "i")
    .replace(/Ş/g, "S")
    .replace(/ş/g, "s")
    .replace(/Ğ/g, "G")
    .replace(/ğ/g, "g")
    .replace(/Ç/g, "C")
    .replace(/ç/g, "c")
    .replace(/Ö/g, "O")
    .replace(/ö/g, "o")
    .replace(/Ü/g, "U")
    .replace(/ü/g, "u");
}

// تگِ ساده و همیشه‌یکتا: فقط بر پایه‌ی contentId خودِ محصول (نه نام/برند) --
// چون contentId ترندیول یکتاست، این تگ هرگز تکراری نمی‌شود. مثال: «P8768667867»
export function buildProductIdTag(contentId?: string | null): string {
  const digits = (contentId ?? "").replace(/\D/g, "");
  return digits ? `P${digits}` : "";
}

// وقتی متنِ ترجمه‌شده‌ی یه کمپینِ ترندیول با «کد» شروع می‌شه (مثلاً «کدFIRSAT۵
// با ۹۹۹ لیر ۵٪ تخفیف») یعنی یه کمپینِ کدتخفیفیه -- برای استفاده نیاز به
// واردکردنِ اون کد توی چک‌اوتِ خودِ ترندیوله. چون مشتریِ ما مستقیم با چک‌اوتِ
// ترندیول کاری نداره (ما واسطه‌ایم، طبقِ متنِ CAPTION_BODY)، این نوع کمپین‌ها
// روی پوسترِ اینستاگرام گیج‌کننده‌ان -- فقط کمپین‌های واقعی (تخفیفِ خریدِ
// چندتایی/سبد) که مستقیم روی قیمتِ نهایی اثر می‌ذارن باید حک بشن
export function isCouponCodeCampaign(text: string): boolean {
  // \b انگلیسیه و بعدِ حروفِ فارسی درست کار نمی‌کنه -- به‌جاش صریح چک می‌کنیم که
  // بعدِ «کد» یا چیزی تمومه یا فاصله/حرفِ لاتینِ بزرگ/رقم میاد (مثلِ «کدFIRSAT۵»
  // یا «کد تخفیف»)، نه یه حرفِ فارسیِ دیگه که کلمه‌ی جداگانه‌ای بسازه («کدو»، «کدام»)
  return /^کد([\sA-Z0-9۰-۹]|$)/.test(text.trim());
}

// «تخفیفِ سبدخرید» (discountType === "DiscountOnBasket" -- مثلِ «Sepette %20
// İndirim») یه کمپینِ حتمی/خودکاره: برخلافِ بقیه‌ی کمپین‌ها (نمایشی/شرطی)،
// مستقیم روی قیمتِ نهایی اثر می‌ذاره. درصدش رو از خودِ نامِ خامِ ترکی درمیاریم
// (نه متنِ ترجمه‌شده، چون فرمولِ ترجمه ممکنه فرمت/رقم رو عوض کرده باشه)
export function extractBasketDiscountPercent(
  badges: { rawNameTr: string; discountType: string | null }[],
): number | null {
  const badge = badges.find((b) => b.discountType === "DiscountOnBasket");
  if (!badge) return null;
  const match = badge.rawNameTr.match(/%\s*(\d+)|(\d+)\s*%/);
  if (!match) return null;
  const pct = Number(match[1] ?? match[2]);
  return Number.isFinite(pct) && pct > 0 && pct < 100 ? pct : null;
}

// تگِ «#Pxxxx» وقتی تنها روی یک خط باشه (بدون هیچ حرفِ فارسیِ قبل/بعدش)، توی
// یک کانتینرِ RTL (کپشن/کامنتِ اینستاگرام، پیامِ تلگرام -- همه‌جا فارسی‌محورن)
// الگوریتمِ بایدایِ یونیکد جهتش رو برعکس می‌کنه و «#P123» به‌شکلِ «P123#» نشون
// داده می‌شه. ایزوله‌کردنش با LRI/PDI (نه صرفاً dir=ltr روی خودِ عنصر -- چون
// این متن کپی و جای دیگه (اینستاگرام/تلگرام) پیست می‌شه و اونجا هم باید درست باشه)
export function ltrIsolate(text: string): string {
  return `⁦${text}⁩`;
}

// متن ساده برای تلگرام: تگ + لینک اصلی تا لینک در پیام‌های ذخیره‌شده گم نشود
export function buildTelegramNote(opts: { tag: string; url: string }): string {
  const lines: string[] = [];
  if (opts.tag) lines.push(ltrIsolate(`#${opts.tag}`));
  if (opts.url) lines.push(opts.url);
  return lines.join("\n");
}

// اولویت‌بندی ویژگی‌های مهم برای نمایش روی پوستر (جنس، رنگ، سایز و ...)
const KEY_ATTR_KEYWORDS = [
  "جنس",
  "متریال",
  "رنگ",
  "سایز",
  "سایزبندی",
  "ساخت",
  "آستین",
  "یقه",
  "جیب",
  "نوع",
  "مدل",
  "قد",
  "قابلیت",
  "مناسب برای",
];

// روی خودِ پوستر، لیبلِ ویژگی نشون داده نمی‌شه (فقط مقدار) -- پس مقدار باید
// خودش به‌تنهایی برای مشتری قابلِ‌فهم باشه. یه عددِ خامِ بدون واحد (مثلاً «۲»
// برای «جیب: ۲») یا یه کلمه‌ی هنوز ترجمه‌نشده‌ی ترکی/لاتین (چون دیکشنری
// هنوز پوششش نداده) بدونِ لیبل هیچ معنی‌ای نداره -- بهتره این‌جور مقدارها
// اصلاً به‌عنوانِ ویژگیِ کلیدی برای پوستر انتخاب نشن
function isBareNumberOrSymbol(value: string): boolean {
  const stripped = value.replace(/[۰-۹0-9%٪.,،\-\s]/g, "");
  return stripped.length === 0;
}

export function pickKeyAttributes(
  attributes: { name: string; value: string }[],
  max = 6
): { name: string; value: string }[] {
  if (!attributes || attributes.length === 0) return [];
  const usable = attributes.filter(
    (a) => !isBareNumberOrSymbol(a.value) && !hasUntranslatedLatin(a.value) && !hasUntranslatedLatin(a.name)
  );
  const byName = (name: string) => usable.find((a) => a.name.includes(name));
  const picked: { name: string; value: string }[] = [];
  const seen = new Set<string>();
  // بعضی محصولات دو ویژگیِ *مختلف* (مثلاً «جنسِ رویه» و «جنسِ آستر») دارن که
  // مقدارشون عیناً یکیه (مثلاً هردو «مصنوعی چرم») -- روی پوستر که فقط مقدار
  // نشون داده می‌شه (نه لیبل)، این می‌شه یه خطِ تکراری. پس علاوه‌بر نام، خودِ
  // مقدار (نرمال‌شده) هم دیدوپ می‌شه
  const seenValues = new Set<string>();
  const normalizedValue = (v: string) => v.trim().toLowerCase();
  // فقط یک مورد به‌ازای هر کلیدواژه -- وگرنه یه کلیدواژه‌ی عمومی مثل «جنس» هم
  // «جنس» هم «جنس ترکیب» رو با هم می‌گرفت (دو خطِ تقریباً تکراری) و جای بقیه‌ی
  // مشخصاتِ متنوع (یقه، آستین، ...) رو می‌گرفت
  for (const kw of KEY_ATTR_KEYWORDS) {
    if (picked.length >= max) break;
    const a = byName(kw);
    if (a && !seen.has(a.name) && !seenValues.has(normalizedValue(a.value))) {
      seen.add(a.name);
      seenValues.add(normalizedValue(a.value));
      picked.push(a);
    }
  }
  // بقیه را به‌ترتیب پر کن
  for (const a of usable) {
    if (picked.length >= max) break;
    if (!seen.has(a.name) && !seenValues.has(normalizedValue(a.value))) {
      seen.add(a.name);
      seenValues.add(normalizedValue(a.value));
      picked.push(a);
    }
  }
  return picked;
}

// قیمت به تومان با ارقام فارسی و جداکننده (نمایش در جستجو/سایت)
export function priceToman(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  return `${amount.toLocaleString("fa-IR")} تومان`;
}

// قیمت به لیر (در پوستر نمایش داده می‌شود، مثل «650TL»)
export function priceTL(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  return `${Math.round(amount)}TL`;
}

// سایزِ سنیِ لباسِ بچه («2-4 Yaş»، «0-3 Ay») -- مترجمِ عمومیِ سایزِ پوستر کلماتِ
// کمتر از ۴ حرف رو اصلاً رد می‌کرد و «Yaş» فقط ۳ حرفه، پس همیشه ترکی می‌موند.
// عمداً قاعده‌ی جدا، نه یه ردیفِ دیکشنریِ «yas -> سال»: «yaş» توی عنوانِ محصولات
// معنیِ «خیس/مرطوب» هم می‌ده (مثلاً «Yaş Mendil») و ردیفِ عمومی اونا رو خراب می‌کرد.
// null یعنی این برچسب سایزِ سنی نیست
export function translateAgeSizeLabel(size: string): string | null {
  const m = size.match(/^\s*(\d+(?:[.,]\d+)?(?:\s*-\s*\d+(?:[.,]\d+)?)?)\s*(yaş|yas|ay)\s*$/i);
  if (!m) return null;
  const unit = m[2].toLowerCase() === "ay" ? "ماه" : "سال";
  return `${m[1].replace(/\s+/g, "")} ${unit}`;
}

// درصد تخفیف برای دایره‌ی قرمز روی پوستر؛ null یعنی تخفیفی نیست
export function getDiscountPercent(
  price: number | null | undefined,
  originalPrice: number | null | undefined
): number | null {
  if (price == null || originalPrice == null || originalPrice <= 0) return null;
  if (price >= originalPrice) return null;
  return Math.round(((originalPrice - price) / originalPrice) * 100);
}

// ============================================================================
// کپشن اینستاگرام -- قالب ثابت استیج (به‌جز تگ پیگیری در خط اول و هشتگ‌های
// آخر که از عنوان/مشخصات محصول ساخته می‌شوند)
// ============================================================================
export const CAPTION_BODY = [
  "قیمت نهایی اجناس در دایرکت مشخص میشه",
  "هزینه باربری بعد از وزنکشی محاسبه و اعلام خواهد شد",
  "",
  "زمان حدودی تحویل سفارشات:",
  "ترکیه، هوایی حدودا سه هفته",
  "دبی، حدود یک تا دو ماه",
  "آمریکا و انگلیس، با اولین مسافر",
  "البته پس از تحویل سایت به نماینده ما در خارج",
  "این بازه ها تقریبی بوده و بنا به شرایط و طی شدن مراحل گمرکی متغیر می باشد، لذا لطفا هنگام خرید شرایط خاص مرزها و ارسال رو در نظر بگیرید",
  "",
  "برای اطلاع از قیمتها عکس انتخاب تون رو به دایرکت ارسال کنید، بگم سایزتون موجوده و قیمتش تغییر کرده یا نه",
  "ما پوشاک مثل بلوز شلوار جین شومیز تیشرت بافت کفش و هر چی که بشه آورد چه زنانه مردانه پسرانه دخترانه بچگانه و از هر برندی که شما بخواید براتون از ترکیه دبی و آمریکا خرید و ارسال می کنیم",
  "در واقع ما نه تولید کننده هستیم نه چیزی موجود داریم",
  "ما کارگزار شما هستیم و چون شما امکان خرید از سایت های خارجی به صورت آنلاین را ندارید، ما براتون خرید می کنیم و درب منزل بهتون تحویل میدیم",
  "امکان خرید از همه برندها وجود داره",
  "آمازون نکست شین زارا منگو استرادیواریوس برشکا اچاندام نایک آدیداس و هر برندی که بشه خرید و همه تولیدات ترک",
  ltrIsolate("@Shopping.Stage"),
  "",
  "نکته بسیار مهم:",
  "*امکان تعویض یا کنسلی نداریم چون اجناس فقط برای شما سفارشی خریده شده*",
].join("\n");

// هشتگ‌های پایه‌ی استیج برای گروه‌بندی/دیده شدن پست
export const BASE_HASHTAGS = [
  "شلوار",
  "بلوز",
  "پانچو",
  "پلیور",
  "بافت",
  "کاپشن",
  "تیشرت",
  "پالتو",
  "کاسه",
  "لباس",
  "پیراهن",
  "شومیز",
  "دوتیکه",
  "بلوزبافت",
  "شلوارک",
  "نیم_تنه",
  "تاپ",
  "تاپ_زنانه",
  "دامن",
  "ژاکت",
  "جلیقه",
  "ست_بلوز",
  "سوئیشرت",
  "بلوزاستیج",
  "شومیزاستیج",
  "تاپ_استیج",
  "دامن_استیج",
  "ژاکت_استیج",
];

const HASHTAG_STOPWORDS = new Set([
  "و",
  "به",
  "با",
  "از",
  "برای",
  "در",
  "یا",
  "مدل",
  "نوع",
  "جنس",
  "متریال",
  "سایز",
  "رنگ",
  "کشور",
  "ساخت",
  "مناسب",
  "قد",
  "قابلیت",
  "مثل",
]);

// نرمال‌سازی حروف فارسی/عربی (ی/ک/همزه) و خرد کردن متن به کلمات
function tokenizeForHashtags(text: string): string[] {
  return text
    .normalize("NFKC")
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[\u064A\u0649]/g, "ی")
    .replace(/\u06A9/g, "ک")
    // خط‌تیره جداکننده نیست ("سویشرت-شلوار" باید یه هشتگ بمونه)، ولی توی
    // هشتگِ واقعیِ اینستاگرام نامعتبره -- زیرخط تنها جایگزینِ مجازه
    .replace(/-/g, "_")
    .split(/[\s،,.;:()\[\]{}"'«»\/|+]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

// allowLatin=true فقط برای برند: طبقِ درخواستِ صریح، اسمِ لاتینِ برند هم باید
// هشتگ بشه (کنارِ معادلِ فارسی‌ش، اگه ترجمه شده باشه) -- برخلافِ بقیه‌ی منابع
// (عنوان/دسته‌بندی/مشخصات) که همچنان فقط فارسی‌شون هشتگ می‌شه
// طبقِ درخواستِ صریح: نیم‌فاصله (ZWNJ) توی خودِ کلماتِ ترکیبیِ فارسیِ درست
// (مثلِ «تی‌شرت»، «آستین‌بلند»، «راه‌راه») از نظرِ املا کاملاً درسته، ولی توی
// یه هشتگِ اینستاگرام هیچ‌کس (مخصوصاً کاربرِ عادی) باهاش آشنا نیست -- زیرخط
// (_) برعکس، برای همه قابلِ‌فهمه که یعنی «این‌ها یه هشتگِ واحدن». پس فقط موقعِ
// ساختنِ خودِ متنِ هشتگ (نه جاهای دیگه‌ی سایت که نیم‌فاصله باید همون درستِ
// املایی‌ش بمونه)، نیم‌فاصله رو با زیرخط عوض می‌کنیم
function toHashtagText(token: string): string {
  return token.replace(/‌/g, "_");
}

function isValidHashtagToken(token: string, allowLatin = false): boolean {
  if (token.length < 2) return false;
  if (/^[0-9۰-۹]+$/.test(token)) return false;
  if (/^[%#@!؟?.,]+$/.test(token)) return false;
  // طبقِ گزارشِ صریح: «٪۹۵» (یا «۹۵%») از این دو چکِ بالا رد نمی‌شد چون هم
  // رقم داره هم %، پس نه صرفاً «فقط رقم» بود نه صرفاً «فقط علامت» -- ولی %/٪
  // اصلاً جزوِ کاراکترهای مجازِ هشتگِ اینستاگرام نیست (هشتگ سرِ اولین % قطع
  // می‌شه)، و یه عددِ درصدِ تنها هم به‌عنوانِ هشتگ بی‌معنیه
  if (/[%٪]/.test(token)) return false;
  if (!allowLatin && hasUntranslatedLatin(token)) return false;
  return true;
}

// ساخت هشتگ‌های آخر کپشن از عنوان و مشخصات محصول (برند، دسته، مقادیر ویژگی‌ها،
// سایزها) برای گروه‌بندی و بالا رفتن پست در اینستاگرام
// دسته‌بندی توی UI پوستر یه چک‌باکسِ واحده (categoryIncluded) -- یعنی حتی اگه
// نامش چندکلمه‌ای باشه (مثلِ «شلوار گرمکن»)، با هم تیک می‌خوره/برداشته می‌شه،
// نه کلمه‌به‌کلمه. پس هشتگش هم باید عیناً یه واحد بمونه («شلوار_گرمکن»)، نه
// این‌که مثلِ عنوان/مشخصات (که واقعاً کلمه‌به‌کلمه‌ان) به هشتگ‌های جدا بشکنه
function combinedHashtagToken(text: string): string | null {
  const words = tokenizeForHashtags(text)
    .map((w) => w.toLowerCase())
    .filter((w) => isValidHashtagToken(w) && !HASHTAG_STOPWORDS.has(w));
  return words.length > 0 ? words.map(toHashtagText).join("_") : null;
}

export function buildGeneratedHashtags(opts: {
  nameFa?: string | null;
  brand?: string | null;
  // معادلِ فارسیِ برند (اگه توی دیکشنری ترجمه شده باشه) -- خودِ brand همیشه
  // لاتینه و طبقِ isValidHashtagToken هیچ‌وقت هشتگ نمی‌شه؛ این یکی جداست چون
  // بعضی برندها اسمِ فارسی‌شون جا افتاده و باید بشه هم اونو هشتگ کرد
  brandFa?: string | null;
  categoryName?: string | null;
  attributes?: { name: string; value: string }[];
  sizes?: string[];
}): string[] {
  const pool: { text: string; allowLatin?: boolean; combined?: boolean; wholeLatin?: boolean }[] = [];
  if (opts.nameFa) pool.push({ text: opts.nameFa });
  // برند: هم فرمِ لاتینِ اصلی هم معادلِ فارسی‌ش (اگه ترجمه شده باشه) -- طبقِ
  // درخواستِ صریح، هردو باید هشتگ بشن، نه فقط یکی. علاوه بر تکه‌تکه‌ی کلمات
  // (مثلِ «polo»، «assn»)، اسمِ *کاملِ* برند هم باید یه هشتگِ واحد باشه: فرمِ
  // لاتین بدونِ فاصله و علامت به‌هم‌چسبیده («uspoloassn»)، فرمِ فارسی با
  // زیرخط («یواس_پولو_اسن»). این دوتا قبلِ تکه‌ها میان تا اولویتِ بالاتری بگیرن
  if (opts.brand) pool.push({ text: opts.brand, wholeLatin: true });
  if (opts.brandFa) pool.push({ text: opts.brandFa, combined: true });
  if (opts.brand) pool.push({ text: opts.brand, allowLatin: true });
  if (opts.brandFa) pool.push({ text: opts.brandFa, allowLatin: true });
  if (opts.categoryName) pool.push({ text: opts.categoryName, combined: true });
  for (const a of opts.attributes ?? []) pool.push({ text: a.value });
  for (const s of opts.sizes ?? []) pool.push({ text: s });

  const seen = new Set<string>();
  const out: string[] = [];
  for (const piece of pool) {
    if (!piece.text) continue;
    if (piece.wholeLatin) {
      const token = piece.text
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "");
      if (isValidHashtagToken(token, true) && !seen.has(token)) {
        seen.add(token);
        out.push(token);
      }
      continue;
    }
    if (piece.combined) {
      const token = combinedHashtagToken(piece.text);
      if (token && !seen.has(token)) {
        seen.add(token);
        out.push(token);
      }
      continue;
    }
    for (const raw of tokenizeForHashtags(piece.text)) {
      const rawToken = raw.toLowerCase();
      if (!isValidHashtagToken(rawToken, piece.allowLatin)) continue;
      if (HASHTAG_STOPWORDS.has(rawToken)) continue;
      const token = toHashtagText(rawToken);
      if (seen.has(token)) continue;
      seen.add(token);
      out.push(token);
      if (out.length >= 14) break;
    }
    if (out.length >= 14) break;
  }

  return out.slice(0, 15);
}

export type CaptionInput = {
  tag: string;
  nameFa?: string | null;
  brand?: string | null;
  categoryName?: string | null;
  sizes?: string[];
  attributes?: { name: string; value: string }[];
  // اگه بدی، دقیقاً همین‌ها (حداکثر همون سقفِ ۵تایی) استفاده می‌شن -- برای
  // وقتی ادمین خودش با چک‌باکس از بینِ کاندیدهای buildGeneratedHashtags
  // انتخاب کرده، نه انتخابِ خودکار
  hashtags?: string[];
};

// طبقِ سیاستِ استیج، هر پست فقط ۵ تا هشتگ داره (نه سقفِ عمومیِ ۳۰تاییِ
// اینستاگرام) -- پس جمعِ هشتگ‌ها رو به همین عدد محدود می‌کنیم. هشتگ‌های
// *ساخته‌شده* (مخصوصِ همین محصول -- رنگ/سایز/دسته) مهم‌ترن چون مخاطبِ دقیق‌تری
// پیدا می‌کنن، پس اول انتخاب می‌شن؛ بقیه‌ی ظرفیت با هشتگ‌های پایه‌ی استیج پر می‌شه.
// همه‌شون هم فارسی‌ان (isValidHashtagToken) و هم BASE_HASHTAGS
export const MAX_TOTAL_HASHTAGS = 5;

// انتخابِ پیش‌فرضِ هشتگ‌ها (وقتی ادمین هنوز خودش با چک‌باکس چیزی رو صریحاً
// انتخاب نکرده) -- هم توسطِ buildCaption به‌عنوانِ حالتِ پیش‌فرض استفاده
// می‌شه، هم توسطِ خودِ UI برای مقداردهیِ اولیه‌ی چک‌باکس‌ها
export function buildDefaultHashtagSelection(
  opts: Omit<CaptionInput, "tag" | "hashtags">,
): string[] {
  const generated = buildGeneratedHashtags(opts);
  const hashtags = [...generated];
  for (const h of BASE_HASHTAGS) {
    if (hashtags.length >= MAX_TOTAL_HASHTAGS) break;
    if (!hashtags.includes(h)) hashtags.push(h);
  }
  return hashtags.slice(0, MAX_TOTAL_HASHTAGS);
}

// کپشن آماده برای پست اینستاگرام: تگِ پیگیری در خطِ اول (بدونِ #، چون جزوِ
// همون ۵تا هشتگِ مجاز حساب نشه) + متنِ ثابتِ استیج + هشتگ‌های ساخته‌شده از
// عنوان/مشخصات محصول (اولویت) + هشتگ‌های پایه (پرکننده‌ی ظرفیتِ باقی‌مانده)
export function buildCaption(opts: CaptionInput): string {
  const limitedHashtags = opts.hashtags
    ? opts.hashtags.slice(0, MAX_TOTAL_HASHTAGS)
    : buildDefaultHashtagSelection(opts);
  let caption = "";
  if (opts.tag) caption += `${ltrIsolate(opts.tag)}\n`;
  caption += CAPTION_BODY;
  caption += `\n\n${limitedHashtags.map((h) => `#${h}`).join(" ")}`;
  return caption;
}