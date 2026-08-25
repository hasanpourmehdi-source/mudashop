// توصیه‌گر محصول -- ایندکس هم‌رخدادی و رتبه‌بندی‌های خالص
import { describe, expect, it } from "vitest";
import {
  buildItemToItemIndex,
  recommendRelated,
  recommendPersonalized,
  type InteractionPair,
} from "@/lib/recommend";

// یوزرها و محصولاتی که با هم تعامل دارند:
//  u1: A, B, C  |  u2: A, B  |  u3: B, D  |  u4: E (تک)
const pairs: InteractionPair[] = [
  { userId: "u1", productId: "A", weight: 1 },
  { userId: "u1", productId: "B", weight: 1 },
  { userId: "u1", productId: "C", weight: 0.8 },
  { userId: "u2", productId: "A", weight: 1 },
  { userId: "u2", productId: "B", weight: 1 },
  { userId: "u3", productId: "B", weight: 1 },
  { userId: "u3", productId: "D", weight: 0.5 },
  { userId: "u4", productId: "E", weight: 1 },
];

describe("buildItemToItemIndex", () => {
  it("هم‌رخدادی‌ها را متقارن و جمع‌پذیر می‌سازد", () => {
    const index = buildItemToItemIndex(pairs);
    // A و B با هم توسط u1 و u2 دیده شده‌اند
    expect(index.get("A")!.get("B")).toBe(2);
    expect(index.get("B")!.get("A")).toBe(2);
    // B و C فقط توسط u1
    expect(index.get("B")!.get("C")).toBeCloseTo(Math.sqrt(1 * 0.8));
    // E هیچ هم‌رخدادی‌ای ندارد
    expect(index.get("E")).toBeUndefined();
  });

  it("یک کاربر با تعامل تکراری فقط یک‌بار شمرده می‌شود (ماکزیمم وزن)", () => {
    const dup = [
      { userId: "u1", productId: "A", weight: 1 },
      { userId: "u1", productId: "A", weight: 0.5 }, // دوباره، وزن کمتر
      { userId: "u1", productId: "B", weight: 1 },
    ];
    const index = buildItemToItemIndex(dup);
    expect(index.get("A")!.get("B")).toBe(1);
  });
});

describe("recommendRelated", () => {
  const index = buildItemToItemIndex(pairs);

  it("محصولات مشابه را بر اساس امتیاز مرتب می‌کند و خودش را حذف می‌کند", () => {
    const result = recommendRelated("A", index, new Set(), 10);
    expect(result[0].productId).toBe("B"); // A با B قوی‌ترین رابطه را دارد
    const ids = result.map((r) => r.productId);
    expect(ids).not.toContain("A");
  });

  it("محدودیت و حذف دستی را رعایت می‌کند", () => {
    const result = recommendRelated("B", index, new Set(["A"]), 2);
    expect(result.length).toBeLessThanOrEqual(2);
    expect(result.map((r) => r.productId)).not.toContain("A");
    expect(result.map((r) => r.productId)).not.toContain("B");
  });

  it("برای محصول بدون رابطه، خالی برمی‌گردد", () => {
    expect(recommendRelated("E", index, new Set(), 5)).toEqual([]);
  });
});

describe("recommendPersonalized", () => {
  const index = buildItemToItemIndex(pairs);

  it("امتیاز بذرهای کاربر را جمع می‌زند و بذرها را حذف می‌کند", () => {
    // کاربر به A و C علاقه دارد -> B از هر دو (۲ + sqrt(1*0.8)) و D از B
    const result = recommendPersonalized(["A", "C"], index, new Set(["A", "C"]), 10);
    expect(result[0].productId).toBe("B");
    const ids = result.map((r) => r.productId);
    expect(ids).not.toContain("A");
    expect(ids).not.toContain("C");
  });

  it("بی‌بذرها خالی برمی‌گردد", () => {
    expect(recommendPersonalized(["E"], index, new Set(["E"]), 5)).toEqual([]);
  });
});