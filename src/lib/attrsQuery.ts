// «نام‌ویژگی~مقدار» توکن‌های جداشده با کاما رو به Record<attribute, value> تبدیل می‌کنه --
// همون فرمتی که فیلترهای سایدبار مزون (facets.ts) از قبل توی URL تولید می‌کنن. برای
// هر اسم ویژگی فقط اولین مقدار در نظر گرفته می‌شه (روی صفحه‌ی محصول فقط یک انتخاب معنی داره).
export function parseAttrsQuery(raw: string | undefined | null): Record<string, string> {
  const result: Record<string, string> = {};
  for (const token of (raw ?? "").split(",").filter(Boolean)) {
    const [name, value] = token.split("~");
    if (name && value && !(name in result)) result[name] = value;
  }
  return result;
}
