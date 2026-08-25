// «خرید مجدد» -- ساخت اقلام سبد از سفارش قبلی با قیمت/موجودی فعلی
import { describe, expect, it } from "vitest";
import {
  buildReorderCartItems,
  type ReorderProduct,
  type ReorderVariant,
  type ReorderFlash,
  type ReorderOrderItem,
} from "@/lib/reorder";

const product: ReorderProduct = {
  id: "p1",
  title: "بلوز",
  slug: "boluz",
  basePrice: 200000,
  discount: 10,
  fastShipping: false,
  images: JSON.stringify(["https://img/a.jpg"]),
};

const variant: ReorderVariant = {
  id: "v1",
  stock: 5,
  priceDiff: 20000,
  values: [
    { attribute: "سایز", value: "L" },
    { attribute: "رنگ", value: "قرمز" },
  ],
};

const flash: ReorderFlash = { id: "f1", productId: "p1", discountPercent: 40 };

const orderItem: ReorderOrderItem = {
  title: "بلوز",
  quantity: 2,
  productId: "p1",
  variantId: "v1",
  image: null,
};

describe("buildReorderCartItems", () => {
  it("قیمت فعلی با تخفیف عادی + اختلاف واریانت محاسبه می‌شود", () => {
    const { cartItems, skipped } = buildReorderCartItems({
      items: [orderItem],
      products: [product],
      variants: [variant],
      flashSales: [],
    });
    // basePrice با ۱۰٪ تخفیف = 180000 + priceDiff 20000 = 200000
    expect(cartItems[0].price).toBe(200000);
    expect(cartItems[0].originalPrice).toBe(220000);
    expect(cartItems[0].variantLabel).toBe("سایز: L / رنگ: قرمز");
    expect(cartItems[0].maxStock).toBe(5);
    expect(cartItems[0].quantity).toBe(2);
    expect(skipped).toEqual([]);
  });

  it("حراج فلش جایگزین تخفیف عادی می‌شود", () => {
    const { cartItems } = buildReorderCartItems({
      items: [orderItem],
      products: [product],
      variants: [variant],
      flashSales: [flash],
    });
    // 40% روی 200000 = 120000 + 20000 = 140000
    expect(cartItems[0].price).toBe(140000);
    expect(cartItems[0].flashSaleId).toBe("f1");
  });

  it("واریانت ناموجود (stock=0) رد می‌شود", () => {
    const { cartItems, skipped } = buildReorderCartItems({
      items: [orderItem],
      products: [product],
      variants: [{ ...variant, stock: 0 }],
      flashSales: [],
    });
    expect(cartItems).toEqual([]);
    expect(skipped).toEqual(["بلوز"]);
  });

  it("محصول غیرفعال/حذف‌شده رد می‌شود", () => {
    const { cartItems, skipped } = buildReorderCartItems({
      items: [orderItem],
      products: [],
      variants: [variant],
      flashSales: [],
    });
    expect(cartItems).toEqual([]);
    expect(skipped).toEqual(["بلوز"]);
  });

  it("واریانتِ از‌بین‌رفته رد می‌شود", () => {
    const { skipped } = buildReorderCartItems({
      items: [orderItem],
      products: [product],
      variants: [],
      flashSales: [],
    });
    expect(skipped).toEqual(["بلوز"]);
  });

  it("آیتم بدون productId (ترندیول) رد می‌شود", () => {
    const { cartItems, skipped } = buildReorderCartItems({
      items: [{ ...orderItem, productId: null }],
      products: [product],
      variants: [variant],
      flashSales: [],
    });
    expect(cartItems).toEqual([]);
    expect(skipped).toEqual(["بلوز"]);
  });

  it("بدون واریانت، id سبد فقط productId است و maxStock حذف می‌شود", () => {
    const { cartItems } = buildReorderCartItems({
      items: [{ ...orderItem, variantId: null }],
      products: [product],
      variants: [],
      flashSales: [],
    });
    expect(cartItems[0].id).toBe("p1");
    expect(cartItems[0].maxStock).toBeUndefined();
    expect(cartItems[0].price).toBe(180000);
  });

  it("قیمت با تخفیف ۰، originalPrice ندارد", () => {
    const { cartItems } = buildReorderCartItems({
      items: [{ ...orderItem, variantId: null }],
      products: [{ ...product, discount: 0 }],
      variants: [],
      flashSales: [],
    });
    expect(cartItems[0].price).toBe(200000);
    expect(cartItems[0].originalPrice).toBeUndefined();
  });
});