import type { NextConfig } from "next";

// img-src به‌عمد بازه (https: بدون لیستِ دامنه‌های ثابت) چون عکس‌های محصولِ
// ترندیول/میلا از چندین زیردامنه/CDN مختلف میان که از قبل نمی‌شه لیستِ کامل و
// پایدارشون رو داشت (برخلافِ next/image که این عکس‌ها رو با unoptimized
// می‌گیره، نه remotePatterns). script-src هنوز 'unsafe-inline' داره چون
// اسکریپت‌های GA4/متاپیکسل (src/components/AnalyticsScripts.tsx) و JSON-LD
// این پروژه inline هستن و بدونِ راه‌اندازیِ nonce (که یه تغییرِ بزرگ‌تره)
// حذفش همه‌شون رو می‌شکنه -- در عوض script-src فقط همین دو دامنه‌ی
// شناخته‌شده + self رو اجازه می‌ده، پس تزریقِ اسکریپتِ خارجی (هدفِ اصلیِ CSP
// در برابر XSS) هنوز مسدوده
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://connect.facebook.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "connect-src 'self' https://www.google-analytics.com https://www.googletagmanager.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  // یادآوری: پرداخت الان کاملاً شبیه‌سازی/کارت‌به‌کارتِ دستیه (src/app/api/wallet/topup/route.ts)،
  // پس هیچ فرمی به دامنه‌ی خارجی سابمیت نمی‌شه و 'self' درسته. وقتی درگاهِ
  // واقعی (زرین‌پال یا مشابه) وصل شد، اون‌جا معمولاً یه <form>/redirect به
  // دامنه‌ی درگاهه -- باید همون دامنه اینجا اضافه بشه، وگرنه مرورگر ریدایرکتِ
  // پرداخت رو مسدود می‌کنه
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // got-scraping (و وابسته‌ش header-generator) فایل‌های داده‌ی JSON رو با مسیر
  // نسبی به __dirname خودشون می‌خونن (مثل data_files/headers-order.json). اگه
  // Turbopack/webpack این پکیج‌ها رو باندل کنه، مسیر __dirname عوض می‌شه و این
  // فایل‌ها دیگه پیدا نمی‌شن (ENOENT). با serverExternalPackages می‌گیم این‌ها
  // رو باندل نکنه و بذاره Node.js عادی از node_modules لودشون کنه.
  serverExternalPackages: [
    "got-scraping",
    "header-generator",
    "agent-base",
    "https-proxy-agent",
    "socks-proxy-agent",
  ],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
