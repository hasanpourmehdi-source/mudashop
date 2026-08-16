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

// آیا کلمه‌ی جست‌وجو (query) با یکی از کلمات متن هدف (haystack) به‌اندازه کافی
// نزدیکه؟ هم substring رو قبول می‌کنه، هم فاصله ویرایشی کوچیک (غلط تایپی) رو
export function fuzzyWordMatch(queryWord: string, haystackWords: string[]): boolean {
  if (queryWord.length < 2) {
    return haystackWords.some((w) => w.startsWith(queryWord));
  }

  return haystackWords.some((word) => {
    if (word.includes(queryWord)) return true;
    // برای کلمات کوتاه (۲-۴ حرف) فقط ۱ خطا، برای کلمات بلندتر تا ۲ خطا مجازه
    const threshold = queryWord.length <= 4 ? 1 : 2;
    return levenshtein(queryWord, word) <= threshold;
  });
}

// چک می‌کنه همه کلمات query (با فاصله جدا شده) تو متن هدف پیدا بشن (فازی)
export function fuzzyTextMatch(query: string, targetText: string): boolean {
  const queryWords = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const targetWords = targetText.toLowerCase().split(/\s+/).filter(Boolean);
  if (queryWords.length === 0) return true;
  return queryWords.every((qw) => fuzzyWordMatch(qw, targetWords));
}
