import { createHmac, timingSafeEqual } from "crypto";

// کپچای ریاضی ساده مثل تگموند: «جمع اعداد ۳۹ و ۳۳ چه می‌شود؟»
// برای جلوگیری از اسپم ربات روی ورود/ثبت‌نام/فراموشی رمز.
//
// عمداً بدون‌حالت (stateless) -- نسخه‌ی قبلی جواب رو توی یه Map درون‌حافظه‌ای
// نگه می‌داشت (فرضِ «تک‌پردازشِ همیشه‌روشن» مثل rateLimit)، که روی سرورلسِ
// Vercel کاملاً خراب بود: هر invocation می‌تونه رویِ یه instance جداگانه اجرا
// بشه، پس createCaptcha (GET) و verifyCaptcha (لاگین بعدی) اکثراً یه Mapِ
// مشترک نمی‌دیدن و همیشه شکست می‌خورد (ورودِ ادمین با رمزِ درست هم رد می‌شد).
// اینجا به‌جاش جواب توی خودِ id امضا می‌شه (HMAC با NEXTAUTH_SECRET) -- بدون
// این‌که خودِ جواب قابل‌خوندن باشه (فقط امضاست، نه جوابِ رمزگذاری‌شده)، پس
// نیازی به ذخیره‌سازیِ سمتِ سرور نیست و روی هر تعداد instance درست کار می‌کنه.
// تنها تفاوتِ رفتاری: دیگه «یک‌بارمصرف» نیست (تا انقضا قابلِ استفاده‌ی مجدده)،
// که برای یه کپچای کمکیِ ضدِ اسپم (نه یه مرزِ امنیتیِ حیاتی) قابلِ چشم‌پوشیه.
const TTL_MS = 5 * 60 * 1000; // ۵ دقیقه

function getSecret(): string {
  return process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "";
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

// ارقام فارسی/عربی را به لاتین تبدیل می‌کند تا «۷۲» هم مثل «72» قبول شود
function normalizeDigits(input: string): string {
  return input.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

export function createCaptcha(): { id: string; question: string } {
  const a = Math.floor(Math.random() * 40) + 10; // ۱۰ تا ۵۰
  const b = Math.floor(Math.random() * 40) + 10;
  const answer = a + b;
  const expiresAt = Date.now() + TTL_MS;
  // امضا فقط رویِ جواب+انقضا -- خودِ جواب هیچ‌وقت به شکلِ قابل‌خوندن توی id نمی‌ره
  const sig = sign(`${answer}:${expiresAt}`);
  const id = Buffer.from(`${expiresAt}.${sig}`).toString("base64url");
  const question = `جمع اعداد ${a.toLocaleString("fa-IR")} و ${b.toLocaleString("fa-IR")} چه می‌شود؟`;
  return { id, question };
}

export function verifyCaptcha(id: string | undefined | null, answerRaw: string | number | undefined | null): boolean {
  if (!id || answerRaw == null || answerRaw === "") return false;

  let decoded: string;
  try {
    decoded = Buffer.from(id, "base64url").toString("utf8");
  } catch {
    return false;
  }
  const dotIndex = decoded.indexOf(".");
  if (dotIndex === -1) return false;
  const expiresAtStr = decoded.slice(0, dotIndex);
  const sig = decoded.slice(dotIndex + 1);
  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  const normalized = normalizeDigits(String(answerRaw).trim());
  const candidate = Number(normalized);
  if (!Number.isFinite(candidate)) return false;

  const expectedSig = sign(`${candidate}:${expiresAt}`);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf);
}
