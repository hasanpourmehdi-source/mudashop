// پوستر/تگ اینستاگرام برای محصولات ترندیول -- توابع خالص (پارس ورودی، ساخت
// تگ قابل جستجو در تلگرام، ساخت کپشن). منطق رندر پوستر (کانواس) در کلاینت است.

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

// ورودی می‌تواند لینک کامل ترندیول یا contentId عددی باشد (مثلاً از اسلاگ
// «/product-name-p123456» یا از حافظه). خروجی null یعنی ورودی قابل‌قبول نیست.
export function parseTrendyolInput(input: string): ParsedTrendyolInput | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    return { type: "contentId", contentId: trimmed };
  }

  if (/^https?:\/\//i.test(trimmed) && isAllowedTrendyolUrl(trimmed)) {
    return { type: "url", url: trimmed, hostname: new URL(trimmed).hostname };
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

// متن ساده برای تلگرام: تگ + لینک اصلی تا لینک در پیام‌های ذخیره‌شده گم نشود
export function buildTelegramNote(opts: { tag: string; url: string }): string {
  const lines: string[] = [];
  if (opts.tag) lines.push(`#${opts.tag}`);
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
  "کشور",
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

export function pickKeyAttributes(
  attributes: { name: string; value: string }[],
  max = 6
): { name: string; value: string }[] {
  if (!attributes || attributes.length === 0) return [];
  const byName = (name: string) => attributes.find((a) => a.name.includes(name));
  const picked: { name: string; value: string }[] = [];
  const seen = new Set<string>();
  // فقط یک مورد به‌ازای هر کلیدواژه -- وگرنه یه کلیدواژه‌ی عمومی مثل «جنس» هم
  // «جنس» هم «جنس ترکیب» رو با هم می‌گرفت (دو خطِ تقریباً تکراری) و جای بقیه‌ی
  // مشخصاتِ متنوع (یقه، آستین، ...) رو می‌گرفت
  for (const kw of KEY_ATTR_KEYWORDS) {
    if (picked.length >= max) break;
    const a = byName(kw);
    if (a && !seen.has(a.name)) {
      seen.add(a.name);
      picked.push(a);
    }
  }
  // بقیه را به‌ترتیب پر کن
  for (const a of attributes) {
    if (picked.length >= max) break;
    if (!seen.has(a.name)) {
      seen.add(a.name);
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
  "#shoppingstage",
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
    .split(/[\s،,.;:()\[\]{}"'«»\/|_+]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function isValidHashtagToken(token: string): boolean {
  if (token.length < 2) return false;
  if (/^[0-9۰-۹]+$/.test(token)) return false;
  if (/^[%#@!؟?.,]+$/.test(token)) return false;
  return true;
}

// ساخت هشتگ‌های آخر کپشن از عنوان و مشخصات محصول (برند، دسته، مقادیر ویژگی‌ها،
// سایزها) برای گروه‌بندی و بالا رفتن پست در اینستاگرام
export function buildGeneratedHashtags(opts: {
  nameFa?: string | null;
  brand?: string | null;
  categoryName?: string | null;
  attributes?: { name: string; value: string }[];
  sizes?: string[];
}): string[] {
  const pool: string[] = [];
  if (opts.nameFa) pool.push(opts.nameFa);
  if (opts.brand) pool.push(opts.brand);
  if (opts.categoryName) pool.push(opts.categoryName);
  for (const a of opts.attributes ?? []) pool.push(a.value);
  for (const s of opts.sizes ?? []) pool.push(s);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const piece of pool) {
    if (!piece) continue;
    for (const raw of tokenizeForHashtags(piece)) {
      const token = raw.toLowerCase();
      if (!isValidHashtagToken(token)) continue;
      if (HASHTAG_STOPWORDS.has(token)) continue;
      if (seen.has(token)) continue;
      seen.add(token);
      out.push(token);
      if (out.length >= 14) break;
    }
    if (out.length >= 14) break;
  }

  // تگ ترکیبی عنوان (کلمات معنا‌دار با «_») در ابتدای تگ‌های ساخته‌شده
  if (opts.nameFa) {
    const words = tokenizeForHashtags(opts.nameFa).filter(
      (w) => isValidHashtagToken(w) && !HASHTAG_STOPWORDS.has(w)
    );
    if (words.length >= 2) {
      const combined = words.slice(0, 4).join("_");
      if (!seen.has(combined)) out.unshift(combined);
    }
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
};

// اینستاگرام عملاً بیشتر از ۳۰ هشتگ رو نادیده می‌گیرد (یا کل کپشن رو اسپم‌گونه
// می‌کند) -- پس جمعِ هشتگ‌ها رو به این عدد محدود می‌کنیم. هشتگ‌های *ساخته‌شده*
// (مخصوصِ همین محصول -- رنگ/سایز/دسته) مهم‌ترن چون مخاطبِ دقیق‌تری پیدا
// می‌کنن، پس اول انتخاب می‌شن؛ بقیه‌ی ظرفیت با هشتگ‌های پایه‌ی استیج پر می‌شه
const MAX_TOTAL_HASHTAGS = 30;

// کپشن آماده برای پست اینستاگرام: تگ پیگیری در خط اول + متن ثابت استیج +
// هشتگ‌های ساخته‌شده از عنوان/مشخصات محصول (اولویت) + هشتگ‌های پایه (پرکننده‌ی ظرفیت باقی‌مانده)
export function buildCaption(opts: CaptionInput): string {
  const generated = buildGeneratedHashtags(opts);
  const hashtags = [...generated];
  for (const h of BASE_HASHTAGS) {
    if (hashtags.length >= MAX_TOTAL_HASHTAGS) break;
    if (!hashtags.includes(h)) hashtags.push(h);
  }
  let caption = "";
  if (opts.tag) caption += `#${opts.tag}\n`;
  caption += CAPTION_BODY;
  caption += `\n\n${hashtags.map((h) => `#${h}`).join(" ")}`;
  return caption;
}