// اخطار کاهش قیمت -- منطق خالص آتش‌زدن و ساخت پیام
import { describe, expect, it } from "vitest";
import { shouldTriggerPriceAlert, buildPriceDropMessage } from "@/lib/priceAlert";

describe("shouldTriggerPriceAlert", () => {
  it("قیمت به مبلغ هدف رسیده و اخطار فعال است -> آتش می‌زند", () => {
    expect(shouldTriggerPriceAlert({ targetPrice: 100_000, notifiedAt: null }, 100_000)).toBe(true);
    expect(shouldTriggerPriceAlert({ targetPrice: 100_000, notifiedAt: null }, 90_000)).toBe(true);
  });

  it("قیمت بالاتر از هدف -> آتش نمی‌زند", () => {
    expect(shouldTriggerPriceAlert({ targetPrice: 100_000, notifiedAt: null }, 101_000)).toBe(false);
  });

  it("اخطاری که قبلاً اطلاع داده شده -> دوباره آتش نمی‌زند (یک‌بارمصرف)", () => {
    expect(
      shouldTriggerPriceAlert({ targetPrice: 100_000, notifiedAt: "2026-08-01T00:00:00.000Z" }, 90_000)
    ).toBe(false);
  });
});

describe("buildPriceDropMessage", () => {
  it("پیام شامل عنوان، قیمت فعلی و مبلغ هدف است", () => {
    const out = buildPriceDropMessage({
      productTitle: "کتانی ورزشی",
      targetPrice: 500_000,
      currentPrice: 450_000,
      slug: "katani",
    });
    expect(out.message).toContain("کتانی ورزشی");
    expect(out.message).toContain("۴۵۰٬۰۰۰");
    expect(out.message).toContain("۵۰۰٬۰۰۰");
    expect(out.link).toBe("/products/mazon/katani");
  });
});