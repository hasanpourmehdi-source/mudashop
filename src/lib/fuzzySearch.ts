// فاصله ویرایشی (Levenshtein) بین دو رشته کوتاه - برای تحمل غلط تایپی در جست‌وجو
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

// یکسان‌سازی نویسه‌های عربی/فارسی که کاربرها و منابع مختلف به‌جای هم تایپ می‌کنن
// (ي عربی <-> ی فارسی، ك عربی <-> ک فارسی)، حذف اعراب (فتحه/ضمه/کسره/تشدید/...)،
// و یکی‌کردن نیم‌فاصله/فاصله‌های تکراری -- بدون این، جست‌وجوی «کیف» با ورودی‌ای
// که از یه صفحه‌کلید عربی یا کیبورد آیفون با ي/ك عربی تایپ شده هیچ‌وقت مچ نمی‌شد
export function normalizePersian(text: string): string {
  return text
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ً-ٰٟ]/g, "")
    .replace(/[‌\s]+/g, " ")
    .trim()
    .toLowerCase();
}

// آیا کلمه‌ی جست‌وجو (query) با یکی از کلمات متن هدف (haystack) به‌اندازه کافی
// نزدیکه؟ هم substring رو قبول می‌کنه، هم فاصله ویرایشی کوچیک (غلط تایپی) رو
export function fuzzyWordMatch(queryWord: string, haystackWords: string[]): boolean {
  if (queryWord.length < 2) {
    return haystackWords.some((w) => w.startsWith(queryWord));
  }

  return haystackWords.some((word) => {
    if (word.includes(queryWord)) return true;
    // آستانه از رو کوتاه‌ترینِ دو کلمه حساب می‌شه، نه فقط طولِ کوئری -- وگرنه
    // یه کوئریِ بلند (مثلاً «قابلمه»، ۶ حرف) با ۲ خطای مجاز می‌تونست به یه
    // کلمه‌ی کوتاه‌تر و کاملاً بی‌ربط (مثلاً «قابل»، ۴ حرف، فاصله‌ی واقعی=۲)
    // برسه. با کوتاه‌ترین طول، این‌جور تطبیق‌های نادرست رد می‌شن
    const shorterLen = Math.min(queryWord.length, word.length);
    const threshold = shorterLen <= 4 ? 1 : 2;
    return levenshtein(queryWord, word) <= threshold;
  });
}

// چک می‌کنه همه کلمات query (با فاصله جدا شده) تو متن هدف پیدا بشن (فازی)
export function fuzzyTextMatch(query: string, targetText: string): boolean {
  const queryWords = normalizePersian(query).split(/\s+/).filter(Boolean);
  const targetWords = normalizePersian(targetText).split(/\s+/).filter(Boolean);
  if (queryWords.length === 0) return true;
  return queryWords.every((qw) => fuzzyWordMatch(qw, targetWords));
}

export type WeightedField = { text: string | null | undefined; weight: number };

// امتیاز ربط یک محصول به عبارت جست‌وجو -- برای رتبه‌بندی نتایج، نه فقط فیلتر
// دودویی. هر کلمه‌ی کوئری باید حداقل توی یکی از فیلدها (فازی) پیدا بشه، وگرنه
// کل محصول رد می‌شه (صفر) -- دقیقاً همون منطق fuzzyTextMatch. ولی وقتی پیدا
// می‌شه، نوعِ تطابق (دقیق > ابتدای کلمه > دربرگیرنده > فازی/غلط‌تایپی) در وزنِ
// همون فیلد ضرب می‌شه؛ همین باعث می‌شه محصولی که کلمه‌ی جست‌وجو دقیقاً توی
// عنوانش هست، همیشه از محصولی که فقط توی توضیحاتش به‌سختی پیدا شده جلوتر بیفته
export function scoreRelevance(query: string, fields: WeightedField[]): number {
  const queryWords = normalizePersian(query).split(/\s+/).filter(Boolean);
  if (queryWords.length === 0) return 0;

  const normalizedFields = fields
    .filter((f) => f.text)
    .map((f) => ({ words: normalizePersian(f.text!).split(/\s+/).filter(Boolean), weight: f.weight }));

  let total = 0;
  for (const qw of queryWords) {
    let matchedThisWord = false;
    for (const field of normalizedFields) {
      let matchScore = 0;
      if (field.words.includes(qw)) matchScore = 4;
      else if (field.words.some((w) => w.startsWith(qw))) matchScore = 3;
      else if (field.words.some((w) => w.includes(qw))) matchScore = 2;
      else if (fuzzyWordMatch(qw, field.words)) matchScore = 1;

      if (matchScore > 0) {
        matchedThisWord = true;
        total += matchScore * field.weight;
      }
    }
    if (!matchedThisWord) return 0;
  }
  return total;
}

// یه لیست دلخواه (دسته‌بندی/برند/کمپین/...) رو بر اساس ربط به عبارت جست‌وجو
// فیلتر و مرتب می‌کنه -- برای این‌که scoreRelevance رو روی چند نوع داده‌ی
// متفاوت بدون تکرار همون filter+sort تکرار نکنیم
export function rankByRelevance<T>(
  items: T[],
  query: string,
  getFields: (item: T) => WeightedField[]
): { item: T; score: number }[] {
  return items
    .map((item) => ({ item, score: scoreRelevance(query, getFields(item)) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}
