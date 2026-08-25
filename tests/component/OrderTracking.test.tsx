// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

import { OrderTracking, type OrderTrackingData } from "@/components/OrderTracking";

// تاریخ‌های نسبی به «الان» (نه تاریخ ثابت تقویمی) -- چون computeDelayInfo/
// estimateDeliveryWindow با new Date() واقعی مقایسه می‌کنن، یه تاریخ ثابت
// (مثلاً "2026-08-20") فقط تا وقتی امروز از پنجره‌ی ترانزیت (حداکثر ۵ روزِ
// پست پیشتاز) نگذشته باشه درسته -- بعدش خودش خودبه‌خود «تأخیری» می‌شه و تست
// بدون هیچ تغییری در کد واقعی fail می‌کنه. با آفست نسبی، تست همیشه معتبر می‌مونه.
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function initialOrder(overrides: Partial<OrderTrackingData> = {}): OrderTrackingData {
  return {
    id: "order-1",
    status: "SHIPPED",
    paymentStatus: "PAID",
    paymentAuthority: null,
    itemsNegotiationStatus: "AGREED",
    hasExternalItems: false,
    shippingMethod: "پست پیشتاز",
    createdAt: daysAgo(2),
    statusHistory: [{ id: "h1", status: "SHIPPED", note: null, createdAt: daysAgo(1) }],
    shippingPayment: { status: "PAID" },
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("OrderTracking -- نمایش تخمین زمان تحویل (ETA)", () => {
  it("برای سفارش ارسال‌شده، متن «تحویل تخمینی» نمایش داده می‌شود", () => {
    render(<OrderTracking initialOrder={initialOrder()} />);
    expect(screen.getByText(/تحویل تخمینی:/)).toBeInTheDocument();
  });

  it("برای سفارش لغوشده، ETA نمایش داده نمی‌شود", () => {
    render(<OrderTracking initialOrder={initialOrder({ status: "CANCELLED" })} />);
    expect(screen.queryByText(/تحویل تخمینی:/)).not.toBeInTheDocument();
  });

  it("برای سفارش تأخیری (ترانزیت گذشته)، بنر علت تأخیر + ETA جدید نمایش داده می‌شود", () => {
    // ارسال خیلی قدیمی که ترانزیت پست پیشتاز (حداکثر ۵ روز) رد شده
    render(
      <OrderTracking
        initialOrder={initialOrder({
          status: "SHIPPED",
          createdAt: daysAgo(15),
          statusHistory: [{ id: "h1", status: "SHIPPED", note: null, createdAt: daysAgo(15) }],
        })}
      />
    );
    expect(screen.getByText(/تأخیر در سفارش/)).toBeInTheDocument();
    expect(screen.getByText(/تحویل تخمینی جدید/)).toBeInTheDocument();
  });
});