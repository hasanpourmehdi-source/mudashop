// پوشش Gherkin: 14-cancellation-rules.feature (TC-14.1 تا TC-14.4)
import { describe, expect, it } from "vitest";
import { canCustomerCancelOrder } from "@/lib/orderCancellation";

describe("canCustomerCancelOrder -- قانون لغو سفارش", () => {
  it("TC-14.1: سفارش خالص مزون قبل از ارسال مستقیماً قابل لغو است", () => {
    for (const status of ["PENDING", "PROCESSING"]) {
      expect(
        canCustomerCancelOrder({ hasExternalItems: false, paymentStatus: "PENDING", status })
      ).toEqual({ mode: "direct" });
    }
  });

  it("TC-14.1: مزون SHIPPED/DELIVERED/RETURNED با پیام دقیق مسدود است", () => {
    for (const status of ["SHIPPED", "DELIVERED", "RETURNED"]) {
      const r = canCustomerCancelOrder({ hasExternalItems: false, paymentStatus: "PAID", status });
      expect(r).toEqual({ mode: "blocked", message: "سفارش ارسال‌شده قابل لغو نیست" });
    }
  });

  it("TC-14.2: خارجیِ PAID که هیچ قلمی خریداری نشده (در صف خرید) فقط «درخواست» لغو می‌دهد", () => {
    for (const status of ["PENDING", "PROCESSING"]) {
      const r = canCustomerCancelOrder({
        hasExternalItems: true,
        paymentStatus: "PAID",
        status,
        itemPurchaseStatuses: ["PENDING", "PENDING"],
      });
      expect(r).toEqual({ mode: "request" });
    }
  });

  it("خارجیِ تسویه‌نشده (قبل از واریز پول) مستقیماً قابل لغو است", () => {
    for (const paymentStatus of ["PENDING", "AWAITING_PAYMENT", "AWAITING_VERIFICATION", "FAILED"]) {
      const r = canCustomerCancelOrder({
        hasExternalItems: true,
        paymentStatus,
        status: "PROCESSING",
        itemPurchaseStatuses: ["PENDING"],
      });
      expect(r).toEqual({ mode: "direct" });
    }
  });

  it("TC-14.2: خارجیِ PAID که هنوز قلمش CANCELLED است (بعد از رفاند فوری) هم فقط درخواست می‌دهد", () => {
    const r = canCustomerCancelOrder({
      hasExternalItems: true,
      paymentStatus: "PAID",
      status: "PROCESSING",
      itemPurchaseStatuses: ["PENDING", "CANCELLED"],
    });
    expect(r).toEqual({ mode: "request" });
  });

  it("TC-14.3: به‌محض شروع خریدِ واقعی (حداقل یک PURCHASED) کل سفارش مسدود است", () => {
    const r = canCustomerCancelOrder({
      hasExternalItems: true,
      paymentStatus: "PAID",
      status: "PENDING",
      itemPurchaseStatuses: ["PENDING", "PURCHASED"],
    });
    expect(r.mode).toBe("blocked");
  });

  it("TC-14.4: خارجیِ PAID بعد از شروع خرید در هر وضعیتی مسدود است (لغو و درخواست هم نیست)", () => {
    for (const status of ["PENDING", "PROCESSING"]) {
      const r = canCustomerCancelOrder({
        hasExternalItems: true,
        paymentStatus: "PAID",
        status,
        itemPurchaseStatuses: ["PURCHASED"],
      });
      expect(r.mode).toBe("blocked");
      if (r.mode === "blocked") expect(r.message).toContain("خریدِ واقعی");
    }
    // برای SHIPPED/DELIVERED پیام مشترکِ «سفارش ارسال‌شده» زودتر (قبل از چک
    // purchaseStatus) رد می‌شه -- رفتار درسته، فقط پیامش فرق می‌کنه
    for (const status of ["SHIPPED", "DELIVERED"]) {
      const r = canCustomerCancelOrder({
        hasExternalItems: true,
        paymentStatus: "PAID",
        status,
        itemPurchaseStatuses: ["PURCHASED"],
      });
      expect(r).toEqual({ mode: "blocked", message: "سفارش ارسال‌شده قابل لغو نیست" });
    }
  });

  it("خارجیِ SHIPPED/DELIVERED حتی وقتی هیچ قلمی خریداری نشده (خریدِ واقعی شروع نشده) هم مسدود است -- دفاع لایه‌ی دوم", () => {
    // این دقیقاً همون سناریوییه که باگ واقعی داشت: set-shipping-cost قبلاً
    // بدون بررسیِ purchaseStatus اقلام قبول می‌شد، پس سفارش می‌تونست تا
    // SHIPPED/DELIVERED بره درحالی‌که همه‌ی اقلام هنوز PENDING بودن -- و چون
    // این تابع فقط purchaseStatus رو نگاه می‌کرد (نه status)، به‌اشتباه
    // mode:"request" برمی‌گردوند و مشتری می‌تونست سفارشِ تحویل‌داده‌شده رو لغو کنه
    for (const status of ["SHIPPED", "DELIVERED", "RETURNED"]) {
      const r = canCustomerCancelOrder({
        hasExternalItems: true,
        paymentStatus: "PAID",
        status,
        itemPurchaseStatuses: ["PENDING", "PENDING"],
      });
      expect(r).toEqual({ mode: "blocked", message: "سفارش ارسال‌شده قابل لغو نیست" });
    }
  });

  it("بدون آرایه‌ی purchaseStatus (سفارش قدیمی/بدون اطلاعات اقلام) محافظه‌کارانه مسدود است", () => {
    const r = canCustomerCancelOrder({ hasExternalItems: true, paymentStatus: "PAID", status: "PENDING" });
    expect(r.mode).toBe("blocked");
  });

  it("paymentStatus/status null امن است (سفارش ناقص مزون)", () => {
    expect(canCustomerCancelOrder({ hasExternalItems: false, paymentStatus: null, status: null }).mode).toBe("direct");
  });
});