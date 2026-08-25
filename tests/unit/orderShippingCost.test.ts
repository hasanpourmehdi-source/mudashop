// منطق هزینه‌ی ارسال سفارش: برای سبد فقط-مزون با روش پستی، هزینه از
// calculateShipping گرفته می‌شه؛ روش‌های NO_COST یا کوپن ارسال رایگان => صفر؛
// سبد دارای کالای خارجی => null (توسط ادمین بعد از وزن‌کشی).
import { describe, expect, it } from "vitest";
import { FREE_SHIPPING_THRESHOLD, NO_COST_SHIPPING_METHODS, SHIPPING_COST, calculateShipping } from "@/lib/shipping";

type ResolveShippingArgs = {
  hasExternalItems: boolean;
  shippingMethod: string | null;
  freeShipping: boolean;
  subtotal: number;
};

// مدل منطق مشترک بین checkout (کلاینت) و POST /api/orders (سرور)
function resolveShippingCost({ hasExternalItems, shippingMethod, freeShipping, subtotal }: ResolveShippingArgs): number | null {
  if (hasExternalItems) return null;
  const isNoCostMethod = NO_COST_SHIPPING_METHODS.includes(shippingMethod as (typeof NO_COST_SHIPPING_METHODS)[number]);
  return freeShipping || isNoCostMethod ? 0 : calculateShipping(subtotal);
}

describe("هزینه‌ی ارسال سفارش (منطق مشترک checkout و سرور)", () => {
  it("سبد فقط-مزون با روش پستی زیر آستانه => هزینه کامل", () => {
    expect(
      resolveShippingCost({
        hasExternalItems: false,
        shippingMethod: "پست پیشتاز",
        freeShipping: false,
        subtotal: FREE_SHIPPING_THRESHOLD - 1,
      })
    ).toBe(SHIPPING_COST);
  });

  it("سبد فقط-مزون با روش پستی بالای آستانه => رایگان", () => {
    expect(
      resolveShippingCost({
        hasExternalItems: false,
        shippingMethod: "پست سفارشی",
        freeShipping: false,
        subtotal: FREE_SHIPPING_THRESHOLD,
      })
    ).toBe(0);
  });

  it("روش NO_COST (پیک موتوری/تیپاکس) => صفر حتی زیر آستانه", () => {
    for (const method of NO_COST_SHIPPING_METHODS) {
      expect(
        resolveShippingCost({
          hasExternalItems: false,
          shippingMethod: method,
          freeShipping: false,
          subtotal: 1,
        })
      ).toBe(0);
    }
  });

  it("کوپن ارسال رایگان => صفر", () => {
    expect(
      resolveShippingCost({
        hasExternalItems: false,
        shippingMethod: "پست پیشتاز",
        freeShipping: true,
        subtotal: 100,
      })
    ).toBe(0);
  });

  it("سبد دارای کالای خارجی => null (ادمین بعداً اعلام می‌کند)", () => {
    expect(
      resolveShippingCost({
        hasExternalItems: true,
        shippingMethod: null,
        freeShipping: false,
        subtotal: 100,
      })
    ).toBeNull();
  });
});