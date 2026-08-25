// محاسبات گزارش‌های فروش/سود/نرخ تبدیل -- توابع خالص
import { describe, expect, it } from "vitest";
import {
  aggregateMonthly,
  buildLastNMonthsSkeleton,
  computeProfitMetrics,
  computeConversionRates,
  monthKey,
} from "@/lib/adminReportsCalc";

describe("aggregateMonthly", () => {
  const now = new Date(2026, 7, 15); // آگوست ۲۰۲۶

  it("۱۲ ماهِ آخر اسکلت دارد و نقاط خارج بازه حذف می‌شوند", () => {
    const result = aggregateMonthly(
      [
        { createdAt: new Date(2026, 7, 5), value: 100_000 },
        { createdAt: new Date(2026, 6, 1), value: 50_000 },
        { createdAt: new Date(2020, 0, 1), value: 999_999 }, // خیلی قدیمی -- نباید بیاید
      ],
      12,
      now
    );
    expect(result).toHaveLength(12);
    const aug = result.find((m) => m.label === "8/2026");
    expect(aug?.value).toBe(100_000);
    const jul = result.find((m) => m.label === "7/2026");
    expect(jul?.value).toBe(50_000);
    const total = result.reduce((s, m) => s + m.value, 0);
    expect(total).toBe(150_000);
  });

  it("روزهای بدون فروش صفر می‌مانند", () => {
    const result = aggregateMonthly([{ createdAt: new Date(2026, 7, 5), value: 10 }], 12, now);
    expect(result.filter((m) => m.value === 0).length).toBe(11);
  });
});

describe("buildLastNMonthsSkeleton", () => {
  it("ماه‌ها به ترتیب قدیم‌به‌جدیند و لیبل درست دارند", () => {
    const skeleton = buildLastNMonthsSkeleton(3, new Date(2026, 7, 15));
    const labels = Array.from(skeleton.values()).map((v) => v.label);
    expect(labels).toEqual(["6/2026", "7/2026", "8/2026"]);
  });

  it("monthKey دو رقمی می‌سازد", () => {
    expect(monthKey(new Date(2026, 0, 1))).toBe("2026-01");
    expect(monthKey(new Date(2025, 11, 31))).toBe("2025-12");
  });
});

describe("computeProfitMetrics", () => {
  it("سود = درآمد − تخفیف − ارسال/باربری − هزینه‌ی کالای خارجی", () => {
    const orders = [
      {
        total: 500_000,
        discountTotal: 20_000,
        shippingCost: 50_000,
        cargoCost: 30_000,
        items: [
          // کالای خارجی با قیمت خرید واقعی
          { price: 300_000, quantity: 1, purchasePriceActual: 180_000 },
          // کالای مزون -- هزینه مشخص نیست
          { price: 200_000, quantity: 1, purchasePriceActual: null },
        ],
      },
    ];
    const result = computeProfitMetrics(orders);
    expect(result.revenue).toBe(500_000);
    expect(result.discountTotalSum).toBe(20_000);
    expect(result.shippingCargoCostSum).toBe(80_000);
    expect(result.foreignCost).toBe(180_000);
    expect(result.foreignRevenue).toBe(300_000);
    expect(result.foreignProfit).toBe(120_000);
    expect(result.netProfit).toBe(500_000 - 20_000 - 80_000 - 180_000); // ۲۲۰٬۰۰۰
  });

  it("اقلام بدون قیمت خرید واقعی در هزینه‌ی خارجی صفر حساب می‌شوند", () => {
    const result = computeProfitMetrics([
      {
        total: 100_000,
        discountTotal: 0,
        shippingCost: null,
        cargoCost: null,
        items: [{ price: 100_000, quantity: 2, purchasePriceActual: null }],
      },
    ]);
    expect(result.foreignCost).toBe(0);
    expect(result.netProfit).toBe(100_000);
  });
});

describe("computeConversionRates", () => {
  it("نرخ تبدیل بازدید → خرید", () => {
    const c = computeConversionRates(10, 200, 5, 100);
    expect(c.visitorToOrder).toBe(0.05);
    expect(c.visitorToOrderPercent).toBe(5);
  });

  it("نرخ تبدیل کاربر → خریدار", () => {
    const c = computeConversionRates(0, 0, 25, 100);
    expect(c.customerConversion).toBe(0.25);
    expect(c.customerConversionPercent).toBe(25);
  });

  it("با صفر بودن مخرج، تقسیم بر صفر نمی‌شود", () => {
    const c = computeConversionRates(0, 0, 0, 0);
    expect(c.visitorToOrder).toBe(0);
    expect(c.customerConversion).toBe(0);
  });
});