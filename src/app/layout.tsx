import type { Metadata, Viewport } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CartUserSync } from "@/components/CartUserSync";
import { ReviewNudgePopup } from "@/components/ReviewNudgePopup";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { LocaleAnalyticsRecorder } from "@/components/LocaleAnalyticsRecorder";
import { CookieConsentGate } from "@/components/CookieConsentGate";
import { FormValidationLocalizer } from "@/components/FormValidationLocalizer";
import { SupportChatWidget } from "@/components/SupportChatWidget";
import { ShoppingAssistantWidget } from "@/components/ShoppingAssistantWidget";
import { CompareBar } from "@/components/CompareBar";
import { fetchCategoryTree, fetchGenderMegaGroups } from "@/lib/categories";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";
import { getSiteSettings, SITE_SETTING_KEYS } from "@/lib/siteSettings";
import { OrganizationJsonLd } from "@/components/OrganizationJsonLd";
import { LanguageProvider } from "@/components/LanguageProvider";
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
  description: "فروشگاه آنلاین پوشاک با محصولات اختصاصی مزون و کاتالوگ متنوع ترندیول",
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
    description: "فروشگاه آنلاین پوشاک با محصولات اختصاصی مزون و کاتالوگ متنوع ترندیول",
    images: [{ url: `${SITE_URL}/icons/icon-512.png`, width: 512, height: 512, alt: "مُداشاپ" }],
  },
  twitter: {
    card: "summary",
    title: "مُداشاپ | فروشگاه پوشاک و مد ایرانی",
    description: "فروشگاه آنلاین پوشاک با محصولات اختصاصی مزون و کاتالوگ متنوع ترندیول",
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
  const categories = await fetchCategoryTree();
  const genderGroups = await fetchGenderMegaGroups(categories);
  const externalSites = await prisma.externalSite.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });

  // نوارِ بج‌های اعتماد -- ۴ بج ثابت (آیکنِ هرکدوم ثابته)، هرکدوم جدا از تنظیمات
  // روشن/خاموش می‌شه و متنش دلخواهِ ادمینه
  const trustBadgeSettings = await getSiteSettings([
    SITE_SETTING_KEYS.TRUST_BADGE_1_ENABLED,
    SITE_SETTING_KEYS.TRUST_BADGE_1_TEXT,
    SITE_SETTING_KEYS.TRUST_BADGE_2_ENABLED,
    SITE_SETTING_KEYS.TRUST_BADGE_2_TEXT,
    SITE_SETTING_KEYS.TRUST_BADGE_3_ENABLED,
    SITE_SETTING_KEYS.TRUST_BADGE_3_TEXT,
    SITE_SETTING_KEYS.TRUST_BADGE_4_ENABLED,
    SITE_SETTING_KEYS.TRUST_BADGE_4_TEXT,
  ]);
  const TRUST_BADGE_ICONS = ["🛡️", "🚚", "↩️", "💰"];
  const trustBadges = [1, 2, 3, 4]
    .filter((n) => trustBadgeSettings[`trustBadge${n}Enabled`] === "true")
    .map((n) => ({ icon: TRUST_BADGE_ICONS[n - 1], text: trustBadgeSettings[`trustBadge${n}Text`] }));

  const cookieStore = await cookies();
  const cookieLang = cookieStore.get(LANG_COOKIE)?.value;
  const initialLang = isLang(cookieLang) ? cookieLang : DEFAULT_LANG;

  return (
    <html lang={initialLang} dir="rtl">
      <body className={`${vazir.variable} antialiased min-h-screen flex flex-col`}>
        <Providers>
          <LanguageProvider initialLang={initialLang}>
            <PwaInstallProvider>
              <ServiceWorkerRegister />
              <LocaleAnalyticsRecorder />
              <CookieConsentGate />
              <CartUserSync />
              <ReviewNudgePopup />
              <FormValidationLocalizer />
              <OrganizationJsonLd />
              <Header categories={categories} genderGroups={genderGroups} externalSites={externalSites} />
              <main className="flex-1">{children}</main>
              <Footer externalSites={externalSites} trustBadges={trustBadges} />
              <SupportChatWidget />
              <ShoppingAssistantWidget />
              <CompareBar />
            </PwaInstallProvider>
          </LanguageProvider>
        </Providers>
      </body>
    </html>
  );
}
