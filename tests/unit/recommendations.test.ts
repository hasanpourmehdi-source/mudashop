// رتبه‌بندی «هم‌خریدی» (customers who bought this also bought) -- وزن تازگی
import { describe, expect, it } from "vitest";
import {
  rankFrequentlyBoughtTogether,
  RECENCY_DECAY_PER_DAY,
  type CoPurchaseOccurrence,
} from "@/lib/products";

const day = 86_400_000;
const now = new Date("2026-08-18T00:00:00.000Z");

describe("rankFrequentlyBoughtTogether", () => {
  it("بازگشت بر اساس فراوانی هم‌خریدی", () => {
    const occ: CoPurchaseOccurrence[] = [
      { productId: "B", createdAt: new Date(now.getTime() - 1 * day) },
      { productId: "B", createdAt: new Date(now.getTime() - 2 * day) },
      { productId: "C", createdAt: new Date(now.getTime() - 1 * day) },
    ];
    const ranked = rankFrequentlyBoughtTogether(occ, 4, now);
    expect(ranked.map((r) => r.productId)).toEqual(["B", "C"]);
  });

  it("خریدِ جدیدتر برندهٔ تساوی است (وزن تازگی)", () => {
    const occ: CoPurchaseOccurrence[] = [
      // C یک‌بار، دیروز -- A یک‌بار، یک سال پیش: هر دو یک بار ولی C تازه‌تر
      { productId: "C", createdAt: new Date(now.getTime() - 1 * day) },
      { productId: "A", createdAt: new Date(now.getTime() - 365 * day) },
    ];
    const ranked = rankFrequentlyBoughtTogether(occ, 4, now);
    expect(ranked[0].productId).toBe("C");
    expect(ranked[1].productId).toBe("A");
  });

  it("دو بارِ قدیمی وزنش از یک بارِ جدید بیشتر می‌مونه (نصف‌عمر منطقی)", () => {
    const occ: CoPurchaseOccurrence[] = [
      // دو خریدِ ۶۰ روز پیش (هر کدام وزن decay^60) در برابر یک خریدِ امروز
      { productId: "OLD", createdAt: new Date(now.getTime() - 60 * day) },
      { productId: "OLD", createdAt: new Date(now.getTime() - 60 * day) },
      { productId: "NEW", createdAt: now },
    ];
    const ranked = rankFrequentlyBoughtTogether(occ, 4, now);
    // 2 * 0.985^60 ≈ 2 * 0.402 = 0.804 < 1.0 (یک خرید امروز) => NEW اول است
    expect(ranked[0].productId).toBe("NEW");
    expect(ranked[1].productId).toBe("OLD");
  });

  it("حذف محصولاتِ خارج از limit و مرتب‌سازی نزولی", () => {
    const occ: CoPurchaseOccurrence[] = [
      { productId: "A", createdAt: now },
      { productId: "B", createdAt: now },
      { productId: "C", createdAt: now },
    ];
    const ranked = rankFrequentlyBoughtTogether(occ, 2, now);
    expect(ranked).toHaveLength(2);
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
  });

  it("خروجی خالی برای ورودی خالی", () => {
    expect(rankFrequentlyBoughtTogether([], 4, now)).toEqual([]);
  });

  it("آینده‌ی تاریخ‌سنج (createdAt جلوتر از now) به‌صورت روزِ صفر حساب می‌شه", () => {
    const occ: CoPurchaseOccurrence[] = [{ productId: "A", createdAt: new Date(now.getTime() + 5 * day) }];
    const ranked = rankFrequentlyBoughtTogether(occ, 4, now);
    expect(ranked[0].score).toBe(1);
  });

  it("ضریب تازگی بین ۰ و ۱ است", () => {
    expect(RECENCY_DECAY_PER_DAY).toBeGreaterThan(0);
    expect(RECENCY_DECAY_PER_DAY).toBeLessThan(1);
  });
});