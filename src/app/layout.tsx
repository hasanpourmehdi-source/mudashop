import type { Metadata, Viewport } from "next";
import { Vazirmatn } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import dynamic from "next/dynamic";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { CartUserSync } from "@/components/CartUserSync";
import { RecentlyViewedUserSync } from "@/components/RecentlyViewedUserSync";
import { LoyaltyLevelUpToast } from "@/components/LoyaltyLevelUpToast";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { LocaleAnalyticsRecorder } from "@/components/LocaleAnalyticsRecorder";
import { CookieConsentGate } from "@/components/CookieConsentGate";
import { FormValidationLocalizer } from "@/components/FormValidationLocalizer";
import { TranslationComboBar } from "@/components/TranslationComboBar";

// این چهارتا فقط پشتِ یه فلگ روشن می‌شن (ممکنه ادمین خاموششون کرده باشه)، ولی
// قبلاً import مستقیم بودن یعنی جاوااسکریپتشون توی باندلِ مشترکِ *همه‌ی*
// بازدیدکننده‌ها می‌رفت، حتی وقتی فلگ خاموشه. با dynamic()، فقط وقتی واقعاً
// رندر بشن (فلگ روشن باشه) جاوااسکریپتشون دانلود می‌شه
const ReviewNudgePopup = dynamic(() => import("@/components/ReviewNudgePopup").then((m) => m.ReviewNudgePopup));
const SupportChatWidget = dynamic(() => import("@/components/SupportChatWidget").then((m) => m.SupportChatWidget));
const ShoppingAssistantWidget = dynamic(() =>
  import("@/components/ShoppingAssistantWidget").then((m) => m.ShoppingAssistantWidget)
);
const CompareBar = dynamic(() => import("@/components/CompareBar").then((m) => m.CompareBar));
import { auth } from "@/lib/auth";
import { fetchCategoryTree, fetchGenderMegaGroups } from "@/lib/categories";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";
import { getSiteSettings, SITE_SETTING_KEYS } from "@/lib/siteSettings";
import { OrganizationJsonLd } from "@/components/OrganizationJsonLd";
import { LanguageProvider } from "@/components/LanguageProvider";
import { FeatureFlagsProvider } from "@/components/FeatureFlagsProvider";
import { TrustBadgesProvider } from "@/components/TrustBadgesProvider";
import { SalesPausedProvider } from "@/components/SalesPausedProvider";
import { ClientPollingProvider } from "@/components/ClientPollingProvider";
import { getFeatureFlags } from "@/lib/featureFlags";
import { PwaInstallProvider } from "@/components/PwaInstallProvider";
import { isLang, LANG_COOKIE, DEFAULT_LANG } from "@/lib/i18n";
import { cookies } from "next/headers";

