import { create } from "zustand";

// فقط برای اینکه Header (که یه کامپوننتِ سراسریِ توی root layout‌ه و خودش
// نمی‌دونه صفحه‌ی جاری مالِ کدوم سایتِ خارجیه) بفهمه صفحه‌ی جزئیاتِ محصولِ
// ترندیولِ جاری (/products/trendyol/[slug]) واقعاً مالِ کدوم سایته (ترندیول
// یا ترندیول‌میلا) -- چون این دو تا یه پیشوندِ URL مشترک دارن و از روی خودِ
// pathname قابلِ‌تشخیص نیستن. صفحه‌ی محصول (سرور-کامپوننت) با یه سینک‌کننده‌ی
// کوچیکِ کلاینتی این مقدار رو ست می‌کنه؛ persist نمی‌خواد چون فقط تا وقتی
// همون صفحه بازه معتبره
type CurrentMarketplaceState = {
  siteSlug: string | null;
  setSiteSlug: (siteSlug: string | null) => void;
};

export const useCurrentMarketplaceStore = create<CurrentMarketplaceState>((set) => ({
  siteSlug: null,
  setSiteSlug: (siteSlug) => set({ siteSlug }),
}));
