import { prisma } from "@/lib/prisma";
import { notifyAdminsOnce } from "@/lib/adminAlerts";
import { normalizeSlug } from "@/lib/slug";
import { foldTurkish, toPersianDigits, toEnglishDigits } from "@/lib/turkishText";
import { levenshtein } from "@/lib/fuzzySearch";

// ============================================================================
// ترجمه‌ی خودکارِ عنوان محصولات ترندیول -- روش term-by-term با دیکشنری
// ============================================================================
// چرا این روش (نه API/LLM): اصطلاحات مد ترکی محدودن (چند صد کلمه‌کلیدی مثل
// Oversize/Slim Fit/Yaka/Kollu/...) و بعد از تکمیل تدریجی دیکشنری، ترجمه کاملاً
// رایگان و آنی می‌شه. نتیجه صد در صد طبیعی نیست (چون صرفاً جایگزینی کلمه‌به‌کلمه‌ست)
// ولی برای فهم سریع مشتری فارسی‌زبان کافیه.
//
// جریان کار (Lazy -- در لحظه‌ی fetch محصول):
//   ۱. چک کن این عنوان دقیق قبلاً توی TrendyolTitleCache ترجمه شده یا نه
//   ۲. اگه نه: عنوان رو به توکن‌ها (کلمه یا عبارت چندکلمه‌ای) بشکن
//   ۳. هر توکن رو با TrendyolTitleTermDictionary جایگزین کن (عبارت‌های
//      بلندتر/پرتکرارتر با priority بالاتر اول امتحان می‌شن تا با هم تداخل نکنن)
//   ۴. توکن‌های ناشناخته (برند، رنگ خاص، کلمات نایاب) دست‌نخورده می‌مونن
//   ۵. نتیجه + لیست توکن‌های ناشناخته رو کش کن (برای این‌که ادمین بعداً دیکشنری رو کامل کنه)

export type DictionaryEntry = { termTr: string; termFa: string; priority: number };

// هر بار منطق tokenizeAndTranslate عوض بشه (مثلاً همین تغییر اخیر: معکوس‌کردن
// ترتیب عبارت‌ها + حذف کامل کلمات ناشناخته)، این عدد یکی بالا می‌ره -- وگرنه
// عنوان‌هایی که با نسخه‌ی قدیمی الگوریتم از قبل کش شده بودن، تا ابد همون
// ترجمه‌ی غلط/قدیمی رو نشون می‌دن، چون findUnique همیشه cache رو برمی‌گردونه
// و هیچ‌وقت دوباره ترجمه نمی‌شه
export const TITLE_ALGO_VERSION = 10;

// عدد (با یا بدون % یا اعشار) نیازی به دیکشنری ندارد -- ترجمه‌ی خودش خودشه
// (مثلاً "50" یا "%100")؛ برای همین نه باید کلمه‌ی ناشناخته حساب بشه، نه از
// خروجی حذف بشه -- برخلاف کلمات واقعاً ناشناخته که تا اضافه‌نشدن به دیکشنری
// از عنوان ترجمه‌شده حذف می‌مونن
function isNumericToken(token: string): boolean {
  return /^%?\d+([.,]\d+)?%?$/.test(token);
}

// واحدهای اندازه‌گیریِ ترکی که همیشه بلافاصله بعدِ یه عدد میان («30 ml»، «100
// gr») -- توی tokenizeAndTranslate برای جلوگیری از جدا افتادنِ عدد از واحدش
// موقعِ معکوس‌سازیِ کلیِ segments استفاده می‌شه (نه هر کلمه‌ی بعدِ عدد، چون
// مثلاً «%100 Pamuklu» باید عمداً از هم جدا بمونه -- اونجا عدد توصیفیه، نه
// واحدِ فیزیکیِ کلمه‌ی بعدی). هر واحدِ جدیدی که همین مشکل رو داشت، اینجا اضافه بشه
const MEASUREMENT_UNIT_WORDS = new Set(["ml"]);

// دیکشنری توی حافظه کش می‌شه چون خیلی زیاد خونده می‌شه ولی به‌ندرت عوض می‌شه --
// وقتی ادمین از پنل چیزی اضافه/ویرایش کرد، invalidateTitleDictionaryCache صدا
// زده می‌شه، ولی تنها-invalidate-روی-نوشتن کافی نیست: روی Vercel هر instanceِ
// serverlessِ گرم یه کپیِ جداگانه از این متغیر توی حافظه‌ی خودش داره، پس
// invalidate روی instanceِ لحظه‌ی ذخیره فقط همون یکی رو پاک می‌کنه -- بقیه‌ی
// instanceهای گرم تا ابد (تا recycleِ خودشون) همون کپیِ کهنه رو serve می‌کنن.
// طبقِ همون الگوی exchangeRate.ts، یه TTLِ کوتاه هم اضافه شد تا حداکثر چند
// دقیقه‌ای خودش رو تازه کنه، حتی روی instanceی که invalidate بهش نرسیده
const DICTIONARY_CACHE_TTL_MS = 5 * 60 * 1000;
let dictionaryCache: DictionaryEntry[] | null = null;
let dictionaryCacheExpiresAt = 0;

export function invalidateTitleDictionaryCache() {
  dictionaryCache = null;
  dictionaryCacheExpiresAt = 0;
}

// طبقِ گزارشِ صریح («چرا ترجمه رو عوض می‌کنم همون لحظه اعمال نمی‌شه؟»): مشکلِ
// چندinstanceیِ بالا با فقط ۵ دقیقه TTL یعنی یه ادمین می‌تونست تا ۵ دقیقه بعدِ
// ذخیره، هنوز ترجمه‌ی قدیمی رو (روی یه instanceِ گرمِ دیگه) ببینه. اینجا یه
// نسخه‌ی سبک (یه ردیفِ SiteSetting با timestamp) اضافه شده که هر نوشتن
// (افزودن/ویرایش/حذف) به‌روزش می‌کنه؛ loadDictionary هر instance این نسخه رو
// (با TTLِ خیلی کوتاه‌ترِ خودش، نه رویِ کلِ دیکشنری) چک می‌کنه -- اگه فرق داشت،
// یعنی یه instanceِ دیگه چیزی عوض کرده، پس کشِ محلی رو دور می‌ریزیم. نتیجه:
// حداکثر چند ثانیه‌ای (نه چند دقیقه‌ای) روی همه‌ی instanceها اعمال می‌شه
const DICTIONARY_VERSION_KEY = "internal:trendyolDictionaryVersion";
const VERSION_CHECK_TTL_MS = 10 * 1000;
let lastKnownVersion: string | null = null;
let versionCheckedAt = 0;

export async function bumpDictionaryVersion(): Promise<void> {
  try {
    const value = String(Date.now());
    await prisma.siteSetting.upsert({
      where: { key: DICTIONARY_VERSION_KEY },
      create: { key: DICTIONARY_VERSION_KEY, value },
      update: { value },
    });
  } catch {
    // best-effort -- اگه fail بشه، حداکثر همون TTLِ ۵دقیقه‌ایِ قدیمی اعمال می‌شه
  }
}

