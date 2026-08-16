import type { Metadata, Viewport } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CartUserSync } from "@/components/CartUserSync";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { InstallPrompt } from "@/components/InstallPrompt";
import { FormValidationLocalizer } from "@/components/FormValidationLocalizer";
import { fetchCategoryTree, fetchGenderMegaGroups } from "@/lib/categories";
import { prisma } from "@/lib/prisma";

const vazir = Vazirmatn({
  variable: "--font-vazir",
  subsets: ["arabic"],
  weight: ["400", "500", "700", "800"],
});

export const metadata: Metadata = {
  title: "مُداشاپ | فروشگاه پوشاک و مد ایرانی",
  description: "فروشگاه آنلاین پوشاک با محصولات اختصاصی مزون و کاتالوگ متنوع",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "مُداشاپ",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#f27a1a",
  width: "device-width",
  initialScale: 1,
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

  return (
    <html lang="fa" dir="rtl">
      <body className={`${vazir.variable} antialiased min-h-screen flex flex-col`}>
        <Providers>
          <ServiceWorkerRegister />
          <CartUserSync />
          <FormValidationLocalizer />
          <Header categories={categories} genderGroups={genderGroups} externalSites={externalSites} />
          <main className="flex-1">{children}</main>
          <Footer externalSites={externalSites} />
          <InstallPrompt />
        </Providers>
      </body>
    </html>
  );
}
