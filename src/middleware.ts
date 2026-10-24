import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

// حفاظت مسیرها در لبه (Edge). اینجا عمداً از auth() استفاده نمی‌شود چون در
// jwt callback به Prisma سر می‌زند و Prisma در Edge Runtime اجرا نمی‌شود.
// getToken فقط JWT را رمزگشایی می‌کند (بدون دسترسی به دیتابیس)؛ اعتبارسنجی
// واقعی نشست (لغو دستگاه، securityStamp و ...) هنگام درخواست واقعی در
// صفحه/API در Node Runtime انجام می‌شود.
export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "",
    // NextAuth خودش نامِ کوکیِ سشن رو بر اساسِ https-بودنِ url تعیین می‌کنه
    // (__Secure-authjs.session-token روی https، authjs.session-token روی http --
    // src/lib/../node_modules/@auth/core/lib/init.js). getToken بدونِ این پارامتر
    // پیش‌فرضش false هست و دنبالِ نامِ بدونِ پیشوند می‌گرده -- روی production (https)
    // اون کوکی هیچ‌وقت پیدا نمی‌شه و middleware همیشه کاربرِ لاگین‌کرده رو هم
    // به auth/login ریدایرکت می‌کنه
    secureCookie: req.nextUrl.protocol === "https:",
  });
  const isLoggedIn = !!token;
  const isAdmin = token?.role === "ADMIN";
  const isStaff = token?.role === "STAFF";

  const isAdminRoute = pathname.startsWith("/admin");
  // پرتالِ کارمندان (دسترسیِ محدود) -- برخلاف /admin که همیشه ADMIN کامل
  // می‌خواد، اینجا STAFF هم راه داره؛ محدودیتِ واقعیِ هر حیطه (کدوم زیرمسیر)
  // توی خودِ صفحه‌ی /staff/* با requireAdmin(scope) دوباره چک می‌شه، چون
  // میدل‌ور (Edge) به scopeهای تازه‌ی دیتابیس دسترسی ندارد
  const isStaffRoute = pathname.startsWith("/staff");
  const isProfileRoute = pathname.startsWith("/profile");
  // چک‌اوت دیگه لاگین رو اجبار نمی‌کنه -- خریدِ مهمان مجاز است (src/app/api/orders/route.ts)
  const isOrdersRoute = pathname.startsWith("/orders");
  const isWalletRoute = pathname.startsWith("/wallet");
  const isReferralRoute = pathname.startsWith("/referral");

  if (isAdminRoute && !isAdmin) {
    const url = new URL("/auth/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (isStaffRoute && !isAdmin && !isStaff) {
    const url = new URL("/auth/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // /payment عمداً اینجا نیست: خریدِ مهمان اینجا هم مجازه (دقیقاً مثل چک‌اوت) --
  // authority خودش (یه UUIDِ تصادفی) کافیه. کنترلِ دسترسیِ واقعی (سفارشِ مهمان
  // بدونِ سشن، سفارشِ کاربرِ ثبت‌نام‌کرده فقط با سشنِ خودش) توی خودِ API انجام
  // می‌شه (src/app/api/payment/[authority]/route.ts) چون میدل‌ور (Edge) به
  // دیتابیس دسترسی نداره تا مهمان‌بودنِ سفارش رو بفهمه
  if (
    (isProfileRoute || isOrdersRoute || isWalletRoute || isReferralRoute) &&
    !isLoggedIn
  ) {
    const url = new URL("/auth/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/staff/:path*",
    "/profile/:path*",
    "/orders/:path*",
    "/wallet/:path*",
    "/referral/:path*",
  ],
};