// تست‌های "همه‌ی حالت‌ها" برای توابع خالصِ تصمیم‌گیریِ چرخه‌ی سفارش خارجی.
// برخلاف تست‌های معمولِ orderCancellation.test.ts/orderPurchaseStatus.test.ts
// (که چندتا نمونه‌ی نماینده رو چک می‌کنن)، این فایل واقعاً *تمامِ* ترکیب‌های
// ممکنِ enum ورودی‌ها رو رد می‌کنه -- چون دامنه‌ی این توابع کوچیکه (چندتا enum ×
// boolean)، این کار صددرصد ممکنه، نه فقط یه نمونه‌گیری. هدف: قبل از این‌که
// یه ترکیبِ نادر (که دستی هیچ‌وقت امتحان نمی‌شد) توی production باگ بشه، همین‌جا
// گیر بیفته.
import { describe, expect, it } from "vitest";
import { canCustomerCancelOrder, PURCHASE_STARTED_STATUSES } from "@/lib/orderCancellation";
import { computePurchaseSummary, type PurchaseTrackedItem } from "@/lib/orderPurchaseStatus";
import { determineOrderStage, type AlertableOrder, type OrderStage } from "@/lib/orderAlerts";
import { isPaymentComplete, type PaymentDeadlineOrder } from "@/lib/orderPaymentDeadline";

const ORDER_STATUSES = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"] as const;
const PAYMENT_STATUSES = ["PENDING", "AWAITING_PAYMENT", "AWAITING_VERIFICATION", "PAID", "FAILED"] as const;
const ITEM_PURCHASE_STATUSES = [
  "PENDING",
  "PURCHASED",
  "RECEIVED",
  "CANCELLED",
  "LOST",
  "WRONG_SIZE",
  "WRONG_COLOR",
  "ISSUE_OTHER",
  "AWAITING_CUSTOMER_DECISION",
] as const;

describe("canCustomerCancelOrder -- کارتزینِ کاملِ ورودی‌ها", () => {
  const paymentStatusVariants: (string | null)[] = [...PAYMENT_STATUSES, null];
  const statusVariants: (string | null)[] = [...ORDER_STATUSES, null];
  const itemPurchaseStatusVariants: (string[] | undefined)[] = [
    undefined,
    [],
    ...ITEM_PURCHASE_STATUSES.map((s) => [s]),
  ];

  it("هیچ ترکیبی خطا نمی‌ده و همیشه یه mode معتبر برمی‌گردونه", () => {
    let checked = 0;
    for (const hasExternalItems of [true, false]) {
      for (const paymentStatus of paymentStatusVariants) {
        for (const status of statusVariants) {
          for (const itemPurchaseStatuses of itemPurchaseStatusVariants) {
            const r = canCustomerCancelOrder({ hasExternalItems, paymentStatus, status, itemPurchaseStatuses });
            expect(["direct", "request", "blocked"]).toContain(r.mode);
            if (r.mode === "blocked") {
              expect(typeof r.message).toBe("string");
              expect(r.message.length).toBeGreaterThan(0);
            }
            checked++;
          }
        }
      }
    }
    // 2 × 6 × 7 × 11 = 924 -- اگه این عدد فرق کرد یعنی دامنه‌ی enumها عوض شده،
    // باید لیست بالا رو هم به‌روز کرد (نه فقط این عدد رو)
    expect(checked).toBe(924);
  });

  it("اینورینت: سفارشِ SHIPPED/DELIVERED/RETURNED همیشه مسدوده -- صرف‌نظر از باقیِ ورودی‌ها (رگرسیونِ باگِ واقعی این پروژه)", () => {
    for (const hasExternalItems of [true, false]) {
      for (const paymentStatus of paymentStatusVariants) {
        for (const status of ["SHIPPED", "DELIVERED", "RETURNED"]) {
          for (const itemPurchaseStatuses of itemPurchaseStatusVariants) {
            const r = canCustomerCancelOrder({ hasExternalItems, paymentStatus, status, itemPurchaseStatuses });
            expect(r.mode, `hasExternalItems=${hasExternalItems} paymentStatus=${paymentStatus} status=${status} items=${itemPurchaseStatuses}`).toBe(
              "blocked"
            );
          }
        }
      }
    }
  });

  it("اینورینت: وقتی خارجی+PAID+حداقل یه قلم در جریانِ خرید، هیچ‌وقت direct نیست", () => {
    for (const status of statusVariants) {
      for (const itemPurchaseStatuses of itemPurchaseStatusVariants) {
        if (!itemPurchaseStatuses || !itemPurchaseStatuses.some((s) => PURCHASE_STARTED_STATUSES.has(s))) continue;
        const r = canCustomerCancelOrder({
          hasExternalItems: true,
          paymentStatus: "PAID",
          status,
          itemPurchaseStatuses,
        });
        expect(r.mode).not.toBe("direct");
      }
    }
  });

  it("اینورینت: خارجی+PAID هیچ‌وقت direct نیست (یا request یا blocked)", () => {
    for (const status of statusVariants) {
      for (const itemPurchaseStatuses of itemPurchaseStatusVariants) {
        const r = canCustomerCancelOrder({
          hasExternalItems: true,
          paymentStatus: "PAID",
          status,
          itemPurchaseStatuses,
        });
        expect(r.mode).not.toBe("direct");
      }
    }
  });
});

