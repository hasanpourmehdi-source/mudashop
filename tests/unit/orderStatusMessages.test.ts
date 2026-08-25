// پوشش Gherkin: 01-status-bar.feature (برچسب‌های نوار وضعیت)
import { describe, expect, it } from "vitest";
import {
  ORDER_STATUS_NOTIFICATION_MESSAGES,
  customerOrderStatusLabel,
  pastTenseOrderLabel,
  shippingPaymentStatusLabel,
} from "@/lib/orderStatusMessages";

describe("customerOrderStatusLabel", () => {
  const fallback = "در حال پردازش";

  it("در status غیر از PROCESSING برچسب fallback برمی‌گردد", () => {
    expect(customerOrderStatusLabel("PENDING", "PENDING", fallback, false)).toBe(fallback);
    expect(customerOrderStatusLabel("SHIPPED", "PAID", fallback, false)).toBe(fallback);
  });

  it("برچسب PROCESSING با توجه به paymentStatus شفاف می‌شود", () => {
    expect(customerOrderStatusLabel("PROCESSING", "AWAITING_PAYMENT", fallback, false)).toBe(
      "منتظر پرداخت مشتری"
    );
    expect(customerOrderStatusLabel("PROCESSING", "AWAITING_VERIFICATION", fallback, false)).toBe(
      "در انتظار تأیید فیش"
    );
    // سفارش خارجی PAID => «در صف خرید»، سفارش مزون PAID => «در حال آماده‌سازی»
    expect(customerOrderStatusLabel("PROCESSING", "PAID", fallback, true)).toBe("در صف خرید");
    expect(customerOrderStatusLabel("PROCESSING", "PAID", fallback, false)).toBe(
      "در حال آماده‌سازی سفارش"
    );
  });

  it("paymentStatus ناشناخته به fallback سقوط می‌کند", () => {
    expect(customerOrderStatusLabel("PROCESSING", "PENDING", fallback, false)).toBe(fallback);
  });
});

describe("ORDER_STATUS_NOTIFICATION_MESSAGES", () => {
  it("برای هر گذار مهمِ status پیام دارد", () => {
    expect(ORDER_STATUS_NOTIFICATION_MESSAGES.PROCESSING).toBeTruthy();
    expect(ORDER_STATUS_NOTIFICATION_MESSAGES.SHIPPED).toBeTruthy();
    expect(ORDER_STATUS_NOTIFICATION_MESSAGES.DELIVERED).toBeTruthy();
    expect(ORDER_STATUS_NOTIFICATION_MESSAGES.CANCELLED).toBeTruthy();
    expect(ORDER_STATUS_NOTIFICATION_MESSAGES.RETURNED).toBeTruthy();
  });
});

describe("shippingPaymentStatusLabel", () => {
  it("برچسب‌های مرحله‌ی باربری را شفاف می‌کند", () => {
    expect(shippingPaymentStatusLabel("AWAITING_PAYMENT")).toBe("منتظر تسویه باربری");
    expect(shippingPaymentStatusLabel("AWAITING_VERIFICATION")).toBe("در حال وزن‌کشی");
    expect(shippingPaymentStatusLabel("PAID")).toBe("در صف ارسال");
    expect(shippingPaymentStatusLabel("FAILED")).toBe("پرداخت باربری رد شده");
  });

  it("مقدار ناشناخته دست‌نخورده برمی‌گردد", () => {
    expect(shippingPaymentStatusLabel("PENDING")).toBe("PENDING");
  });
});

describe("pastTenseOrderLabel", () => {
  it("فعل برچسب‌های «در حال ...» گذشته می‌شود", () => {
    expect(pastTenseOrderLabel("در صف خرید")).toBe("خریده شد");
    expect(pastTenseOrderLabel("در حال آماده‌سازی سفارش")).toBe("آماده‌سازی شد");
    expect(pastTenseOrderLabel("در صف ارسال")).toBe("ارسال شد");
    expect(pastTenseOrderLabel("تحویل داده شده")).toBe("تحویل داده شد");
  });

  it("برچسب بدون نگاشت دست‌نخورده برمی‌گردد", () => {
    expect(pastTenseOrderLabel("سفارش شما لغو شد")).toBe("سفارش شما لغو شد");
  });
});