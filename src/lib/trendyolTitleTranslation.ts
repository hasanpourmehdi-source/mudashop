import { prisma } from "@/lib/prisma";
import { notifyAdminsOnce } from "@/lib/adminAlerts";
import { normalizeSlug } from "@/lib/slug";
import { foldTurkish, toPersianDigits } from "@/lib/turkishText";
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

type DictionaryEntry = { termTr: string; termFa: string; priority: number };

// هر بار منطق tokenizeAndTranslate عوض بشه (مثلاً همین تغییر اخیر: معکوس‌کردن
// ترتیب عبارت‌ها + حذف کامل کلمات ناشناخته)، این عدد یکی بالا می‌ره -- وگرنه
// عنوان‌هایی که با نسخه‌ی قدیمی الگوریتم از قبل کش شده بودن، تا ابد همون
// ترجمه‌ی غلط/قدیمی رو نشون می‌دن، چون findUnique همیشه cache رو برمی‌گردونه
// و هیچ‌وقت دوباره ترجمه نمی‌شه
export const TITLE_ALGO_VERSION = 5;

// عدد (با یا بدون % یا اعشار) نیازی به دیکشنری ندارد -- ترجمه‌ی خودش خودشه
// (مثلاً "50" یا "%100")؛ برای همین نه باید کلمه‌ی ناشناخته حساب بشه، نه از
// خروجی حذف بشه -- برخلاف کلمات واقعاً ناشناخته که تا اضافه‌نشدن به دیکشنری
// از عنوان ترجمه‌شده حذف می‌مونن
function isNumericToken(token: string): boolean {
  return /^%?\d+([.,]\d+)?%?$/.test(token);
}

// دیکشنری توی حافظه کش می‌شه (در طول عمر پروسه) چون خیلی زیاد خونده می‌شه ولی
// به‌ندرت عوض می‌شه -- وقتی ادمین از پنل چیزی اضافه/ویرایش کرد، invalidateDictionaryCache را صدا بزن
let dictionaryCache: DictionaryEntry[] | null = null;

export function invalidateTitleDictionaryCache() {
  dictionaryCache = null;
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

async function loadDictionary(): Promise<DictionaryEntry[]> {
  if (dictionaryCache) return dictionaryCache;
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
  return sorted;
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
  text: string
): Promise<{ translated: string; unknownTerms: string[] }> {
  if (!text.trim()) return { translated: text, unknownTerms: [] };
  const dictionary = await loadDictionary();
  return tokenizeAndTranslate(text, dictionary);
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

function tokenizeAndTranslate(title: string, dictionary: DictionaryEntry[]): {
  translated: string;
  unknownTerms: string[];
} {
  const rawWords = title.split(/\s+/).filter(Boolean);
  const normalizedWords = rawWords.map((w) => turkishLowercase(w.replace(/[.,!?;:()"']/g, "")));

  // segments: عبارت‌های *ترجمه‌شده*، هرکدوم یه واحد معنایی (می‌تونه چندکلمه‌ای
  // باشه، مثلاً یه ورودی دیکشنری دوکلمه‌ای مثل "Beli Lastikli" -> "کمر کش‌دار")،
  // به ترتیب اصلی (چپ‌به‌راست ترکی) جمع می‌شن. کلمات ناشناخته اصلاً بهش اضافه
  // نمی‌شن -- طبق تصمیم صریح: فقط کلمات ترجمه‌شده نمایش داده بشن.
  const segments: string[] = [];
  const unknownTerms = new Set<string>();
  let i = 0;

  while (i < rawWords.length) {
    let matched = false;

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
  // تشکیل شده)، نمایش عنوان خام ترکی از خالی‌گذاشتن کامل بهتره
  const translated = toPersianDigits(reversedSegments.length > 0 ? reversedSegments.join(" ") : title);

  return { translated, unknownTerms: Array.from(unknownTerms) };
}

// نقطه‌ی ورود اصلی -- کش را چک می‌کند، و در صورت نبود، ترجمه می‌کند و ذخیره می‌کند
export async function translateTrendyolTitle(originalTitle: string): Promise<string> {
  if (!originalTitle) return originalTitle;

  const cached = await prisma.trendyolTitleCache.findUnique({
    where: { originalTitle },
    select: { translatedTitle: true, algorithmVersion: true },
  });
  if (cached && cached.algorithmVersion === TITLE_ALGO_VERSION) return cached.translatedTitle;

  const dictionary = await loadDictionary();
  const { translated, unknownTerms } = tokenizeAndTranslate(originalTitle, dictionary);

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

// برای batch fetch (لیست محصولات) -- همه رو موازی ترجمه می‌کند به‌جای یکی‌یکی
export async function translateTrendyolTitles(titles: string[]): Promise<Map<string, string>> {
  const uniqueTitles = Array.from(new Set(titles.filter(Boolean)));
  const results = await Promise.all(
    uniqueTitles.map(async (title) => [title, await translateTrendyolTitle(title)] as const)
  );

  // بعد از هر batch، یه چک سبک برای کلمات ناشناخته‌ی پرتکرار -- notifyAdminsOnce
  // خودش dedupe می‌کنه (۲۴ ساعته) پس صدا زدنش هر بار مشکلی نداره
  checkUnknownTermsThreshold().catch((err) => {
    console.error("خطا در بررسی کلمات ناشناخته‌ی پرتکرار:", err);
  });

  return new Map(results);
}

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

  return toPersianDigits(output.join(" "));
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
export async function translateSearchQueryToTurkish(faQuery: string): Promise<string> {
  const normalized = normalizePersianForSearch(faQuery);
  if (!normalized) return faQuery;

  const dictionary = await loadReverseDictionary();
  const words = normalized.split(" ").filter(Boolean);

  const result: string[] = [];
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
    if (nearestTr) result.push(nearestTr);
    i++;
  }

  // اگه حتی یه کلمه هم (نه دقیق، نه نزدیک‌ترین) ترجمه نشد، بهتره عبارت اصلی
  // فارسی رو برگردونیم تا این‌که یه q= کاملاً خالی بسازیم (که یعنی «همه‌ی
  // محصولات»، نه نتیجه‌ی این جست‌وجوی خاص)
  return result.length > 0 ? result.join(" ") : faQuery;
}

