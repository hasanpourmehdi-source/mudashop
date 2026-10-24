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
  // فایل‌های آپلودی از /api/files/... به لینکِ امضاشده‌ی Vercel Blob ریدایرکت می‌شن --
  // ویدیوی نظرها (media-src) و fetchِ عکس توی پوستر (connect-src) هم باید اجازه داشته باشن
  "media-src 'self' https://*.blob.vercel-storage.com",
  // https://vercel.com/api/blob: آپلودِ مستقیمِ ویدیوی نظر/فیش از مرورگر (src/lib/directUpload.ts)
  "connect-src 'self' https://www.google-analytics.com https://www.googletagmanager.com https://*.blob.vercel-storage.com https://vercel.com",
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

// قبلاً این‌جا لیستِ ۳۰تاییِ همه‌ی روت‌هایی بود که (مستقیم/غیرمستقیم) به
// fetchTrendyolPageViaBrowser می‌رسیدن (که به‌خاطرِ matcherِ contains:true
// زیر، واقعاً ۶۶ تا روت/API رو می‌گرفت) -- هرکدوم جدا-جدا باندلِ Playwright+
// @sparticuz/chromium (~۸۶ مگابایت) رو حمل می‌کردن. با ۵ دیپلویِ نگه‌داشته‌شده،
// این دوباره سهمیه‌ی Function Storage ورسل (۱۰ گیگ) رو پُر کرد (۲۰۲۶/۰۹/۰۹).
// فیکسِ ریشه‌ای: خودِ اجرای Playwright به یه روتِ داخلیِ تنها منتقل شد
// (src/app/api/internal/trendyol-browser-fetch)؛ src/lib/trendyolBrowserFetch.ts
// (که trendyol.ts/trendyolProductDetail.ts صداش می‌زنن) الان فقط یه فچِ داخلیِ
// HTTP به همون روته -- پس دیگه هیچ روتِ دیگه‌ای این باندل رو نیاز نداره، فقط
// همین یکی
const TRENDYOL_BROWSER_FETCH_ROUTES = ["/api/internal/trendyol-browser-fetch"];

const TRENDYOL_BROWSER_FETCH_FILE_GLOBS = [
  "./scripts/trendyolBrowserFetchWorker.cjs",
  "./node_modules/playwright-extra/**",
  "./node_modules/playwright-core/**",
  "./node_modules/puppeteer-extra-plugin-stealth/**",
  "./node_modules/puppeteer-extra-plugin-user-preferences/**",
  "./node_modules/puppeteer-extra-plugin-user-data-dir/**",
  "./node_modules/puppeteer-extra-plugin/**",
  "./node_modules/@sparticuz/chromium/**",
  "./node_modules/end-of-stream/**",
  "./node_modules/events-universal/**",
  "./node_modules/fast-fifo/**",
  "./node_modules/pump/**",
  "./node_modules/streamx/**",
  "./node_modules/tar-fs/**",
  "./node_modules/tar-stream/**",
  "./node_modules/text-decoder/**",
  "./node_modules/arr-union/**",
  "./node_modules/balanced-match/**",
  "./node_modules/brace-expansion/**",
  "./node_modules/clone-deep/**",
  "./node_modules/concat-map/**",
  "./node_modules/debug/**",
  "./node_modules/deepmerge/**",
  "./node_modules/for-in/**",
  "./node_modules/for-own/**",
  "./node_modules/fs-extra/**",
  "./node_modules/fs.realpath/**",
  "./node_modules/glob/**",
  "./node_modules/graceful-fs/**",
  "./node_modules/has-flag/**",
  "./node_modules/inflight/**",
  "./node_modules/inherits/**",
  "./node_modules/is-buffer/**",
  "./node_modules/is-plain-object/**",
  "./node_modules/isobject/**",
  "./node_modules/jsonfile/**",
  "./node_modules/kind-of/**",
  "./node_modules/lazy-cache/**",
  "./node_modules/merge-deep/**",
  "./node_modules/minimatch/**",
  "./node_modules/ms/**",
  "./node_modules/once/**",
  "./node_modules/path-is-absolute/**",
  "./node_modules/rimraf/**",
  "./node_modules/shallow-clone/**",
  "./node_modules/supports-color/**",
  "./node_modules/wrappy/**",
];

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

  // scripts/trendyolBrowserFetchWorker.cjs عمداً import مستقیم نمی‌شه (توضیح
  // کامل توی src/app/api/internal/trendyol-browser-fetch/route.ts) -- به‌عنوان
  // یه پروسه‌ی Node جدا (execFile) صدا زده می‌شه. چون هیچ‌جا مستقیم import
  // نمی‌شه، ردیابیِ خودکارِ فایل‌های Next.js (output file tracing) این اسکریپت
  // و وابستگی‌هاش (playwright-extra، stealth، @sparticuz/chromium) رو
  // نمی‌بینه و روی Vercel deploy نمی‌کنه -- نتیجه‌ش «Cannot find module»
  // موقعِ اجرای واقعیه. اینجا صریح می‌گیم این فایل‌ها هم شاملِ باندلِ تنها
  // روتی بشن که واقعاً اجراش می‌کنه (TRENDYOL_BROWSER_FETCH_ROUTES بالا --
  // فقط همون یه روتِ داخلی، نه هر روتی که فقط فراخوانیش می‌کنه). اگه fallback
  // به‌هر دلیلی شکست بخوره، بی‌خطره: fetchTrendyolPageViaBrowser همیشه با
  // .catch() صدا زده می‌شه (trendyol.ts) و نتیجه‌ش دقیقاً همون مسیرِ خطای
  // از‌قبل‌موجود (throw/اعلانِ ادمین) رو ادامه می‌ده -- نه کرشِ ۵۰۰
  outputFileTracingIncludes: Object.fromEntries(
    TRENDYOL_BROWSER_FETCH_ROUTES.map((route) => [route, TRENDYOL_BROWSER_FETCH_FILE_GLOBS])
  ),

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
