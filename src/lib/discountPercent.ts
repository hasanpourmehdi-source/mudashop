import type { TrendyolLiveProduct } from "@/lib/trendyol";

// همون منطقِ بجِ درصدِ کارتِ گرید (TrendyolLiveGrid): تخفیفِ عادی از روی
// قیمتِ قبلی، تخفیفِ سبد (basketCampaignPercent) روی قیمتِ فعلی، و اگه هردو
// بود درصدِ کلی نسبت به قیمتِ قبلی. نسبت‌ها مستقل از واحدن، پس لیرِ خام
// (که همیشه هست) به تومان ترجیح داده می‌شه -- وگرنه با نرخِ ارزِ ثبت‌نشده
// (تومان=۰) همه‌ی محصولات «بی‌تخفیف» حساب می‌شدن. توی فایلِ جدا چون هم سرور
// هم کلاینت (TrendyolLiveGrid) لازمش دارن و کلاینت نباید prisma رو بکشه تو باندل
export function effectiveDiscountPercent(p: TrendyolLiveProduct): number {
  const price = p.priceLira ?? p.price;
  const original = p.originalPriceLira ?? p.originalPrice;
  if (price == null || price <= 0) return 0;
  const hasNormal = original != null && original > price;
  const basket = p.basketCampaignPercent != null && p.basketCampaignPercent > 0 ? p.basketCampaignPercent : null;
  const finalPrice = basket != null ? price * (1 - basket / 100) : price;
  if (hasNormal && basket != null) return Math.round(((original! - finalPrice) / original!) * 100);
  if (hasNormal) return Math.round(((original! - price) / original!) * 100);
  return basket ?? 0;
}

export function sortByDiscountDesc(products: TrendyolLiveProduct[]): TrendyolLiveProduct[] {
  return products
    .filter((p) => effectiveDiscountPercent(p) > 0)
    .sort((a, b) => effectiveDiscountPercent(b) - effectiveDiscountPercent(a));
}