async function dictionaryVersionChanged(): Promise<boolean> {
  if (Date.now() - versionCheckedAt < VERSION_CHECK_TTL_MS) return false;
  versionCheckedAt = Date.now();
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: DICTIONARY_VERSION_KEY } });
    const version = row?.value ?? "";
    if (version !== lastKnownVersion) {
      lastKnownVersion = version;
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// وقتی ادمین یه اصطلاح جدید به دیکشنری اضافه/ویرایش می‌کنه، این تابع همه‌ی
// ردیف‌های TrendyolTitleCache که این کلمه رو توی unknownTerms‌شون دارن پاک
// می‌کنه -- تا دفعه‌ی بعد که همون محصول دیده بشه، عنوانش از نو (این‌بار با
// دیکشنری کامل) ترجمه بشه، نه این‌که نسخه‌ی قدیمی/نصفه‌ناقص همیشه کش بمونه.
// best-effort: اگه این پاکسازی fail بشه، فقط یعنی چندتا عنوان قدیمی دیرتر
// به‌روز می‌شن -- نباید کل عملیات افزودن به دیکشنری رو بترکونه.
export async function invalidateTitleCacheForTerm(termTr: string): Promise<void> {
  if (!termTr) return;
  try {
    // چون unknownTerms یه رشته‌ی جداشده با "|" هست (نه یه فیلد رابطه‌ای قابل
    // query دقیق)، باید همه‌ی ردیف‌های غیرخالی رو بخونیم و توی جاوااسکریپت
    // فیلتر کنیم -- برای حجم معقول (چند هزار محصول کش‌شده) این کاملاً کافیه
    const candidates: { id: string; unknownTerms: string | null }[] = await prisma.trendyolTitleCache.findMany({
      where: { unknownTerms: { contains: termTr } },
      select: { id: true, unknownTerms: true },
    });
    const idsToDelete = candidates
      .filter((row: { unknownTerms: string | null }) => row.unknownTerms?.split("|").includes(termTr))
      .map((row: { id: string }) => row.id);
    if (idsToDelete.length > 0) {
      await prisma.trendyolTitleCache.deleteMany({ where: { id: { in: idsToDelete } } });
    }
  } catch (err) {
    console.error("خطا در پاکسازی کش عنوان‌های مرتبط با اصطلاح جدید:", err);
  }
}

// export شده تا endpointِ batch (check-titles) بتونه یه بار لودش کنه و برای
// چندین عنوان با هم (بدونِ چندباره خوندن از DB) با tokenizeAndTranslate استفاده کنه
export async function loadDictionary(): Promise<DictionaryEntry[]> {
  if (dictionaryCache && dictionaryCacheExpiresAt > Date.now() && !(await dictionaryVersionChanged())) {
    return dictionaryCache;
  }
  const rows: DictionaryEntry[] = await prisma.trendyolTitleTermDictionary.findMany({
    select: { termTr: true, termFa: true, priority: true },
  });
  // مرتب‌سازی نزولی بر اساس (طول عبارت، سپس priority) -- عبارت‌های چندکلمه‌ای
  // طولانی‌تر باید قبل از زیرمجموعه‌هاشون امتحان بشن (مثلاً "uzun kol" باید قبل
  // از تنهایی "kol" چک بشه، وگرنه "kol" جدا جایگزین می‌شه و باقی عبارت خراب می‌شه)
  const sorted: DictionaryEntry[] = [...rows].sort((a: DictionaryEntry, b: DictionaryEntry) => {
    const lenDiff = b.termTr.split(" ").length - a.termTr.split(" ").length;
    if (lenDiff !== 0) return lenDiff;
    return b.priority - a.priority;
  });
  dictionaryCache = sorted;
  dictionaryCacheExpiresAt = Date.now() + DICTIONARY_CACHE_TTL_MS;
  return sorted;
}

// ================= فرمول‌های اسمِ کمپین =================
// بعضی اسم‌کمپین‌های ترندیول (مثلِ "2 Ürün %30 İndirim" یا "Sepette %30
// İndirim") شاملِ عدد/درصدن و دیکشنریِ کلمه‌به‌کلمه‌ی بالا براشون مناسب نیست --
// این‌جا ادمین خودش از پنل («فرمول‌های اسمِ کمپینِ ترندیول») یه الگوی ترکی با
// placeholderهای {1},{2},... تعریف می‌کنه (هرکدوم یعنی یه عددِ دلخواه) و یه
// قالبِ فارسی با همون placeholderها -- مثلاً الگو: "{1} Ürün %{2} İndirim"،
// قالب: "خرید {1}م ٪{2} تخفیف". هیچ رجکسِ خامی از ادمین گرفته نمی‌شه، فقط این
// نحوِ ساده -- امن‌تر و برای غیرِ برنامه‌نویس هم قابل‌فهمه
export type CampaignNameFormula = { id: string; patternTr: string; templateFa: string; priority: number };

// همون مشکلِ چندinstanceیِ dictionaryCache بالا اینجا هم هست -- invalidate روی
// نوشتن فقط instanceِ همون لحظه رو تازه می‌کنه، بقیه‌ی instanceهای گرمِ
// Vercel تا مدت‌ها همون فرمولِ ذخیره‌نشده رو serve می‌کنن (باگِ گزارش‌شده:
// «ذخیره کردم ولی دفعه‌ی بعد هنوز میگه ترجمه نشده»). همون TTLِ کوتاه اینجا هم لازمه
const CAMPAIGN_FORMULA_CACHE_TTL_MS = 5 * 60 * 1000;
let campaignFormulaCache: CampaignNameFormula[] | null = null;
let campaignFormulaCacheExpiresAt = 0;

export function invalidateCampaignFormulaCache() {
  campaignFormulaCache = null;
  campaignFormulaCacheExpiresAt = 0;
}

async function loadCampaignFormulas(): Promise<CampaignNameFormula[]> {
  if (campaignFormulaCache && campaignFormulaCacheExpiresAt > Date.now()) return campaignFormulaCache;
  const rows = await prisma.trendyolCampaignNameFormula.findMany({
    select: { id: true, patternTr: true, templateFa: true, priority: true },
    orderBy: { priority: "desc" },
  });
  campaignFormulaCache = rows;
  campaignFormulaCacheExpiresAt = Date.now() + CAMPAIGN_FORMULA_CACHE_TTL_MS;
  return rows;
}

// الگوی {n} رو به یه regex تبدیل می‌کنه -- بقیه‌ی کاراکترهای خاصِ regex
// (چون متنِ الگو ممکنه %  یا . داشته باشه) escape می‌شن، فقط {n} خودش تبدیل به
// یه گروهِ عددیِ capture می‌شه
function buildFormulaRegex(patternTr: string): RegExp | null {
  const escaped = patternTr.trim().replace(/[.*+?^$()|[\]\\]/g, "\\$&");
  const withGroups = escaped.replace(/\{[0-9۰-۹]+\}/g, "(\\d+)");
  try {
    return new RegExp(`^${withGroups}$`, "i");
  } catch {
    return null;
  }
}

// اسمِ کمپین رو اول با فرمول‌های ادمین‌ساخته چک می‌کنه؛ اگه هیچ‌کدوم مچ نشد،
// از همون مترجمِ عمومیِ کلمه‌به‌کلمه استفاده می‌کنه (fallback، نه شکست).
// matchedFormula مشخص می‌کنه آیا یه فرمول واقعاً پیداش کرده یا نه -- برای اینکه
// فقط وقتی هیچ فرمولی پوششش نمی‌ده، به ادمین پیشنهادِ «تعریفِ الگو» نشون داده
// بشه. وقتی matchedFormula=true، formulaId/matchedPatternTr/matchedTemplateFa
// هم برمی‌گردن -- طبقِ درخواستِ صریح، تا ادمین بتونه همون‌جا (کنارِ خودِ بجِ
// کمپین) بدونِ رفتن به صفحه‌ی جداگانه‌ی «فرمول‌ها» سریع ویرایشش کنه
export async function translateCampaignName(text: string): Promise<{
  text: string;
  matchedFormula: boolean;
  formulaId?: string;
  matchedPatternTr?: string;
  matchedTemplateFa?: string;
}> {
  const trimmed = text.trim();
  const formulas = await loadCampaignFormulas();
  for (const f of formulas) {
    const regex = buildFormulaRegex(f.patternTr);
    if (!regex) continue;
    const match = trimmed.match(regex);
    if (!match) continue;
    // رقمِ داخلِ {n} ممکنه فارسی تایپ شده باشه (کیبورد/IME) -- مثلاً «{۲}»؛
    // toEnglishDigits قبل از Number() لازمه، وگرنه اون placeholder جایگزین
    // نمی‌شه و عیناً توی متنِ نهایی می‌مونه
    const formatted = f.templateFa.replace(/\{([0-9۰-۹]+)\}/g, (_, idxStr) => {
      const val = match[Number(toEnglishDigits(idxStr))];
      return val ? toPersianDigits(val) : "";
    });
    return {
      text: formatted,
      matchedFormula: true,
      formulaId: f.id,
      matchedPatternTr: f.patternTr,
      matchedTemplateFa: f.templateFa,
    };
  }
  return { text: await translateTrendyolAttributeText(text), matchedFormula: false };
}

// نرمال‌سازی برای lookup -- طبق درخواست صریح، حروف خاص ترکی (ç/ş/ğ/ı/ö/ü) هم
// به معادل ساده‌شون تبدیل می‌شن (foldTurkish)، چون بین "Çanta" و "Canta" نباید
// فرقی باشه -- ورودی از خودِ ترندیول همیشه با حروف درست ترکی نمی‌یاد
const turkishLowercase = foldTurkish;

// نقطه‌ی ورود عمومیِ tokenizeAndTranslate -- نه فقط برای عنوان محصول، برای *هر*
// رشته‌ی ترکی (اسم دسته‌بندی، مقدار فیلتر، عنوان گروه فیلتر، ...) که باید با
// همون یک دیکشنری مشترک (TrendyolTitleTermDictionary) ترجمه بشه. طبق تصمیم
// صریح: یه اصطلاح ترکی فقط باید *یه‌جا* ترجمه بشه و همه‌جا (عنوان محصول، اسم
// دسته‌بندی، مقدار فیلتر) از همون یک ترجمه استفاده کنن -- نه سه‌تا دیکشنری جدا
export async function translateTurkishPhrase(
  text: string,
  brand?: string | null
): Promise<{ translated: string; unknownTerms: string[] }> {
  if (!text.trim()) return { translated: text, unknownTerms: [] };
  const dictionary = await loadDictionary();
  return tokenizeAndTranslate(text, dictionary, brand);
}

// وقتی یه توکن با - یا / بین چندتا کلمه جدا شده (مثلاً "Slim-Fit" یا
// "Oversize/Regular") و کل عبارت عیناً توی دیکشنری نیست (یعنی ترجمه‌ی
// ترکیبی/یک‌جا برایش ثبت نشده)، به‌جای این‌که کل توکن ناشناخته حساب بشه، هر
// تکه رو جدا با دیکشنری چک می‌کنیم و با همون جداکننده‌ی اصلی دوباره می‌چسبونیم.
// تکه‌های واقعاً ناشناخته (نه عددی) به unknownTerms اضافه و از خروجی حذف
// می‌شن -- عین رفتار خودِ کلمه‌ی تنها در tokenizeAndTranslate
function translateCompoundToken(
  rawWord: string,
  dictionary: DictionaryEntry[],
  unknownTerms: Set<string>
): string | null {
  const rawParts = rawWord.split(/([-/])/);
  const out: string[] = [];
  for (let idx = 0; idx < rawParts.length; idx += 2) {
    const rawPart = rawParts[idx];
    if (!rawPart) continue;
    const norm = turkishLowercase(rawPart.replace(/[.,!?;:()"']/g, ""));
    const entry = dictionary.find((e) => e.termTr === norm);
    let translatedPart: string | null = null;
    if (entry) translatedPart = entry.termFa;
    else if (isNumericToken(norm)) translatedPart = norm;
    else if (norm.length > 1) unknownTerms.add(norm);

    if (translatedPart !== null) {
      if (out.length > 0) out.push(rawParts[idx - 1]); // جداکننده‌ی اصلی همین‌جا
      out.push(translatedPart);
    }
  }
  return out.length > 0 ? out.join("") : null;
}

// کلمه‌ی/عبارتِ نام برندِ همین محصول (اگه از قبل معلوم باشه) هرگز نباید توی
// دیکشنری جستجو شود یا به‌عنوانِ «ناشناخته» حذف شود -- برندها اسم خاص‌اند، نه
// اصطلاحِ مد ترکی. نرمال‌سازیش دقیقاً مثلِ خودِ کلمات عنوان (foldTurkish +
// حذف نقطه‌گذاری) تا تطبیقش قابل‌اعتماد باشه
function normalizeBrandWords(brand: string | null | undefined): string[] {
  if (!brand) return [];
  return brand
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => turkishLowercase(w.replace(/[.,!?;:()"']/g, "")));
}

// جدا و export شده که توی تست‌ها بدون DB هم بشه منطقش رو بازبینی کرد -- انتظار
// می‌ره آرگومان dictionary هم‌ترتیبِ خروجیِ loadDictionary باشه (طولان‌ترین
// عبارت‌ها اول؛ سپس priority نزولی). brand اختیاریه -- اگه داده شود، هر جا از
// عنوان که با نامِ برند (کلمه‌به‌کلمه) جفت شود، عیناً (بدون ترجمه، بدون افتادن
// توی unknownTerms) در خروجی نگه داشته می‌شود
export function tokenizeAndTranslate(
  title: string,
  dictionary: DictionaryEntry[],
  brand?: string | null
): {
  translated: string;
  unknownTerms: string[];
} {
  const rawWords = title.split(/\s+/).filter(Boolean);
  const normalizedWords = rawWords.map((w) => turkishLowercase(w.replace(/[.,!?;:()"']/g, "")));
  const brandWords = normalizeBrandWords(brand);

  // segments: عبارت‌های *ترجمه‌شده*، هرکدوم یه واحد معنایی (می‌تونه چندکلمه‌ای
  // باشه، مثلاً یه ورودی دیکشنری دوکلمه‌ای مثل "Beli Lastikli" -> "کمر کش‌دار")،
  // به ترتیب اصلی (چپ‌به‌راست ترکی) جمع می‌شن. کلمات ناشناخته اصلاً بهش اضافه
  // نمی‌شن -- طبق تصمیم صریح: فقط کلمات ترجمه‌شده نمایش داده بشن.
  const segments: string[] = [];
  const unknownTerms = new Set<string>();
  let i = 0;

  while (i < rawWords.length) {
    let matched = false;

    // اولویتِ اول: نامِ برندِ همین محصول -- قبل از هر بررسیِ دیگه، چون باید حتی
    // اگه تصادفاً با یه اصطلاحِ دیکشنری هم قاطی شد (مثلاً برندی که اسمش یه
    // کلمه‌ی رایجِ مد ترکیه‌ست)، ترجمه/ناشناخته حساب نشه. طبق تصمیمِ صریح، برند
    // اصلاً توی عنوانِ نمایشی تکرار نمی‌شود (چون همیشه جدا از عنوان -- مثلاً
    // بالای عنوان -- نشون داده می‌شود)، پس فقط از روی توکن‌ها رد می‌شیم بدون
    // این‌که به segments اضافه‌ش کنیم
    if (brandWords.length > 0) {
      const candidate = normalizedWords.slice(i, i + brandWords.length).join(" ");
      if (candidate === brandWords.join(" ")) {
        i += brandWords.length;
        continue;
      }
    }

    // اول طولانی‌ترین عبارت چندکلمه‌ای ممکن رو امتحان کن (دیکشنری از قبل بر
    // اساس طول عبارت نزولی مرتبه)
    for (const entry of dictionary) {
      const entryWordCount = entry.termTr.split(" ").length;
      if (entryWordCount === 1) continue;
      const candidate = normalizedWords.slice(i, i + entryWordCount).join(" ");
      if (candidate === entry.termTr) {
        segments.push(entry.termFa);
        i += entryWordCount;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    const normalized = normalizedWords[i];
    const singleEntry = dictionary.find((e) => e.termTr === normalized);
    if (singleEntry) {
      segments.push(singleEntry.termFa);
    } else if (isNumericToken(normalized)) {
      // یه عددِ واحدِ اندازه‌گیری («30 ml»، «100 gr») همیشه بلافاصله بعدش میاد،
      // و ترتیبِ عدد+واحد هیچ‌وقت نباید عوض بشه (فارسی هم «عدد سپس واحد» رو
      // حفظ می‌کنه، مثلاً «۳۰ میل») -- ولی معکوس‌سازیِ کلیِ segments پایین‌تر این
      // فرض رو رویِ *همه‌ی* segmentها یکسان اعمال می‌کنه و بدونِ این استثنا
      // «30 ml» رو به «میل ۳۰» تبدیل می‌کرد. توجه: این فقط برای *واحد*ها صادقه،
      // نه هر کلمه‌ی بعدِ عدد -- مثلاً «%100 Pamuklu» (ترکیبِ پارچه) عمداً باید
      // از هم جدا بمونه (تستِ موجود این رو تأیید می‌کنه)، چون اونجا عدد یه
      // درصدِ توصیفیه، نه اندازه‌ی فیزیکیِ همون کلمه‌ی بعدی
      const nextNormalized = normalizedWords[i + 1];
      if (nextNormalized && MEASUREMENT_UNIT_WORDS.has(nextNormalized)) {
        const unitEntry = dictionary.find((e) => e.termTr === nextNormalized);
        if (unitEntry) {
          segments.push(`${normalized} ${unitEntry.termFa}`);
          i += 2;
          continue;
        }
      }
      segments.push(normalized);
    } else if (/[-/]/.test(normalized)) {
      const compound = translateCompoundToken(rawWords[i], dictionary, unknownTerms);
      if (compound) segments.push(compound);
    } else if (normalized && normalized.length > 1) {
      unknownTerms.add(normalized);
    }
    i++;
  }

  // ترکی (مثل بیشتر زبان‌های سرگروه-پایانی) صفت‌ها/توصیف‌ها رو قبل از اسم اصلی
  // میاره (مثلاً «Beli Lastikli Çizgili Pamuklu Pantolon» = [کمر کش‌دار][راه‌راه]
  // [پنبه‌ای] [شلوار] -- شلوار/Pantolon همون اسم اصلیه که آخر میاد). فارسی
  // برعکسه: اسم اول، بعد توصیف‌ها. برای این تقریب، ترتیب *بلوک‌های ترجمه‌شده*
  // (نه تک‌تک حروف/کلمات داخل هر بلوک) رو معکوس می‌کنیم -- چون هر عبارت
  // چندکلمه‌ای قبلاً به‌عنوان یه segment واحد ثبت شده، با این معکوس‌سازی از هم
  // نمی‌پاشه (مثلاً "کمر کش‌دار" خودش دست‌نخورده می‌مونه، فقط جاش عوض می‌شه).
  //
  // نکته‌ی مهم برای تکمیل دیکشنری: این ترفند فقط وقتی درست کار می‌کنه که
  // عبارت‌های ترکیبی مثل "Beli Lastikli" توی TrendyolTitleTermDictionary
  // به‌عنوان یه ردیف دوکلمه‌ای (نه دو ردیف تک‌کلمه‌ای جدا) ثبت شده باشن؛ وگرنه
  // این دو کلمه هم جدا از هم معکوس می‌شن و ترتیب داخلی‌شون هم به‌هم می‌خوره.
  const reversedSegments = [...segments].reverse();

  // اگه هیچ کلمه‌ای ترجمه نشد (مثلاً عنوانی که کاملاً از اصطلاحات ناشناخته
  // تشکیل شده)، نمایش عنوان خام ترکی از خالی‌گذاشتن کامل بهتره -- این حالت
  // دست‌نخورده می‌مونه (نه از dropRepeatedPhrases رد می‌شه، که فاصله‌های خامِ
  // ورودی رو هم جمع می‌کنه)
  //
  // بعضی عنوان‌های ترندیول عمداً/سهواً یه ویژگی رو چندبار تکرار می‌کنن (مثلاً
  // «Büyük Beden» دوبار توی عنوانِ خام، یا دوتا توکنِ متفاوت که هردو به همون
  // عبارت ترجمه می‌شن) -- طبقِ درخواستِ صریح، هرجای عنوان که یه کلمه/عبارتِ
  // تکراری پیدا بشه، فقط بارِ اولش نگه داشته می‌شه. عمداً روی *رشته‌ی نهاییِ
  // چسبیده* (نه فقط segmentهای جدا) اعمال می‌شه، چون تکرار می‌تونه از دو
  // segmentِ متفاوت (نه فقط دو segmentِ کاملاً یکسان) پدید بیاد -- مثلاً یه
  // segmentِ دوکلمه‌ایِ «سایز بزرگ» جایی، و دو segmentِ تک‌کلمه‌ایِ «سایز»+«بزرگ»
  // جدا جایی دیگه، که به‌عنوانِ آرایه با هم برابر نیستن ولی توی متنِ نهایی
  // همون رشته رو می‌سازن
  const translated = toPersianDigits(
    reversedSegments.length > 0 ? dropRepeatedPhrases(reversedSegments.join(" ")) : title
  );

  return { translated, unknownTerms: Array.from(unknownTerms) };
}

// حذفِ کلمه/عبارتِ تکراری از هر جای متن -- طولانی‌ترین دنباله‌های ممکن رو اول
// چک می‌کنه (تا مثلاً یه عبارتِ دوکلمه‌ای به‌جای دوتا کلمه‌ی تک‌تکِ جدا حذف
// بشه)، فقط تکرارهای *غیرِهم‌پوشان* (نه خودِ همون رخداد) رو حذف می‌کنه، و
// همیشه رخدادِ اول رو نگه می‌داره
function dropRepeatedPhrases(text: string): string {
  const words = text.split(/\s+/).filter(Boolean);
  const drop = new Set<number>();
  const maxLen = Math.floor(words.length / 2);
  for (let len = maxLen; len >= 1; len--) {
    const firstSeenAt = new Map<string, number>();
    for (let i = 0; i + len <= words.length; i++) {
      let overlapsDrop = false;
      for (let k = 0; k < len; k++) {
        if (drop.has(i + k)) {
          overlapsDrop = true;
          break;
        }
      }
      if (overlapsDrop) continue;
      const phrase = words.slice(i, i + len).join(" ");
      const firstStart = firstSeenAt.get(phrase);
      if (firstStart === undefined) {
        firstSeenAt.set(phrase, i);
      } else if (i >= firstStart + len) {
        for (let k = 0; k < len; k++) drop.add(i + k);
      }
    }
  }
  return words.filter((_, i) => !drop.has(i)).join(" ");
}

// حتی بعدِ معکوس‌سازیِ segmentها، بعضی عنوان‌های ترکی (وقتی مثلاً آخرین
// کلمه‌شون یه جزئیاتِ فرعی مثل «۳'lü Paket» باشه، نه اسمِ اصلی) هنوز با
// موضوعِ اصلیِ محصول شروع نمی‌شن. چون dataLayerِ خودِ ترندیول یه دسته‌بندیِ
// جدا و همیشه‌قابل‌اعتماد داره (که جدا هم ترجمه می‌شه، برای categoryName روی
// صفحه)، اونو با اطمینانِ کامل اولِ عنوان می‌ذاریم -- مگه اینکه عنوان از قبل
// همون عبارت رو *هرجا* (نه فقط اولش) داشته باشه. چرا هرجا نه فقط اول: چون
// معکوس‌سازیِ segmentها می‌تونه اسمِ اصلیِ محصول (که معمولاً همون دسته‌بندیه)
// رو وسطِ عنوان بندازه، نه لزوماً اولش (مثلاً «سایز بزرگ کیف لوازم آرایش
// طرح‌دار...» -- اسمِ اصلی وسطه، نه اول)؛ چک‌کردنِ فقط چندکلمه‌ی اول این حالت
// رو تشخیص نمی‌داد و «کیف لوازم آرایش» دوبار توی عنوان تکرار می‌شد.
//
// یه حالتِ سخت‌تر هم هست: دسته‌بندی به‌صورتِ عبارتِ *پیوسته* (مثلاً «پیراهن
// سایز بزرگ») توی عنوان نیست، ولی کلماتش جدا از هم (با یه کلمه‌ی دیگه فاصله،
// مثلاً «پیراهن مجلسی سایز بزرگ») هستن -- چکِ includes بالا این رو تشخیص
// نمی‌ده و بازم عبارتِ کامل رو دوباره اول می‌ذاره. برای همین بعد از چسبوندن،
// نتیجه رو یه‌بار از dropRepeatedPhrases رد می‌کنیم تا اگه کلماتِ دسته‌بندی
// (حالا که اولِ عنوانن) با همون کلماتِ پراکنده‌ی وسطِ عنوان یکی شدن، تکرار حذف بشه
export function withCategoryPrefix(
  translatedTitle: string,
  categoryName?: string | null,
  originalTitle?: string | null
): string {
  const cat = categoryName?.trim();
  if (!cat) return translatedTitle;
  // اگه هیچ کلمه‌ای از عنوان ترجمه نشده (یعنی tokenizeAndTranslate به‌خاطرِ
  // نبودِ حتی یه اصطلاحِ آشنا، دقیقاً همون عنوانِ خام رو برگردونده)، چسبوندنِ
  // پیشوندِ فارسیِ دسته‌بندی به یه متنِ کاملاً خارجی یه ترکیبِ نصفه‌نیمه/بدریخت
  // می‌سازه (مثلاً «شلوار پیژامه PYJAMAS KNIT BOTTOMS») -- به‌جاش فقط همون
  // دسته‌بندیِ فارسی (که همیشه واقعاً ترجمه‌شده، چون از دیتای ساختاریافته‌ی
  // خودِ ترندیول میاد نه دیکشنری) به‌تنهایی نشون داده می‌شه
  if (originalTitle != null && translatedTitle === originalTitle) return cat;
  // قبلاً اگه categoryName هرجای عنوان (نه لزوماً اولش) بود، دست‌نخورده برمی‌گشت --
  // ولی خودِ اسمِ محصول (دسته‌بندی) باید همیشه اول بیاد، نه هرجایی که کلمه‌به‌کلمه
  // افتاده. برای همین همیشه به‌جلو prepend می‌کنیم و با dropRepeatedPhrases
  // کپیِ قدیمی‌ای که وسط/آخرِ عنوان مونده حذف می‌شه (چون phrase تکراری‌ست)
  if (translatedTitle.startsWith(cat)) return translatedTitle;
  return dropRepeatedPhrases(`${cat} ${translatedTitle}`);
}

// نقطه‌ی ورود اصلی -- کش را چک می‌کند، و در صورت نبود، ترجمه می‌کند و ذخیره می‌کند.
// brand (اگه معلوم باشه) از تجزیه/حذف‌شدن به‌عنوان کلمه‌ی ناشناخته مستثنی می‌شود
export async function translateTrendyolTitle(originalTitle: string, brand?: string | null): Promise<string> {
  if (!originalTitle) return originalTitle;

  const cached = await prisma.trendyolTitleCache.findUnique({
    where: { originalTitle },
    select: { translatedTitle: true, algorithmVersion: true },
  });
  if (cached && cached.algorithmVersion === TITLE_ALGO_VERSION) return cached.translatedTitle;

  const dictionary = await loadDictionary();
  const { translated, unknownTerms } = tokenizeAndTranslate(originalTitle, dictionary, brand);

  // ذخیره‌ی نتیجه در کش -- best-effort، اگه ذخیره خطا داد نباید کل ترجمه رو بترکونه
  try {
    await prisma.trendyolTitleCache.upsert({
      where: { originalTitle },
      create: {
        originalTitle,
        translatedTitle: translated,
        unknownTerms: unknownTerms.length > 0 ? unknownTerms.join("|") : null,
        algorithmVersion: TITLE_ALGO_VERSION,
      },
      update: {
        translatedTitle: translated,
        unknownTerms: unknownTerms.length > 0 ? unknownTerms.join("|") : null,
        algorithmVersion: TITLE_ALGO_VERSION,
      },
    });
  } catch (err) {
    console.error("خطا در ذخیره‌ی کش ترجمه‌ی عنوان ترندیول:", err);
  }

  return translated;
}

// برای batch fetch (لیست محصولات) -- قبلاً برای هر عنوانِ یکتا یه findUnique
// جدا (و گاهی upsert جدا) می‌زد؛ یه صفحه‌ی گریدِ ۲۴-۴۸ تایی یعنی همون تعداد
// رفت‌وبرگشتِ جداگانه به DB. الان دقیقاً همون بهینه‌سازیِ check-title اینجا هم
// اعمال شده: یه findMany برای همه‌ی عنوان‌های یکتا (به‌جای N تا findUnique)،
// و بعد فقط برای عنوان‌هایی که واقعاً کش نداشتن/الگوریتمشون کهنه بود
// (معمولاً بعدِ گرم‌شدنِ کش، صفر یا خیلی کمه) دیکشنری یه‌بار لود و upsertها
// توی یه تراکنشِ واحد اجرا می‌شن
export async function translateTrendyolTitles(
  items: { title: string; brand?: string | null }[]
): Promise<Map<string, string>> {
  const uniqueByTitle = new Map<string, string | null | undefined>();
  for (const item of items) {
    if (item.title && !uniqueByTitle.has(item.title)) uniqueByTitle.set(item.title, item.brand);
  }
  const titles = Array.from(uniqueByTitle.keys());
  if (titles.length === 0) return new Map();

  const cachedRows = await prisma.trendyolTitleCache.findMany({
    where: { originalTitle: { in: titles } },
    select: { originalTitle: true, translatedTitle: true, algorithmVersion: true },
  });
  const cachedByTitle = new Map(cachedRows.map((r) => [r.originalTitle, r]));

  const results = new Map<string, string>();
  const toUpsert: { originalTitle: string; translatedTitle: string; unknownTerms: string | null }[] = [];
  let dictionary: DictionaryEntry[] | null = null;

  for (const title of titles) {
    const cached = cachedByTitle.get(title);
    if (cached && cached.algorithmVersion === TITLE_ALGO_VERSION) {
      results.set(title, cached.translatedTitle);
      continue;
    }
    dictionary ??= await loadDictionary();
    const { translated, unknownTerms } = tokenizeAndTranslate(title, dictionary, uniqueByTitle.get(title));
    results.set(title, translated);
    toUpsert.push({
      originalTitle: title,
      translatedTitle: translated,
      unknownTerms: unknownTerms.length > 0 ? unknownTerms.join("|") : null,
    });
  }

  // ذخیره‌ی نتیجه‌ها در کش -- best-effort، اگه ذخیره خطا داد نباید کل ترجمه رو
  // بترکونه. توی یه تراکنشِ واحد (نه N تا await جدا) که رفت‌وبرگشتِ کمتری داشته باشه
  if (toUpsert.length > 0) {
    try {
      await prisma.$transaction(
        toUpsert.map((row) =>
          prisma.trendyolTitleCache.upsert({
            where: { originalTitle: row.originalTitle },
            create: {
              originalTitle: row.originalTitle,
              translatedTitle: row.translatedTitle,
              unknownTerms: row.unknownTerms,
              algorithmVersion: TITLE_ALGO_VERSION,
            },
            update: {
              translatedTitle: row.translatedTitle,
              unknownTerms: row.unknownTerms,
              algorithmVersion: TITLE_ALGO_VERSION,
            },
          })
        )
      );
    } catch (err) {
      console.error("خطا در ذخیره‌ی کشِ ترجمه‌ی عنوان‌های ترندیول:", err);
    }
  }

  // چکِ کلماتِ ناشناخته‌ی پرتکرار: کلِ ردیف‌های کشِ عنوان رو می‌خونه (جدولی که با
  // هر عنوانِ تازه بزرگ‌تر می‌شه)، پس فقط وقتی عنوانِ *تازه‌ای* ترجمه شده و حداکثر
  // ساعتی یه‌بار به‌ازای هر instance -- اعلانش به‌هرحال ۲۴ساعته dedupe می‌شه
  if (toUpsert.length > 0 && Date.now() - lastUnknownTermsCheckAt > UNKNOWN_TERMS_CHECK_INTERVAL_MS) {
    lastUnknownTermsCheckAt = Date.now();
    checkUnknownTermsThreshold().catch((err) => {
      console.error("خطا در بررسی کلمات ناشناخته‌ی پرتکرار:", err);
    });
  }

  return results;
}

const UNKNOWN_TERMS_CHECK_INTERVAL_MS = 60 * 60 * 1000;
let lastUnknownTermsCheckAt = 0;

// حداقل تعداد تکرار یه کلمه‌ی ناشناخته توی عنوان‌های کش‌شده تا لازم بشه به
// ادمین اعلان بدیم -- عدد پایین چون هرچی زودتر اضافه بشه به دیکشنری، عنوان‌های
// بیشتری کامل فارسی می‌شن
const UNKNOWN_TERM_ALERT_THRESHOLD = 5;

async function checkUnknownTermsThreshold() {
  const rows = await prisma.trendyolTitleCache.findMany({
    where: { unknownTerms: { not: null } },
    select: { unknownTerms: true },
  });

  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.unknownTerms) continue;
    for (const term of row.unknownTerms.split("|")) {
      if (!term) continue;
      counts.set(term, (counts.get(term) ?? 0) + 1);
    }
  }

  const frequent = Array.from(counts.entries())
    .filter(([, count]) => count >= UNKNOWN_TERM_ALERT_THRESHOLD)
    .sort((a, b) => b[1] - a[1]);

  if (frequent.length === 0) return;

  const topList = frequent
    .slice(0, 8)
    .map(([term, count]) => `${term} (×${count})`)
    .join("، ");

  await notifyAdminsOnce(
    "⚠️ کلمات ناشناخته‌ی پرتکرار در عنوان محصولات ترندیول",
    `⚠️ کلمات ناشناخته‌ی پرتکرار در عنوان محصولات ترندیول: ${topList}. این کلمات رو به دیکشنری اضافه کن تا عنوان‌های بیشتری کامل فارسی بشن.`,
    "/admin/trendyol-title-dictionary"
  );
}

// ============================================================================
// ترجمه‌ی نام/مقدار ویژگی محصول (مثلاً "Kumaş" یا "%100 Pamuk")
// ============================================================================
// عمداً از tokenizeAndTranslate (مخصوص عنوان کامل) استفاده نمی‌کنه، چون اون
// تابع برای عنوان طراحی شده، نه یه عبارت کوتاه ۱ تا ۳ کلمه‌ای:
//   ۱. tokenizeAndTranslate ترتیب بلوک‌های ترجمه‌شده رو معکوس می‌کنه (فرض
//      «صفت قبل از اسم» ترکی) -- برای یه مقدار ویژگی کوتاه این فرض بی‌معنیه
//      و می‌تونه ترتیب رو اشتباه بر عکس کنه.
//   ۲. tokenizeAndTranslate کلمات ناشناخته رو کامل حذف می‌کنه (برای عنوان
//      طولانی بی‌ضرره) -- ولی برای مقدار ویژگی مثل "%100 Pamuk" یعنی «%100»
//      (که عددیه، توی دیکشنری نیست) گم می‌شه و فقط "پنبه" می‌مونه؛ اطلاعات
//      واقعی محصول از دست می‌ره.
// این تابع همون دیکشنری رو (loadDictionary) به اشتراک می‌ذاره ولی: ترتیب رو
// دست‌نخورده نگه می‌داره و کلمه‌ی ناشناخته رو به‌جای حذف، عیناً (با املای اصلی)
// برمی‌گردونه. کش هم نداره -- عبارت‌ها کوتاهن، دوباره‌محاسبه‌شون ارزون‌تر از
// قاطی‌کردن با کش/نسخه‌بندی عنوان‌های کامله (TITLE_ALGO_VERSION)
// «X Tipi»/«X Türü» (نوعِ X)، «X Detaylı»/«X Detayı» (جزئیاتِ X)، «X Materyali»
// (جنسِ X) -- همه یه الگوی مشترکِ دستوریِ ترکی دارن (اضافه‌ی ملکی: «X'in Y'si» =
// «Y ـِ X»)، که توش کلمه‌ی مشخص‌کننده (Tipi/Türü/Detaylı/Materyali) همیشه بعد
// از اسمِ اصلی (X) میاد، ولی فارسی برعکسه. ترجمه‌ی کلمه‌به‌کلمه‌ی این تابع (که
// عمداً ترتیب رو حفظ می‌کنه، برخلافِ tokenizeAndTranslate) بدونِ این استثنا،
// «X نوع»/«X جزئیات»/«X جنس» غلط تولید می‌کرد. هر کلمه‌ی ترکیِ دیگه‌ای که همین
// الگوی اضافه‌ی ملکی رو داشت، به همین Set اضافه بشه
const REVERSED_SUFFIX_WORDS = new Set([
  "tipi",
  "turu",
  "detayli",
  "detayi",
  "materyali",
  "suresi",
  "cesidi",
  "uzunlugu",
]);

export async function translateTrendyolAttributeText(text: string): Promise<string> {
  if (!text) return text;

  const dictionary = await loadDictionary();
  const rawWords = text.split(/\s+/).filter(Boolean);
  const normalizedWords = rawWords.map((w) => turkishLowercase(w.replace(/[.,!?;:()"']/g, "")));

  const output: string[] = [];
  let i = 0;
  while (i < rawWords.length) {
    let matched = false;

    for (const entry of dictionary) {
      const entryWordCount = entry.termTr.split(" ").length;
      if (entryWordCount === 1) continue;
      const candidate = normalizedWords.slice(i, i + entryWordCount).join(" ");
      if (candidate === entry.termTr) {
        output.push(entry.termFa);
        i += entryWordCount;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    const normalized = normalizedWords[i];

    // اگه یه ردیفِ دقیق‌ترِ دوکلمه‌ای (مثلِ «sanayi tipi fan» -> «پنکه صنعتی»)
    // توی حلقه‌ی بالا این ترکیب رو نگرفته باشه، این fallbackِ عمومی جای X و
    // tipi/türü/detaylı/detayı رو برای *هر* X ممکن عوض می‌کنه -- به‌جای این‌که
    // برای هر ترکیبِ خاصی مجبور باشیم توی دیکشنری یه ردیفِ جداگانه دستی اضافه کنیم
    if (i + 1 < rawWords.length && REVERSED_SUFFIX_WORDS.has(normalizedWords[i + 1])) {
      const suffixEntry = dictionary.find((e) => e.termTr === normalizedWords[i + 1]);
      const currentEntry = dictionary.find((e) => e.termTr === normalized);
      output.push(
        suffixEntry ? suffixEntry.termFa : rawWords[i + 1],
        currentEntry ? currentEntry.termFa : rawWords[i]
      );
      i += 2;
      continue;
    }

    const singleEntry = dictionary.find((e) => e.termTr === normalized);
    if (singleEntry) {
      output.push(singleEntry.termFa);
    } else if (/[-/]/.test(normalized)) {
      // برخلاف tokenizeAndTranslate، این‌جا هیچ‌وقت اطلاعات دور ریخته نمی‌شه --
      // تکه‌های ناشناخته با املای اصلی خودشون (نه حذف) توی خروجی می‌مونن
      output.push(translateCompoundAttributeToken(rawWords[i], dictionary));
    } else {
      output.push(rawWords[i]);
    }
    i++;
  }

  // بعضی مقادیرِ ویژگی (مثلِ «دستورِ شست‌وشو») به‌جای متن، یه URLِ عکسِ آیکون
  // خامِ ترندیول هستن (مثلاً .../ty375/.../do_not_wash.jpg) -- toPersianDigits
  // اگه بدونِ حفاظت رو کلِ رشته اجرا بشه، ارقامِ داخلِ خودِ URL رو هم فارسی
  // می‌کنه (ty375 -> tyِ۳۷۵) و لینکِ عکس رو می‌شکنه. اینجا فقط بخش‌های غیرِ URL
  // رقم‌هاشون فارسی می‌شن، خودِ URL دست‌نخورده می‌مونه
  return output
    .join(" ")
    .split(/(https?:\/\/\S+)/)
    .map((part) => (/^https?:\/\//.test(part) ? part : toPersianDigits(part)))
    .join("");
}

function translateCompoundAttributeToken(rawWord: string, dictionary: DictionaryEntry[]): string {
  return rawWord
    .split(/([-/])/)
    .map((part, idx) => {
      if (idx % 2 === 1) return part; // خودِ جداکننده
      const norm = turkishLowercase(part.replace(/[.,!?;:()"']/g, ""));
      const entry = dictionary.find((e) => e.termTr === norm);
      return entry ? entry.termFa : part;
    })
    .join("");
}

// ============================================================================
// ترجمه‌ی معکوس -- عبارت جستجوی فارسی کاربر رو به ترکی برمی‌گردونه
// ============================================================================
// همون دیکشنری TrendyolTitleTermDictionary رو برعکس می‌خونیم (فارسی -> ترکی).
// چون ممکنه چند اصطلاح ترکی به یه فارسی یکسان ترجمه شده باشن (مثلاً "Bol" و
// "Gevşek" هر دو "گشاد")، برای هر عبارت فارسی، اولین موردی که موقع ساخت
// دیکشنری معکوس دیده می‌شه (بعد از مرتب‌سازی بر اساس طول عبارت و priority) نگه
// داشته می‌شه -- یعنی محافظه‌کارانه و best-effort، نه دقیق صد در صد.
type ReverseDictionaryEntry = { termFa: string; termTr: string };

let reverseDictionaryCache: ReverseDictionaryEntry[] | null = null;

export function invalidateSearchQueryDictionaryCache() {
  reverseDictionaryCache = null;
}

async function loadReverseDictionary(): Promise<ReverseDictionaryEntry[]> {
  if (reverseDictionaryCache) return reverseDictionaryCache;
  const dictionary = await loadDictionary(); // همون کش/مرتب‌سازی فوروارد رو دوباره استفاده می‌کنه

  const seenFa = new Set<string>();
  const reversed: ReverseDictionaryEntry[] = [];
  for (const entry of dictionary) {
    const faKey = normalizePersianForSearch(entry.termFa);
    if (!faKey || seenFa.has(faKey)) continue; // اولین (بلندترین/بالاترین‌priority) رو نگه دار
    seenFa.add(faKey);
    reversed.push({ termFa: faKey, termTr: entry.termTr });
  }
  // طولانی‌ترین عبارت فارسی اول امتحان بشه -- عین منطق فوروارد
  reversed.sort((a, b) => b.termFa.split(" ").length - a.termFa.split(" ").length);
  reverseDictionaryCache = reversed;
  return reversed;
}

// نرمال‌سازی فارسی برای جستجوی دیکشنری -- از normalizeSlug (ي/ك عربی -> ی/ک
// فارسی) استفاده می‌کنه، به‌علاوه‌ی حذف نیم‌فاصله (چون کاربر ممکنه "بی‌آستین"
// یا "بی آستین" یا "بی‌ آستین" تایپ کنه و همه باید یکی در نظر گرفته بشن)
function normalizePersianForSearch(text: string): string {
  return normalizeSlug(text)
    .replace(/\u200c/g, " ") // نیم‌فاصله -> فاصله‌ی معمولی
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("fa-IR");
}

// اگه یه کلمه‌ی فارسی دقیقاً توی دیکشنری نبود (غلط تایپی، جمع/مفرد، ...)،
// نزدیک‌ترین معادل تک‌کلمه‌ای رو (بر اساس فاصله‌ی ویرایشی) پیدا می‌کنه --
// همون آستانه‌ی fuzzyWordMatch (کلمه‌ی ≤۴ حرفی: حداکثر ۱ خطا، بلندتر: حداکثر ۲
// خطا). عبارت‌های چندکلمه‌ای دیکشنری این‌جا در نظر گرفته نمی‌شن، چون تطبیق فازیِ
// عبارت (نه تک‌کلمه) پیچیدگی و ریسک تطبیق غلط رو زیاد می‌کنه
function nearestSingleWordMatch(word: string, dictionary: ReverseDictionaryEntry[]): string | null {
  if (word.length < 2) return null;
  let best: { termTr: string; dist: number } | null = null;
  for (const entry of dictionary) {
    if (entry.termFa.includes(" ")) continue;
    const dist = levenshtein(word, entry.termFa);
    if (!best || dist < best.dist) best = { termTr: entry.termTr, dist };
  }
  if (!best) return null;
  const threshold = word.length <= 4 ? 1 : 2;
  return best.dist <= threshold ? best.termTr : null;
}

/**
 * عبارت جستجوی فارسی کاربر رو با دیکشنری term-by-term به ترکی ترجمه می‌کنه.
 * اول تطبیق دقیق (طولانی‌ترین عبارت اول)، بعد برای کلمات پیدانشده، نزدیک‌ترین
 * معادل تک‌کلمه‌ای (تحمل غلط تایپی). کلمه‌ای که حتی نزدیک‌ترین معادلش هم پیدا
 * نشه، کلاً از خروجی حذف می‌شه -- نگه‌داشتنش با همون رسم‌الخط فارسی فایده‌ای
 * ندارد، چون جست‌وجوی ترندیول فقط ترکی/لاتین می‌فهمد و یه کلمه‌ی فارسی وسط
 * query فقط نتیجه رو خراب می‌کند.
 */
export async function translateSearchQueryToTurkish(
  faQuery: string
): Promise<{ translated: string; droppedWords: string[] }> {
  const normalized = normalizePersianForSearch(faQuery);
  if (!normalized) return { translated: faQuery, droppedWords: [] };

  const dictionary = await loadReverseDictionary();
  const words = normalized.split(" ").filter(Boolean);

  const result: string[] = [];
  // کلماتی که حتی نزدیک‌ترین معادلشون هم پیدا نشد و کلاً از عبارت حذف شدن --
  // برای اینکه هرجا صدا زده می‌شه (مثلاً ابزارِ ادمینِ پوستر) بشه به کاربر
  // نشون داد «این کلمه رو نفهمیدم، جستجو بدونِ اون انجام شد»، نه اینکه بی‌صدا
  // معنیِ کل عبارت عوض بشه (مثلاً «شومیز سبز» فقط به «سبز» تبدیل بشه)
  const droppedWords: string[] = [];
  let i = 0;
  while (i < words.length) {
    let matched = false;
    for (const entry of dictionary) {
      const entryWordCount = entry.termFa.split(" ").length;
      const candidate = words.slice(i, i + entryWordCount).join(" ");
      if (candidate === entry.termFa) {
        result.push(entry.termTr);
        i += entryWordCount;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    const nearestTr = nearestSingleWordMatch(words[i], dictionary);
    if (nearestTr) {
      result.push(nearestTr);
    } else {
      droppedWords.push(words[i]);
    }
    i++;
  }

  // اگه حتی یه کلمه هم (نه دقیق، نه نزدیک‌ترین) ترجمه نشد، بهتره عبارت اصلی
  // فارسی رو برگردونیم تا این‌که یه q= کاملاً خالی بسازیم (که یعنی «همه‌ی
  // محصولات»، نه نتیجه‌ی این جست‌وجوی خاص)
  return result.length > 0
    ? { translated: result.join(" "), droppedWords }
    : { translated: faQuery, droppedWords };
}

