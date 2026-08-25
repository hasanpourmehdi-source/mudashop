// تاریخچه قیمت -- روزانه‌کردن عکس‌ها + نمونه‌برداری + آمار (خالص)
import { describe, expect, it } from "vitest";
import { buildPriceHistory, pickEvenly } from "@/lib/priceHistory";

function snap(day: number, price: number) {
  return { price, recordedAt: new Date(Date.UTC(2026, 7, day, 12)).toISOString() };
}

describe("buildPriceHistory", () => {
  it("خالی -> خلاصه‌ی بدون نقطه", () => {
    const s = buildPriceHistory([], 100_000);
    expect(s.points).toEqual([]);
    expect(s.dayCount).toBe(0);
  });

  it("هر روز یک نقطه می‌ماند (آخرین عکس همان روز)", () => {
    const s = buildPriceHistory(
      [
        snap(1, 100_000),
        snap(1, 90_000), // همان روز -- باید جایگزین شود
        snap(2, 95_000),
      ],
      90_000
    );
    expect(s.points).toHaveLength(2);
    expect(s.points[0].price).toBe(90_000);
    expect(s.points[1].price).toBe(95_000);
  });

  it("به‌ترتیب زمانی مرتب می‌شود حتی اگر ورودی نامرتب باشد", () => {
    const s = buildPriceHistory([snap(3, 80_000), snap(1, 100_000), snap(2, 90_000)], 80_000);
    expect(s.points.map((p) => p.price)).toEqual([100_000, 90_000, 80_000]);
  });

  it("آمار کمترین/بیشترین/میانگین درست محاسبه می‌شود", () => {
    const s = buildPriceHistory([snap(1, 100_000), snap(2, 120_000), snap(3, 110_000)], 110_000);
    expect(s.min).toBe(100_000);
    expect(s.max).toBe(120_000);
    expect(s.avg).toBe(110_000);
  });

  it("پرچم کمترین/بیشترین بودن قیمت فعلی", () => {
    expect(buildPriceHistory([snap(1, 100_000), snap(2, 120_000)], 99_000).isLowest).toBe(true);
    expect(buildPriceHistory([snap(1, 100_000), snap(2, 120_000)], 130_000).isHighest).toBe(true);
    expect(buildPriceHistory([snap(1, 100_000), snap(2, 120_000)], 110_000).isLowest).toBe(false);
  });

  it("نمونه‌برداری وقتی روزها از سقف بیشتر است", () => {
    const many = Array.from({ length: 90 }, (_, i) => snap(i + 1, 100_000 + i * 1000));
    const s = buildPriceHistory(many, 200_000, 30);
    expect(s.points).toHaveLength(30);
    // اول و آخر حفظ می‌شوند
    expect(s.points[0].price).toBe(100_000);
    expect(s.points[29].price).toBe(100_000 + 89 * 1000);
    expect(s.dayCount).toBe(90);
  });
});

describe("pickEvenly", () => {
  it("اگر لیست کوتاه‌تر از n است همه برمی‌گردد", () => {
    expect(pickEvenly([1, 2, 3], 5)).toEqual([1, 2, 3]);
  });

  it("نمونه‌برداری یکنواخت با حفظ اول و آخر", () => {
    const out = pickEvenly([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4);
    expect(out[0]).toBe(1);
    expect(out[out.length - 1]).toBe(10);
    expect(out).toHaveLength(4);
  });
});