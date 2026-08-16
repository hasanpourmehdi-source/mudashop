import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const isAdmin = req.auth?.user?.role === "ADMIN";

  const isAdminRoute = pathname.startsWith("/admin");
  const isProfileRoute = pathname.startsWith("/profile");
  const isCheckoutRoute = pathname.startsWith("/checkout");
  const isOrdersRoute = pathname.startsWith("/orders");
  const isWalletRoute = pathname.startsWith("/wallet");
  const isPaymentRoute = pathname.startsWith("/payment");

  if (isAdminRoute && !isAdmin) {
    const url = new URL("/auth/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (
    (isProfileRoute || isCheckoutRoute || isOrdersRoute || isWalletRoute || isPaymentRoute) &&
    !isLoggedIn
  ) {
    const url = new URL("/auth/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }
});

export const config = {
  matcher: [
    "/admin/:path*",
    "/profile/:path*",
    "/checkout/:path*",
    "/orders/:path*",
    "/wallet/:path*",
    "/payment/:path*",
  ],
};
