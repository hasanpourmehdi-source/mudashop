"use client";

import { useEffect } from "react";
import { useCurrentMarketplaceStore } from "@/store/currentMarketplace";

// روی صفحه‌ی جزئیاتِ محصولِ ترندیول رندر می‌شه تا هدر بفهمه این صفحه دقیقاً
// مالِ کدوم سایتِ خارجیه (ترندیول یا ترندیول‌میلا) -- چون از روی خودِ pathname
// (که برای هر دو یکسانه: /products/trendyol/[slug]) قابل‌تشخیص نیست
export function CurrentMarketplaceSync({ siteSlug }: { siteSlug: string }) {
  const setSiteSlug = useCurrentMarketplaceStore((s) => s.setSiteSlug);
  useEffect(() => {
    setSiteSlug(siteSlug);
    return () => setSiteSlug(null);
  }, [siteSlug, setSiteSlug]);
  return null;
}
