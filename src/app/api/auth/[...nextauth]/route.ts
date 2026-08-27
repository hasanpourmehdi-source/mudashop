import { NextResponse } from "next/server";
import { handlers } from "@/lib/auth";
import { registerDeviceAfterAuth } from "@/lib/security";
import { rateLimitOrNull, RATE_LIMIT_MESSAGE } from "@/lib/rateLimit";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const res = await handlers.GET(req);
  // برای ورود گوگل هم (callback که GET است) دستگاه را ثبت می‌کنیم
  await registerDeviceAfterAuth(req, res);
  return res;
}

export async function POST(req: NextRequest) {
  // قفلِ ۵بارِ اشتباه (src/lib/auth.ts) فقط مخصوصِ همون یه حسابه -- این‌جا،
  // فقط برای مسیرِ واقعیِ ورود با ایمیل/رمز (نه بقیه‌ی مسیرهای NextAuth مثل
  // csrf/session)، یه لایه‌ی مستقلِ بر-اساسِ-IP هم اضافه می‌شه تا کسی نتونه با
  // امتحان‌کردنِ صدها ایمیلِ مختلف از یه IP، این قفلِ per-account رو دور بزنه
  if (req.nextUrl.pathname.endsWith("/callback/credentials")) {
    const limited = rateLimitOrNull(req, "LOGIN");
    if (limited) {
      return NextResponse.json(
        { error: RATE_LIMIT_MESSAGE(limited.retryAfterSeconds) },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
      );
    }
  }

  const res = await handlers.POST(req);
  // بعد از ورود موفق با ایمیل/رمز، دستگاه را ثبت می‌کنیم
  await registerDeviceAfterAuth(req, res);
  return res;
}