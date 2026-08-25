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
  const isPaymentRoute = pathname.startsWith("/payment");
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

  if (
    (isProfileRoute || isOrdersRoute || isWalletRoute || isPaymentRoute || isReferralRoute) &&
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
    "/checkout/:path*",
    "/orders/:path*",
    "/wallet/:path*",
    "/payment/:path*",
    "/referral/:path*",
  ],
};