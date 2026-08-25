// کارت هدیه و وفاداری -- توابع خالص: کد، کسراژ، قابل‌فعال‌سازی‌بودن
import { describe, expect, it } from "vitest";
import { generateGiftCardCode, applyCashback, isGiftCardRedeemable } from "@/lib/giftCard";

describe("generateGiftCardCode", () => {
  it("قالب پیش‌فرض: پیشوند + دو بخش ۴ کاراکتری", () => {
    const code = generateGiftCardCode();
    expect(code).toMatch(/^MUD-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it("پیشوند سفارشی قبول می‌کند", () => {
    expect(generateGiftCardCode("SALE")).toMatch(/^SALE-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });
});

describe("applyCashback", () => {
  it("کسراژ = کف (مبلغ × درصد / ۱۰۰)", () => {
    expect(applyCashback(500_000, 2)).toBe(10_000);
    expect(applyCashback(333_333, 3)).toBe(9999);
    expect(applyCashback(1_000_000, 10)).toBe(100_000);
  });

  it("مبلغ یا درصد ناصفر -> صفر", () => {
    expect(applyCashback(0, 2)).toBe(0);
    expect(applyCashback(100_000, 0)).toBe(0);
    expect(applyCashback(-5, 2)).toBe(0);
  });
});

describe("isGiftCardRedeemable", () => {
  const valid = { balance: 100_000, isActive: true, redeemedAt: null, expiresAt: null };

  it("کارت سالم قابل فعال‌سازی است", () => {
    expect(isGiftCardRedeemable(valid)).toBe(true);
  });

  it("کارت مصرف‌شده یا بدون موجودی قابل فعال‌سازی نیست", () => {
    expect(isGiftCardRedeemable({ ...valid, redeemedAt: "2026-08-01T00:00:00.000Z" })).toBe(false);
    expect(isGiftCardRedeemable({ ...valid, balance: 0 })).toBe(false);
  });

  it("کارت غیرفعال یا منقضی قابل فعال‌سازی نیست", () => {
    expect(isGiftCardRedeemable({ ...valid, isActive: false })).toBe(false);
    expect(
      isGiftCardRedeemable({ ...valid, expiresAt: "2020-01-01T00:00:00.000Z" })
    ).toBe(false);
  });
});