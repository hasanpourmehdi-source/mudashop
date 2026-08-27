import { describe, expect, it } from "vitest";
import { computeOrderTotals } from "@/lib/orderTotals";
import { GIFT_WRAP_COST } from "@/lib/shipping";

describe("computeOrderTotals", () => {
  it("subtotal = جمع قیمت × تعداد", () => {
    const { subtotal } = computeOrderTotals(
      [
        { price: 100, quantity: 2 },
        { price: 50, quantity: 3 },
      ],
      0,
      false
    );
    expect(subtotal).toBe(350);
  });

  it("total = subtotal - تخفیف کوپن (بدون کادوپیچ)", () => {
    const { total } = computeOrderTotals([{ price: 1000, quantity: 1 }], 250, false);
    expect(total).toBe(750);
  });

  it("کادوپیچ به total اضافه می‌شود", () => {
    const { total } = computeOrderTotals([{ price: 1000, quantity: 1 }], 0, true);
    expect(total).toBe(1000 + GIFT_WRAP_COST);
  });

  it("تخفیف بیشتر از subtotal همیشه clamp می‌شه -- total هیچ‌وقت منفی نمی‌شه (رگرسیونِ باگِ واقعی: حذفِ یه قلمِ گرون از سفارشی با کوپنِ ثابت، total رو منفی و سفارش رو برای همیشه غیرقابل‌پرداخت می‌کرد)", () => {
    const { total, discountTotal } = computeOrderTotals([{ price: 100, quantity: 1 }], 300, false);
    expect(discountTotal).toBe(100);
    expect(total).toBe(0);
  });

  it("سبد خالی => subtotal و total صفر", () => {
    const totals = computeOrderTotals([], 0, false);
    expect(totals).toEqual({ subtotal: 0, total: 0, discountTotal: 0 });
  });
});