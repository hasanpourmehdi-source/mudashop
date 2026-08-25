// پوشش Gherkin: 15-payment-deadline.feature (مهلت پرداخت و لغو خودکار)
import { describe, expect, it } from "vitest";
import {
  isPaymentAwaitingExpired,
  isPaymentComplete,
  computePaymentDeadline,
  type PaymentDeadlineOrder,
} from "@/lib/orderPaymentDeadline";

function baseOrder(overrides: Partial<PaymentDeadlineOrder> = {}): PaymentDeadlineOrder {
  return {
    id: "order-1234567890",
    status: "PROCESSING",
    paymentStatus: "AWAITING_PAYMENT",
    paymentDeadlineAt: new Date("2026-08-18T10:00:00.000Z"),
    hasExternalItems: true,
    items: [{ purchaseStatus: "PENDING" }],
    shippingPayment: null,
    ...overrides,
  };
}

describe("isPaymentComplete -- آیا پرداخت کاملاً تسویه شده؟", () => {
  it("سفارش خارجی وقتی کامل است که هم اقلام PAID باشد هم دور دوم (هزینه ارسال) PAID", () => {
    expect(
      isPaymentComplete(
        baseOrder({
          paymentStatus: "PAID",
          shippingPayment: { status: "PAID" },
        })
      )
    ).toBe(true);
  });

  it("سفارش خارجی با اقلام PAID ولی هزینه ارسال AWAITING_PAYMENT ناقص است", () => {
    expect(
      isPaymentComplete(
        baseOrder({
          paymentStatus: "PAID",
          shippingPayment: { status: "AWAITING_PAYMENT" },
        })
      )
    ).toBe(false);
  });

  it("سفارش مزون (بدون قلم خارجی) با paymentStatus PAID کامل است", () => {
    expect(
      isPaymentComplete(
        baseOrder({
          hasExternalItems: false,
          paymentStatus: "PAID",
          shippingPayment: null,
        })
      )
    ).toBe(true);
  });
});

describe("isPaymentAwaitingExpired -- آیا مهلت پرداخت گذشته و پرداخت ناقص است؟", () => {
  const now = new Date("2026-08-19T00:00:00.000Z");

  it("مهلت گذشته و پرداخت ناقص -> منقضی", () => {
    expect(
      isPaymentAwaitingExpired(
        baseOrder({
          paymentDeadlineAt: new Date("2026-08-18T10:00:00.000Z"),
          paymentStatus: "AWAITING_PAYMENT",
          shippingPayment: null,
        }),
        now
      )
    ).toBe(true);
  });

  it("مهلت هنوز نرسیده -> منقضی نیست", () => {
    expect(
      isPaymentAwaitingExpired(
        baseOrder({
          paymentDeadlineAt: new Date("2026-08-20T00:00:00.000Z"),
        }),
        now
      )
    ).toBe(false);
  });

  it("مهلت گذشته ولی پرداخت کامل شده -> منقضی نیست", () => {
    expect(
      isPaymentAwaitingExpired(
        baseOrder({
          paymentDeadlineAt: new Date("2026-08-18T10:00:00.000Z"),
          paymentStatus: "PAID",
          shippingPayment: { status: "PAID" },
        }),
        now
      )
    ).toBe(false);
  });

  it("بدون paymentDeadlineAt -> منقضی نیست", () => {
    expect(
      isPaymentAwaitingExpired(
        baseOrder({ paymentDeadlineAt: null }),
        now
      )
    ).toBe(false);
  });
});

describe("computePaymentDeadline -- محاسبه مهلت", () => {
  it("۴۸ ساعت بعد از زمان شروع محاسبه می‌شود", () => {
    const now = new Date("2026-08-18T10:00:00.000Z");
    expect(computePaymentDeadline(now, 48)).toEqual(new Date("2026-08-20T10:00:00.000Z"));
  });
});