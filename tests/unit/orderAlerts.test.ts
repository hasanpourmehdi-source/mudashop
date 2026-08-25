// پوشش Gherkin: 11-stuck-order-dashboard.feature (تشخیص مرحله‌ی «منتظر اقدام»)
import { describe, expect, it } from "vitest";
import {
  computeOrderAlert,
  determineOrderStage,
  type AlertableOrder,
  type AlertThresholds,
} from "@/lib/orderAlerts";

const NOW = new Date("2026-08-16T12:00:00.000Z");
const HOUR = 1000 * 60 * 60;

function makeOrder(overrides: Partial<AlertableOrder>): AlertableOrder {
  return {
    id: "o1",
    status: "PENDING",
    paymentStatus: "PENDING",
    itemsNegotiationStatus: "NONE",
    itemsNegotiationRespondedAt: null,
    paidAt: null,
    receiptSubmittedAt: null,
    updatedAt: NOW,
    createdAt: NOW,
    items: [],
    shippingPayment: null,
    statusHistory: [],
    returnRequest: null,
    ...overrides,
  };
}

function makeThresholds(overrides?: Partial<AlertThresholds>): AlertThresholds {
  const base = { warnHours: 1, alertHours: 2 };
  return {
    AWAITING_FIRST_REVIEW: base,
    AWAITING_ITEM_PAYMENT_REVIEW: base,
    AWAITING_SHIPPING_PAYMENT_REVIEW: base,
    AWAITING_PURCHASE: base,
    AWAITING_ADMIN_ITEMS_REVIEW: base,
    SHIPPED_TOO_LONG: base,
    AWAITING_RETURN_REVIEW: base,
    ...overrides,
  };
}

describe("determineOrderStage", () => {
  it("سفارش بسته/لغو/تحویل‌شده مرحله ندارد (مگر مرجوعی باز)", () => {
    for (const status of ["CANCELLED", "DELIVERED", "RETURNED"]) {
      expect(determineOrderStage(makeOrder({ status })).stage).toBeNull();
    }
  });

  it("PENDING = در انتظار اولین بررسی", () => {
    const r = determineOrderStage(makeOrder({ createdAt: NOW }));
    expect(r.stage).toBe("AWAITING_FIRST_REVIEW");
    expect(r.since).toEqual(NOW);
  });

  it("مذاکره اقلام در انتظار بازبینی ادمین", () => {
    const respondedAt = new Date(NOW.getTime() - 2 * HOUR);
    const r = determineOrderStage(
      makeOrder({
        status: "PROCESSING",
        itemsNegotiationStatus: "AWAITING_ADMIN_REVIEW",
        itemsNegotiationRespondedAt: respondedAt,
      })
    );
    expect(r.stage).toBe("AWAITING_ADMIN_ITEMS_REVIEW");
    expect(r.since).toEqual(respondedAt);
  });

  it("paymentStatus AWAITING_VERIFICATION = بررسی فیش اقلام", () => {
    const receiptSubmittedAt = new Date(NOW.getTime() - 2 * HOUR);
    const r = determineOrderStage(
      makeOrder({
        status: "PROCESSING",
        paymentStatus: "AWAITING_VERIFICATION",
        receiptSubmittedAt,
      })
    );
    expect(r.stage).toBe("AWAITING_ITEM_PAYMENT_REVIEW");
    expect(r.since).toEqual(receiptSubmittedAt);
  });

  it("پرداخت باربری در انتظار تأیید = مرحله‌ی ارسال/باربری", () => {
    const r = determineOrderStage(
      makeOrder({
        status: "PROCESSING",
        paymentStatus: "PAID",
        shippingPayment: { status: "AWAITING_VERIFICATION", receiptSubmittedAt: null },
      })
    );
    expect(r.stage).toBe("AWAITING_SHIPPING_PAYMENT_REVIEW");
  });

  it("سفارش خارجی PAID (بدون اتمام باربری) = در صف خرید", () => {
    const paidAt = new Date(NOW.getTime() - 2 * HOUR);
    const r = determineOrderStage(
      makeOrder({
        status: "PROCESSING",
        paymentStatus: "PAID",
        paidAt,
        items: [{ source: "TRENDYOL" }],
      })
    );
    expect(r.stage).toBe("AWAITING_PURCHASE");
    expect(r.since).toEqual(paidAt);
  });

  it("سفارش‌های خالص مزون PAID هرگز وارد صف خرید نمی‌شوند", () => {
    const r = determineOrderStage(
      makeOrder({ status: "PROCESSING", paymentStatus: "PAID", items: [{ source: "MAZON" }] })
    );
    expect(r.stage).toBeNull();
  });

  it("SHIPPED = ارسال طولانی، بر پایه‌ی آخرین تاریخ SHIPPED", () => {
    const shippedAt = new Date(NOW.getTime() - 20 * HOUR);
    const r = determineOrderStage(
      makeOrder({
        status: "SHIPPED",
        statusHistory: [
          { status: "PROCESSING", createdAt: new Date(NOW.getTime() - 30 * HOUR) },
          { status: "SHIPPED", createdAt: shippedAt },
        ],
      })
    );
    expect(r.stage).toBe("SHIPPED_TOO_LONG");
    expect(r.since).toEqual(shippedAt);
  });

  it("درخواست مرجوعی باز روی سفارش تحویل‌شده هم stage دارد", () => {
    const updatedAt = new Date(NOW.getTime() - 5 * HOUR);
    const r = determineOrderStage(
      makeOrder({ status: "DELIVERED", returnRequest: { status: "PENDING", updatedAt } })
    );
    expect(r.stage).toBe("AWAITING_RETURN_REVIEW");
    expect(r.since).toEqual(updatedAt);
  });
});

describe("computeOrderAlert", () => {
  it("گذراندن آستانه‌ها، سطح هشدار را بر اساس ساعت تعیین می‌کند", () => {
    const thresholds = makeThresholds();
    const none = computeOrderAlert(makeOrder({ createdAt: new Date(NOW.getTime() - 0.5 * HOUR) }), thresholds, NOW);
    const warn = computeOrderAlert(makeOrder({ createdAt: new Date(NOW.getTime() - 1.5 * HOUR) }), thresholds, NOW);
    const alert = computeOrderAlert(makeOrder({ createdAt: new Date(NOW.getTime() - 3 * HOUR) }), thresholds, NOW);
    expect(none.level).toBe("none");
    expect(warn.level).toBe("warn");
    expect(alert.level).toBe("alert");
  });

  it("مرحله‌ی بدون since (مثلاً SHIPPED بدون تاریخچه) هشدار ندارد", () => {
    const r = computeOrderAlert(
      makeOrder({ status: "SHIPPED", statusHistory: [] }),
      makeThresholds(),
      NOW
    );
    expect(r.level).toBe("none");
    expect(r.hoursSince).toBeNull();
  });
});