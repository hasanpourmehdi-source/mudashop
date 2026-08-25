// پوشش Gherkin: 11-stuck-order-dashboard.feature, TC-11.1 -- مقادیر پیش‌فرض آستانه‌ها
// باید دقیقاً همان سطوح نمونه‌ها را تولید کنند (هماهنگی پیش‌فرض‌ها با قرارداد).
// آستانه‌ها از پیش‌فرض‌های siteSettings (بدون ردیف دیتابیس) بار می‌شوند.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.doMock("@/lib/prisma", () => ({
  prisma: {
    siteSetting: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

import { computeOrderAlert, loadAlertThresholds, type AlertableOrder } from "@/lib/orderAlerts";

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

// برای هر stage، سفارشی با فیلدهای واقعی که determineOrderStage آن را به همان stage برساند
function orderForStage(stage: string, monthsAgoHours: number): AlertableOrder {
  const ago = new Date(NOW.getTime() - monthsAgoHours * HOUR);
  switch (stage) {
    case "AWAITING_FIRST_REVIEW":
      return makeOrder({ status: "PENDING", createdAt: ago });
    case "AWAITING_ITEM_PAYMENT_REVIEW":
      return makeOrder({ status: "PROCESSING", paymentStatus: "AWAITING_VERIFICATION", receiptSubmittedAt: ago });
    case "AWAITING_SHIPPING_PAYMENT_REVIEW":
      return makeOrder({
        status: "PROCESSING",
        paymentStatus: "PAID",
        shippingPayment: { status: "AWAITING_VERIFICATION", receiptSubmittedAt: ago },
      });
    case "AWAITING_PURCHASE":
      return makeOrder({ status: "PROCESSING", paymentStatus: "PAID", paidAt: ago, items: [{ source: "TRENDYOL" }] });
    case "AWAITING_ADMIN_ITEMS_REVIEW":
      return makeOrder({
        status: "PROCESSING",
        itemsNegotiationStatus: "AWAITING_ADMIN_REVIEW",
        itemsNegotiationRespondedAt: ago,
      });
    case "SHIPPED_TOO_LONG":
      return makeOrder({
        status: "SHIPPED",
        statusHistory: [{ status: "SHIPPED", createdAt: ago }],
      });
    case "AWAITING_RETURN_REVIEW":
      return makeOrder({ status: "DELIVERED", returnRequest: { status: "PENDING", updatedAt: ago } });
    default:
      throw new Error(`stage ناشناخته: ${stage}`);
  }
}

const SAMPLES: Array<{ stage: string; hours: number; expected: string }> = [
  { stage: "AWAITING_FIRST_REVIEW", hours: 1, expected: "none" },
  { stage: "AWAITING_FIRST_REVIEW", hours: 3, expected: "warn" },
  { stage: "AWAITING_FIRST_REVIEW", hours: 7, expected: "alert" },
  { stage: "AWAITING_ITEM_PAYMENT_REVIEW", hours: 10, expected: "none" },
  { stage: "AWAITING_ITEM_PAYMENT_REVIEW", hours: 15, expected: "warn" },
  { stage: "AWAITING_ITEM_PAYMENT_REVIEW", hours: 25, expected: "alert" },
  { stage: "AWAITING_SHIPPING_PAYMENT_REVIEW", hours: 10, expected: "none" },
  { stage: "AWAITING_SHIPPING_PAYMENT_REVIEW", hours: 15, expected: "warn" },
  { stage: "AWAITING_SHIPPING_PAYMENT_REVIEW", hours: 25, expected: "alert" },
  { stage: "AWAITING_PURCHASE", hours: 20, expected: "none" },
  { stage: "AWAITING_PURCHASE", hours: 30, expected: "warn" },
  { stage: "AWAITING_PURCHASE", hours: 50, expected: "alert" },
  { stage: "AWAITING_ADMIN_ITEMS_REVIEW", hours: 10, expected: "none" },
  { stage: "AWAITING_ADMIN_ITEMS_REVIEW", hours: 15, expected: "warn" },
  { stage: "AWAITING_ADMIN_ITEMS_REVIEW", hours: 25, expected: "alert" },
  { stage: "SHIPPED_TOO_LONG", hours: 60, expected: "none" },
  { stage: "SHIPPED_TOO_LONG", hours: 90, expected: "warn" },
  { stage: "SHIPPED_TOO_LONG", hours: 130, expected: "alert" },
  { stage: "AWAITING_RETURN_REVIEW", hours: 20, expected: "none" },
  { stage: "AWAITING_RETURN_REVIEW", hours: 30, expected: "warn" },
  { stage: "AWAITING_RETURN_REVIEW", hours: 50, expected: "alert" },
];

afterEach(() => {
  vi.resetModules();
});

describe("TC-11.1 -- پیش‌فرض آستانه‌های داشبورد با Gherkin هماهنگ‌اند", () => {
  it.each(SAMPLES)("$stage با $hours ساعت -> $expected", async ({ stage, hours, expected }) => {
    const thresholds = await loadAlertThresholds();
    const order = orderForStage(stage, hours);
    const { level } = computeOrderAlert(order, thresholds, NOW);
    expect(level).toBe(expected);
  });
});