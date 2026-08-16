// سفارش ممکنه توی چندتا بسته‌ی جدا ارسال بشه (مثلاً بعضی اقلام زودتر آماده
// می‌شن) -- پس Order.trackingCode یه رشته‌ی خامه ولی محتواش یه آرایه‌ی JSON از
// چندتا کد/شماره‌ست، نه یه مقدار تکی. این دو تابع تبدیل بین رشته‌ی ذخیره‌شده و
// آرایه‌ی واقعی رو یه‌جا نگه می‌دارن تا همه‌جا یکسان باشه
export function parseTrackingCodes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((c): c is string => typeof c === "string" && c.trim().length > 0);
    }
  } catch {
    // داده‌ی قدیمی‌تر ممکنه یه رشته‌ی خام (نه JSON) باشه -- همون رو به‌عنوان تنها کد در نظر می‌گیریم
  }
  return raw.trim() ? [raw.trim()] : [];
}

export function serializeTrackingCodes(codes: string[]): string {
  return JSON.stringify(codes.map((c) => c.trim()).filter(Boolean));
}
