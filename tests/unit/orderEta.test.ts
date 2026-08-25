// پوشش Gherkin: 18-eta.feature (تخمین زمان تحویل)
import { describe, expect, it } from "vitest";
import { carrierTransitDays, estimateDeliveryWindow, formatEta, type EtaOrderInput } from "@/lib/orderEta";

const NOW = new Date("2026-08-18T10:00:00.000Z");

function baseOrder(overrides: Partial<EtaOrderInput> = {}): EtaOrderInput {
  return {
    status: "PROCESSING",
    shippingMethod: "پست پیشتاز",
    hasExternalItems: false,
    createdAt: new Date("2026-08-18T08:00:00.000Z"),
    statusHistory: [],
    ...overrides,
  };
}

describe("carrierTransitDays -- ترانزیت شرکت باربری", () => {
  it("پیک موتوری ۰-۱ روز", () => {
    expect(carrierTransitDays("پیک موتوری")).toEqual({ min: 0, max: 1 });
  });
  it("تیپاکس ۲-۴ روز", () => {
    expect(carrierTransitDays("تیپاکس")).toEqual({ min: 2, max: 4 });
  });
  it("پست سفارشی ۵-۸ روز", () => {
    expect(carrierTransitDays("پست سفارشی")).toEqual({ min: 5, max: 8 });
  });
  it("پست پیشتاز (یا نامشخص) ۳-۵ روز", () => {
    expect(carrierTransitDays("پست پیشتاز")).toEqual({ min: 3, max: 5 });
    expect(carrierTransitDays(null)).toEqual({ min: 3, max: 5 });
  });
});

describe("estimateDeliveryWindow -- پنجره تخمینی تحویل", () => {
  it("سفارش تحویل‌داده‌شده ETA ندارد", () => {
    expect(estimateDeliveryWindow(baseOrder({ status: "DELIVERED" }), NOW)).toBeNull();
  });

  it("سفارش لغو/مرجوع ETA ندارد", () => {
    expect(estimateDeliveryWindow(baseOrder({ status: "CANCELLED" }), NOW)).toBeNull();
    expect(estimateDeliveryWindow(baseOrder({ status: "RETURNED" }), NOW)).toBeNull();
  });

  it("ارسال‌شده: پنجره از زمان SHIPPED (آخرین رویداد) + ترانزیت پست پیشتاز", () => {
    const shippedAt = new Date("2026-08-20T10:00:00.000Z");
    const eta = estimateDeliveryWindow(
      baseOrder({
        status: "SHIPPED",
        shippingMethod: "پست پیشتاز",
        statusHistory: [{ status: "SHIPPED", createdAt: shippedAt }],
      }),
      NOW
    );
    expect(eta).toEqual({
      from: new Date("2026-08-23T10:00:00.000Z"),
      to: new Date("2026-08-25T10:00:00.000Z"),
    });
  });

  it("مزونِ هنوز ارسال‌نشده: ۱ روز آماده‌سازی + ترانزیت از امروز", () => {
    const eta = estimateDeliveryWindow(baseOrder({ status: "PROCESSING", shippingMethod: "تیپاکس" }), NOW);
    expect(eta).toEqual({ from: new Date("2026-08-21T10:00:00.000Z"), to: new Date("2026-08-23T10:00:00.000Z") });
  });

  it("خارجیِ هنوز ارسال‌نشده: پنجره‌ی تقریبی ۵ تا ۱۲ روز", () => {
    const eta = estimateDeliveryWindow(
      baseOrder({ status: "PROCESSING", hasExternalItems: true }),
      NOW
    );
    expect(eta).toEqual({ from: new Date("2026-08-23T10:00:00.000Z"), to: new Date("2026-08-30T10:00:00.000Z") });
  });

  it("ارسال‌شده بدون رویداد SHIPPED: از تاریخ ایجاد سفارش", () => {
    const eta = estimateDeliveryWindow(
      baseOrder({ status: "SHIPPED", createdAt: new Date("2026-08-18T08:00:00.000Z") }),
      NOW
    );
    expect(eta?.from.getTime()).toBe(new Date("2026-08-21T08:00:00.000Z").getTime());
  });
});

describe("formatEta -- نمایش فارسی", () => {
  it("بازه را با روز و ماه فارسی نشان می‌دهد", () => {
    const eta = { from: new Date("2026-08-23T10:00:00.000Z"), to: new Date("2026-08-25T10:00:00.000Z") };
    const text = formatEta(eta);
    expect(text).toContain("تا");
  });
});