const vazir = Vazirmatn({
  variable: "--font-vazir",
  subsets: ["arabic"],
  weight: ["400", "500", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "مُداشاپ | فروشگاه پوشاک و مد ایرانی",
    template: "%s | مُداشاپ",
  },
  description: "فروشگاه آنلاین پوشاک با محصولات اختصاصی مزون و کاتالوگ متنوع",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "مُداشاپ",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "مُداشاپ",
    locale: "fa_IR",
    url: SITE_URL,
    title: "مُداشاپ | فروشگاه پوشاک و مد ایرانی",
    description: "فروشگاه آنلاین پوشاک با محصولات اختصاصی مزون و کاتالوگ متنوع",
    images: [{ url: `${SITE_URL}/icons/icon-512.png`, width: 512, height: 512, alt: "مُداشاپ" }],
  },
  twitter: {
    card: "summary",
    title: "مُداشاپ | فروشگاه پوشاک و مد ایرانی",
    description: "فروشگاه آنلاین پوشاک با محصولات اختصاصی مزون و کاتالوگ متنوع",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

export const viewport: Viewport = {
  themeColor: "#f27a1a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // این ۶ واکشی مستقل از همن (فقط genderGroups به categories نیازمنده) --
  // قبلاً همه پشتِ‌سرِ‌هم (await به await) اجرا می‌شدن یعنی هر بارگذاریِ صفحه
  // (کاملِ سایت، چون این‌جا layout ریشه‌ست) به‌اندازه‌ی مجموعِ زمانِ همه‌شون
  // طول می‌کشید؛ الان با Promise.all موازی می‌شن -- زمانِ کل ≈ کندترین‌شون
  const [categories, externalSites, trustBadgeSettings, flags, session, cookieStore] = await Promise.all([
    fetchCategoryTree(),
    prisma.externalSite.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    }),
    // نوارِ بج‌های اعتماد -- ۴ بج ثابت (آیکنِ هرکدوم ثابته)، هرکدوم جدا از تنظیمات
    // روشن/خاموش می‌شه و متنش دلخواهِ ادمینه
    getSiteSettings([
      SITE_SETTING_KEYS.TRUST_BADGE_1_ENABLED,
      SITE_SETTING_KEYS.TRUST_BADGE_1_TEXT,
      SITE_SETTING_KEYS.TRUST_BADGE_2_ENABLED,
      SITE_SETTING_KEYS.TRUST_BADGE_2_TEXT,
      SITE_SETTING_KEYS.TRUST_BADGE_3_ENABLED,
      SITE_SETTING_KEYS.TRUST_BADGE_3_TEXT,
      SITE_SETTING_KEYS.TRUST_BADGE_4_ENABLED,
      SITE_SETTING_KEYS.TRUST_BADGE_4_TEXT,
      // اینم همینجا (نه یه getSiteSettings جدا) چون از قبل داریم رویِ همون
      // جدولِ siteSetting یه رفت‌وبرگشت می‌زنیم -- برایِ دکمه‌ی واتس‌اپ/تلگرامِ
      // ویجتِ پشتیبانی
      SITE_SETTING_KEYS.SUPPORT_WHATSAPP_NUMBER,
      SITE_SETTING_KEYS.SUPPORT_TELEGRAM_USERNAME,
      // همینجا -- حالتِ «فروش موقتاً متوقف» هم سراسریه و روی هر صفحه‌ای لازمه
      SITE_SETTING_KEYS.SALES_PAUSED_ENABLED,
      SITE_SETTING_KEYS.SALES_PAUSED_MESSAGE,
      SITE_SETTING_KEYS.CLIENT_POLL_INTERVAL_SECONDS,
    ]),
    getFeatureFlags(),
    auth(),
    cookies(),
  ]);
  const genderGroups = await fetchGenderMegaGroups(categories);

  const TRUST_BADGE_ICONS = ["🛡️", "🚚", "↩️", "💰"];
  const trustBadges = [1, 2, 3, 4]
    .filter((n) => trustBadgeSettings[`trustBadge${n}Enabled`] === "true")
    .map((n) => ({ icon: TRUST_BADGE_ICONS[n - 1], text: trustBadgeSettings[`trustBadge${n}Text`] }));

  const isAdmin = session?.user?.role === "ADMIN";
  const salesPaused = {
    paused: trustBadgeSettings[SITE_SETTING_KEYS.SALES_PAUSED_ENABLED] === "true",
    message: trustBadgeSettings[SITE_SETTING_KEYS.SALES_PAUSED_MESSAGE] ?? "",
  };

  const pollSeconds = Number(trustBadgeSettings[SITE_SETTING_KEYS.CLIENT_POLL_INTERVAL_SECONDS]);
  const pollIntervalMs = (Number.isFinite(pollSeconds) && pollSeconds >= 5 ? pollSeconds : 30) * 1000;

  const cookieLang = cookieStore.get(LANG_COOKIE)?.value;
  const initialLang = isLang(cookieLang) ? cookieLang : DEFAULT_LANG;

  return (
    <html lang={initialLang} dir="rtl">
      <body className={`${vazir.variable} antialiased min-h-screen flex flex-col`}>
        <NextTopLoader color="#f27a1a" showSpinner={false} height={3} />
        <Providers session={session}>
          <FeatureFlagsProvider flags={flags}>
            <TrustBadgesProvider trustBadges={trustBadges}>
            <SalesPausedProvider value={salesPaused}>
            <ClientPollingProvider intervalMs={pollIntervalMs}>
            <LanguageProvider initialLang={initialLang}>
              <PwaInstallProvider>
                <ServiceWorkerRegister />
                <LocaleAnalyticsRecorder />
                <CookieConsentGate />
                <CartUserSync />
                <RecentlyViewedUserSync />
                <LoyaltyLevelUpToast />
                {flags[SITE_SETTING_KEYS.FEATURE_REVIEW_NUDGE] && <ReviewNudgePopup />}
                <FormValidationLocalizer />
                <OrganizationJsonLd />
                {salesPaused.paused && (
                  <div className="bg-amber-500 text-white text-center text-xs sm:text-sm py-2 px-4">
                    ⏸️ {salesPaused.message}
                  </div>
                )}
                <Header categories={categories} genderGroups={genderGroups} externalSites={externalSites} />
                <main className="flex-1">{children}</main>
                <Footer externalSites={externalSites} trustBadges={trustBadges} />
                <MobileBottomNav />
                {flags[SITE_SETTING_KEYS.FEATURE_SUPPORT_CHAT] && (
                  <SupportChatWidget
                    whatsappNumber={trustBadgeSettings[SITE_SETTING_KEYS.SUPPORT_WHATSAPP_NUMBER]}
                    telegramUsername={trustBadgeSettings[SITE_SETTING_KEYS.SUPPORT_TELEGRAM_USERNAME]}
                  />
                )}
                {flags[SITE_SETTING_KEYS.FEATURE_SHOPPING_ASSISTANT] && <ShoppingAssistantWidget />}
                {flags[SITE_SETTING_KEYS.FEATURE_COMPARE] && <CompareBar />}
                <TranslationComboBar isAdmin={isAdmin} />
              </PwaInstallProvider>
            </LanguageProvider>
            </ClientPollingProvider>
            </SalesPausedProvider>
            </TrustBadgesProvider>
          </FeatureFlagsProvider>
        </Providers>
      </body>
    </html>
  );
}
