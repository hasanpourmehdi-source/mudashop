// dedupeProducts: در مرز صفحه‌بندی (infinite scroll) ترندیول/میلا محصولات
// تکراری (همان id) برمی‌گرده -- باید بدون تغییر ترتیب، تکراری‌ها حذف بشن
// تا کلید React تکراری نشه.
import { describe, expect, it } from "vitest";
import { dedupeProducts } from "@/components/TrendyolLiveGrid";
import type { TrendyolLiveProduct } from "@/lib/trendyol";

function m(id: string): TrendyolLiveProduct {
  return {
    id,
    name: `محصول ${id}`,
    nameFa: `محصول ${id}`,
    price: 1000,
    originalPrice: null,
    discountPercentText: null,
    image: null,
    images: [],
    url: null,
    category: null,
    brand: null,
    hasOfficialSellerBadge: false,
    rating: null,
    reviewCount: null,
    hasReviewPhoto: false,
    freeCargo: false,
    isAd: false,
    stripBadge: null,
    campaignSeal: null,
    simplifiedBadges: [],
    tyPlusPrice: null,
    lowestPriceDurationDays: null,
    socialProofFavoriteCount: null,
    socialProofOrderCount: null,
  };
}

describe("dedupeProducts", () => {
  it("محصولات تکراری صفحه‌ی بعدی را حذف می‌کند", () => {
    const current = [m("1"), m("2")];
    const next = [m("2"), m("3"), m("4")];
    const result = dedupeProducts(current, next);
    expect(result.map((p) => p.id)).toEqual(["1", "2", "3", "4"]);
  });

  it("ترتیب صفحه‌ی اول حفظ می‌شود", () => {
    const result = dedupeProducts([m("a")], [m("a"), m("b")]);
    expect(result.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("اگر هیچ تکراری نباشد، همه append می‌شوند", () => {
    const current = [m("1")];
    const result = dedupeProducts(current, [m("2"), m("3")]);
    expect(result).toHaveLength(3);
  });

  it("کل آرایه‌ی تکراری (صفحه‌ی اشتباه) چیزی اضافه نمی‌کند", () => {
    const current = [m("1"), m("2"), m("3")];
    const result = dedupeProducts(current, [m("1"), m("2"), m("3")]);
    expect(result).toHaveLength(3);
  });

  it("با آرایه‌ی خالی ورودی، خالی می‌ماند", () => {
    expect(dedupeProducts([], [])).toEqual([]);
  });
});