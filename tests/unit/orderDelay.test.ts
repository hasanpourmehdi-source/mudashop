// پوشش Gherkin: 19-order-delay.feature (علت دقیق تأخیر + ETA جدید)
import { describe, expect, it } from "vitest";
import { computeDelayInfo, STAGE_DELAY_DAYS, type DelayOrderInput } from "@/lib/orderDelay";

const NOW = new Date("2026-08-25T10:00:00.000Z");

function baseOrder(overrides: Partial<DelayOrderInput> = {}): DelayOrderInput {
  return {
    status: "PROCESSING",
    paymentStatus: "PAID",
    hasExternalItems: false,
    itemsNegotiationStatus: "AGREED",
    shippingMethod: "پست پیشتاز",
    createdAt: new Date("2026-08-18T08:00:00.000Z"),
    statusHistory: [],
    shippingPayment: null,
    ...overrides,
  };
}

describe("computeDelayInfo -- تشخیص تأخیر و علت آن", () => {
  it("سفارش تحویل/لغو/مرجوع تأخیر محسوب نمی‌شود", () => {
    for (const status of ["DELIVERED", "CANCELLED", "RETURNED"]) {
      expect(computeDelayInfo(baseOrder({ status }), NOW).delayed).toBe(false);
    }
  });

  it("سناریوی ۱: بسته برگشت خورده -> علت دقیق + ETA جدید", () => {
    const info = computeDelayInfo(
      baseOrder({
        status: "SHIPPED",
        statusHistory: [
          { status: "SHIPPED", createdAt: new Date("2026-08-20T10:00:00.000Z"), note: "بسته توسط پست برگشت خورد" },
        ],
      }),
      NOW
    );
    expect(info.delayed).toBe(true);
    expect(info.reason).toContain("برگشت خورد");
    expect(info.newEta).not.toBeNull();
  });

  it("سناریوی ۲: ارسال شده ولی ترانزیت گذشته -> تأخیر در حمل", () => {
    const shippedAt = new Date("2026-08-10T10:00:00.000Z"); // خیلی قبل از NOW
    const info = computeDelayInfo(
      baseOrder({
        status: "SHIPPED",
        shippingMethod: "پست پیشتاز", // max 5 روز -> تحویل حداکثر ۱۵ آگوست
        statusHistory: [{ status: "SHIPPED", createdAt: shippedAt, note: null }],
      }),
      NOW
    );
    expect(info.delayed).toBe(true);
    expect(info.reason).toContain("حمل");
  });

  it("سناریوی ۲ منفی: ارسال شده ولی هنوز در پنجره ترانزیت -> تأخیر نیست", () => {
    const shippedAt = new Date("2026-08-24T10:00:00.000Z");
    const info = computeDelayInfo(
      baseOrder({
        status: "SHIPPED",
        shippingMethod: "پست پیشتاز",
        statusHistory: [{ status: "SHIPPED", createdAt: shippedAt, note: null }],
      }),
      NOW
    );
    expect(info.delayed).toBe(false);
  });

  it("سناریوی ۳: گیر در «در صف خرید» بیش از آستانه -> تأخیر با علت مرحله", () => {
    const info = computeDelayInfo(
      baseOrder({
        status: "PROCESSING",
        paymentStatus: "PAID",
        hasExternalItems: true,
        createdAt: new Date("2026-08-05T08:00:00.000Z"), // ۲۰ روز قبل
      }),
      NOW
    );
    expect(info.delayed).toBe(true);
    expect(info.reason).toContain("در صف خرید");
    expect(info.newEta).not.toBeNull();
  });

  it("سناریوی ۳ منفی: سفارش جدید در مرحله -> هنوز تأخیر نیست", () => {
    const info = computeDelayInfo(
      baseOrder({
        createdAt: new Date("2026-08-24T08:00:00.000Z"), // دیروز
        paymentStatus: "AWAITING_PAYMENT",
      }),
      NOW
    );
    expect(info.delayed).toBe(false);
  });

  it("STAGE_DELAY_DAYS مقدار منطقی دارد", () => {
    expect(STAGE_DELAY_DAYS).toBeGreaterThan(0);
  });
});