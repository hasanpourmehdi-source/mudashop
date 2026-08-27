// یه rate-limiterِ سبک و درون‌حافظه‌ای -- برای یه سرورِ تک-پردازشی (دقیقاً
// همون چیزیه که این پروژه هست، بدون cron/کلاستر/Redis) کافیه. بعد از هر
// ری‌استارتِ سرور شمارنده‌ها صفر می‌شن -- این محدودیت پذیرفته شده چون نصب و
// نگه‌داریِ یه storeِ خارجی صرفاً برای همین یه کار توجیه نداره.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// چون cron واقعی نداریم، هر فراخوانی با احتمالِ کم یه پاک‌سازیِ سطل‌های
// منقضی‌شده رو هم انجام می‌ده -- وگرنه حافظه با گذشتِ زمان بی‌نهایت رشد می‌کنه
function cleanupExpired(now: number) {
  if (Math.random() > 0.02) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

// key باید شاملِ IP + نامِ اقدام باشه (مثلاً "orders:1.2.3.4") تا محدودیتِ یه
// اقدام رو با اقدامِ دیگه قاطی نکنه
export function checkRateLimit(key: string, opts: { limit: number; windowMs: number }): RateLimitResult {
  const now = Date.now();
  cleanupExpired(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (existing.count >= opts.limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }
  existing.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

// پشتِ یه ریورس‌پروکسی، پروکسیِ خودمون IP کلاینت رو به x-forwarded-for
// «اضافه» می‌کنه -- پس آخرین (راست‌ترین) مقدار تنها بخشی از زنجیره‌ست که
// دستِ مستقیمِ کلاینت نیست. گرفتنِ اولین مقدار برعکس بود: کلاینت می‌تونست
// با هدرِ جعلیِ «1.2.3.4, <واقعی>» برای هر درخواست یه سطلِ تازه بگیره و
// کل محدودیت (لاگین/کوپن/فراموشی رمز) بی‌اثر می‌شد. بدونِ پروکسی (توسعه‌ی
// محلی) هیچ هدری قابل اعتماد نیست -- مقدارِ ثابت برمی‌گردونیم که حداقل همه
// رو یکسان محدود کنه
export function getClientIp(req: Request): string {
  // بعضی تست‌های واحد یه mockِ سبک از Request می‌سازن (فقط با json())، بدونِ
  // headersِ واقعی -- به‌جای کرش‌کردن، محافظه‌کارانه یه مقدارِ ثابت برمی‌گردونیم
  if (!req.headers || typeof req.headers.get !== "function") return "unknown";
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const hops = xff.split(",").map((h) => h.trim()).filter(Boolean);
    const last = hops[hops.length - 1];
    if (last) return last;
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}

const RATE_LIMIT_MESSAGE = (seconds: number) =>
  `درخواست‌های زیادی از این آدرس ارسال شده -- لطفاً ${seconds < 60 ? `${seconds} ثانیه` : `${Math.ceil(seconds / 60)} دقیقه`} دیگه دوباره امتحان کن`;

// اقداماتی که محدودشون می‌کنیم + سقف هرکدوم -- یه‌جا نگه داشته می‌شه تا عددها
// پخش‌وپلا نشن؛ خودِ عددها بر اساسِ رفتارِ طبیعیِ یه کاربرِ واقعی انتخاب شدن
// (نه خیلی سخت‌گیر که کاربرِ واقعی رو اذیت کنه، نه خیلی شل که فایده نداشته باشه)
export const RATE_LIMITS = {
  ORDER_CREATE: { limit: 8, windowMs: 5 * 60 * 1000 }, // ۸ سفارش در ۵ دقیقه
  COUPON_VALIDATE: { limit: 15, windowMs: 5 * 60 * 1000 }, // ۱۵ تلاش در ۵ دقیقه
  FORGOT_PASSWORD: { limit: 5, windowMs: 15 * 60 * 1000 }, // ۵ درخواست در ۱۵ دقیقه
  LOGIN: { limit: 15, windowMs: 10 * 60 * 1000 }, // ۱۵ تلاشِ ورود (هر ایمیلی) در ۱۰ دقیقه از یه IP
  REVIEW_CREATE: { limit: 10, windowMs: 10 * 60 * 1000 }, // ۱۰ نظر در ۱۰ دقیقه
  REVIEW_UPLOAD: { limit: 30, windowMs: 10 * 60 * 1000 }, // ۳۰ آپلود در ۱۰ دقیقه (تا ۴ عکس/ویدیو به‌ازای هر نظر)
} as const;

export function rateLimitOrNull(req: Request, action: keyof typeof RATE_LIMITS): RateLimitResult | null {
  const result = checkRateLimit(`${action}:${getClientIp(req)}`, RATE_LIMITS[action]);
  return result.allowed ? null : result;
}

export { RATE_LIMIT_MESSAGE };