describe("computePurchaseSummary -- کارتزینِ کاملِ آرایه‌های ۰/۱/۲ قلمی", () => {
  const SOURCES = ["MAZON", "TRENDYOL"] as const;

  function* singleItemVariants(): Generator<PurchaseTrackedItem> {
    for (const source of SOURCES) {
      for (const purchaseStatus of ITEM_PURCHASE_STATUSES) {
        yield { source, purchaseStatus, quantity: 1 };
      }
    }
  }

  it("هیچ ترکیبی خطا نمی‌ده و شمارش‌ها همیشه consistent‌ان", () => {
    const singles = [...singleItemVariants()];
    const arrays: PurchaseTrackedItem[][] = [
      [],
      ...singles.map((i) => [i]),
      ...singles.flatMap((a) => singles.map((b) => [a, b])),
    ];
    expect(arrays.length).toBe(1 + 18 + 18 * 18); // 1 + 18 + 324 = 343

    for (const items of arrays) {
      const summary = computePurchaseSummary(items);
      const external = items.filter((i) => i.source === "TRENDYOL");

      expect(summary.total).toBe(external.length);
      expect(summary.purchased + summary.cancelled + summary.pending).toBe(summary.total);
      expect(summary.allResolved).toBe(summary.pending === 0);

      if (summary.allCancelled) {
        expect(summary.total).toBeGreaterThan(0);
        expect(external.every((i) => i.purchaseStatus === "CANCELLED")).toBe(true);
      }
      if (summary.allArrived) {
        expect(summary.total).toBeGreaterThan(0);
        const TERMINAL = new Set(["CANCELLED", "RECEIVED", "LOST", "WRONG_SIZE", "WRONG_COLOR", "ISSUE_OTHER"]);
        expect(external.every((i) => TERMINAL.has(i.purchaseStatus))).toBe(true);
        // اینورینتِ رگرسیونِ باگ: PURCHASED یا AWAITING_CUSTOMER_DECISION هیچ‌وقت
        // نباید باعث allArrived=true بشن (این دقیقاً همون گپی بود که
        // set-shipping-cost رو قبل از فیکس دور می‌زد)
        expect(external.some((i) => i.purchaseStatus === "PURCHASED" || i.purchaseStatus === "AWAITING_CUSTOMER_DECISION")).toBe(
          false
        );
      }
    }
  });
});

