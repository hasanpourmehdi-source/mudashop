// درصدِ تخفیفِ مؤثر برای مرتب‌سازیِ «بیشترین تخفیف»
import { describe, expect, it } from "vitest";
import { effectiveDiscountPercent, sortByDiscountDesc } from "@/lib/discountPercent";
import type { TrendyolLiveProduct } from "@/lib/trendyol";

function product(over: Partial<TrendyolLiveProduct>): TrendyolLiveProduct {
  return {
    id: 1,
    price: null,
    originalPrice: null,
    priceLira: null,
    originalPriceLira: null,
    basketCampaignPercent: null,
    ...over,
  } as TrendyolLiveProduct;
}

describe("effectiveDiscountPercent", () => {
  it("تخفیفِ عادی از روی قیمتِ قبلی (لیرِ خام، مستقل از نرخِ ارز)", () => {
    // نرخِ ارز ثبت نشده => تومان صفره، ولی درصد باید درست حساب بشه
    const p = product({ price: 0, originalPrice: 0, priceLira: 750, originalPriceLira: 1000 });
    expect(effectiveDiscountPercent(p)).toBe(25);
  });

  it("تخفیفِ سبد روی قیمتِ فعلی اعمال می‌شه و بدونِ قیمتِ قبلی همون درصدِ سبده", () => {
    expect(effectiveDiscountPercent(product({ priceLira: 800, basketCampaignPercent: 5 }))).toBe(5);
  });

  it("هر دو تخفیف: درصدِ کلی نسبت به قیمتِ قبلی", () => {
    // 1000 -> 800 -> (۵٪ سبد) 760  => ۲۴٪
    expect(
      effectiveDiscountPercent(product({ priceLira: 800, originalPriceLira: 1000, basketCampaignPercent: 5 })),
    ).toBe(24);
  });

  it("قیمتِ قبلیِ کمتر/برابر یا نبودنِ قیمت => ۰", () => {
    expect(effectiveDiscountPercent(product({ priceLira: 100, originalPriceLira: 90 }))).toBe(0);
    expect(effectiveDiscountPercent(product({ priceLira: null }))).toBe(0);
  });
});

describe("sortByDiscountDesc", () => {
  it("بی‌تخفیف‌ها حذف و بقیه از بیشترین به کمترین مرتب می‌شن", () => {
    const sorted = sortByDiscountDesc([
      product({ id: 1, priceLira: 90, originalPriceLira: 100 }), // ۱۰٪
      product({ id: 2, priceLira: 100, originalPriceLira: 100 }), // ۰
      product({ id: 3, priceLira: 50, originalPriceLira: 100 }), // ۵۰٪
    ]);
    expect(sorted.map((p) => p.id)).toEqual([3, 1]);
  });
});