describe("determineOrderStage -- کارتزینِ کاملِ ابعادِ گسسته", () => {
  const RETURN_STATUSES: (string | null)[] = [null, "PENDING", "APPROVED", "REJECTED", "ITEM_RECEIVED", "REFUNDED"];
  const NEGOTIATION_STATUSES = ["AGREED", "AWAITING_CUSTOMER_REVIEW", "AWAITING_ADMIN_REVIEW"] as const;
  const SHIPPING_PAYMENT_STATUSES: (string | null)[] = [
    null,
    "AWAITING_PAYMENT",
    "AWAITING_VERIFICATION",
    "PAID",
    "FAILED",
  ];
  const VALID_STAGES: (OrderStage | null)[] = [
    null,
    "AWAITING_FIRST_REVIEW",
    "AWAITING_ITEM_PAYMENT_REVIEW",
    "AWAITING_SHIPPING_PAYMENT_REVIEW",
    "AWAITING_PURCHASE",
    "AWAITING_ADMIN_ITEMS_REVIEW",
    "SHIPPED_TOO_LONG",
    "AWAITING_RETURN_REVIEW",
  ];

  const FIXED_DATE = new Date("2026-01-01T00:00:00.000Z");

  function buildOrder(opts: {
    status: string;
    paymentStatus: string;
    itemsNegotiationStatus: string;
    shippingPaymentStatus: string | null;
    returnStatus: string | null;
    hasExternalItems: boolean;
  }): AlertableOrder {
    return {
      id: "order_test",
      status: opts.status,
      paymentStatus: opts.paymentStatus,
      itemsNegotiationStatus: opts.itemsNegotiationStatus,
      itemsNegotiationRespondedAt: FIXED_DATE,
      paidAt: FIXED_DATE,
      receiptSubmittedAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
      createdAt: FIXED_DATE,
      items: [{ source: opts.hasExternalItems ? "TRENDYOL" : "MAZON" }],
      shippingPayment: opts.shippingPaymentStatus
        ? { status: opts.shippingPaymentStatus, receiptSubmittedAt: FIXED_DATE }
        : null,
      statusHistory: [{ status: "SHIPPED", createdAt: FIXED_DATE }],
      returnRequest: opts.returnStatus ? { status: opts.returnStatus, updatedAt: FIXED_DATE } : null,
    };
  }

  it("هیچ ترکیبی خطا نمی‌ده و stage همیشه یکی از مقادیرِ شناخته‌شده‌ست", () => {
    let checked = 0;
    for (const status of ORDER_STATUSES) {
      for (const paymentStatus of PAYMENT_STATUSES) {
        for (const itemsNegotiationStatus of NEGOTIATION_STATUSES) {
          for (const shippingPaymentStatus of SHIPPING_PAYMENT_STATUSES) {
            for (const returnStatus of RETURN_STATUSES) {
              for (const hasExternalItems of [true, false]) {
                const order = buildOrder({
                  status,
                  paymentStatus,
                  itemsNegotiationStatus,
                  shippingPaymentStatus,
                  returnStatus,
                  hasExternalItems,
                });
                const { stage } = determineOrderStage(order);
                expect(VALID_STAGES, JSON.stringify(order)).toContain(stage);
                checked++;
              }
            }
          }
        }
      }
    }
    // 6 × 5 × 3 × 5 × 6 × 2 = 5400
    expect(checked).toBe(5400);
  });

  it("اینورینت: مرجوعیِ در جریان (PENDING/APPROVED/ITEM_RECEIVED) همیشه اولویت داره", () => {
    for (const status of ORDER_STATUSES) {
      for (const returnStatus of ["PENDING", "APPROVED", "ITEM_RECEIVED"]) {
        const order = buildOrder({
          status,
          paymentStatus: "PAID",
          itemsNegotiationStatus: "AGREED",
          shippingPaymentStatus: null,
          returnStatus,
          hasExternalItems: false,
        });
        expect(determineOrderStage(order).stage).toBe("AWAITING_RETURN_REVIEW");
      }
    }
  });
});

describe("isPaymentComplete -- کارتزینِ کامل", () => {
  const SHIPPING_STATUSES: (string | null)[] = [null, "AWAITING_PAYMENT", "AWAITING_VERIFICATION", "PAID", "FAILED"];

  function buildOrder(paymentStatus: string, hasExternalItems: boolean, shippingStatus: string | null): PaymentDeadlineOrder {
    return {
      id: "order_test",
      status: "PROCESSING",
      paymentStatus,
      paymentDeadlineAt: null,
      hasExternalItems,
      items: [],
      shippingPayment: shippingStatus ? { status: shippingStatus } : null,
    };
  }

  it("هیچ ترکیبی خطا نمی‌ده و اینورینت‌های پایه برقرارن", () => {
    for (const paymentStatus of PAYMENT_STATUSES) {
      for (const hasExternalItems of [true, false]) {
        for (const shippingStatus of SHIPPING_STATUSES) {
          const order = buildOrder(paymentStatus, hasExternalItems, shippingStatus);
          const result = isPaymentComplete(order);
          expect(typeof result).toBe("boolean");
          if (paymentStatus !== "PAID") expect(result).toBe(false);
          if (hasExternalItems && shippingStatus && shippingStatus !== "PAID") expect(result).toBe(false);
          if (!hasExternalItems && paymentStatus === "PAID") expect(result).toBe(true);
        }
      }
    }
  });
});
