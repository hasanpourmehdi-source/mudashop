// «اخیراً دیدهاید» -- منطق خالص لیست (dedupe، سقف تعداد، parse ایمن)
import { describe, expect, it } from "vitest";
import {
  addRecentlyViewed,
  removeRecentlyViewed,
  parseRecentlyViewed,
  serializeRecentlyViewed,
  MAX_RECENTLY_VIEWED,
  type RecentlyViewedProduct,
} from "@/lib/recentlyViewed";

function makeProduct(id: string, over: Partial<RecentlyViewedProduct> = {}): RecentlyViewedProduct {
  return {
    id,
    source: "MAZON",
    slugOrId: `slug-${id}`,
    title: `محصول ${id}`,
    image: `https://img/${id}.jpg`,
    price: 100000,
    originalPrice: 150000,
    discount: 0,
    href: `/products/mazon/slug-${id}`,
    viewedAt: "2026-08-18T00:00:00.000Z",
    ...over,
  };
}

describe("addRecentlyViewed", () => {
  it("محصول جدید در ابتدای لیست قرار می‌گیرد", () => {
    const list = [makeProduct("A"), makeProduct("B")];
    const next = addRecentlyViewed(list, makeProduct("C"));
    expect(next.map((p) => p.id)).toEqual(["C", "A", "B"]);
  });

  it("تکرارِ محصولِ دیده‌شده dedupe می‌شود و به ابتدا می‌رود", () => {
    const list = [makeProduct("A"), makeProduct("B")];
    const next = addRecentlyViewed(list, makeProduct("A"));
    expect(next.map((p) => p.id)).toEqual(["A", "B"]);
    expect(next).toHaveLength(2);
  });

  it("لیست به MAX_RECENTLY_VIEWED محدود می‌شود", () => {
    let list: RecentlyViewedProduct[] = [];
    for (let i = 0; i < MAX_RECENTLY_VIEWED + 5; i++) {
      list = addRecentlyViewed(list, makeProduct(`P${i}`));
    }
    expect(list).toHaveLength(MAX_RECENTLY_VIEWED);
    // جدیدترین‌ها (شماره‌های آخر) حفظ شدند
    expect(list[0].id).toBe(`P${MAX_RECENTLY_VIEWED + 4}`);
    expect(list.some((p) => p.id === "P0")).toBe(false);
  });

  it("viewedAt برای ورودیِ جدید بروزرسانی می‌شود", () => {
    const list = [makeProduct("A", { viewedAt: "2026-01-01T00:00:00.000Z" })];
    const next = addRecentlyViewed(list, makeProduct("A"));
    expect(next[0].viewedAt).not.toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("removeRecentlyViewed", () => {
  it("محصول موردنظر حذف می‌شود", () => {
    const list = [makeProduct("A"), makeProduct("B")];
    expect(removeRecentlyViewed(list, "A").map((p) => p.id)).toEqual(["B"]);
  });

  it("حذف آیتمِ موجود نبوده، لیست را عوض نمی‌کند", () => {
    const list = [makeProduct("A")];
    expect(removeRecentlyViewed(list, "X")).toHaveLength(1);
  });
});

describe("parseRecentlyViewed / serializeRecentlyViewed", () => {
  it("round-trip سالم", () => {
    const list = [makeProduct("A"), makeProduct("B", { source: "TRENDYOL" })];
    expect(parseRecentlyViewed(serializeRecentlyViewed(list))).toEqual(list);
  });

  it("null / رشته‌ی خالی / JSON نامعتبر -> []", () => {
    expect(parseRecentlyViewed(null)).toEqual([]);
    expect(parseRecentlyViewed("")).toEqual([]);
    expect(parseRecentlyViewed("not json")).toEqual([]);
  });

  it("غیرآرایه -> []", () => {
    expect(parseRecentlyViewed('{"a":1}')).toEqual([]);
  });

  it("ورودی‌های نامعتبر فیلتر می‌شوند، معتبرها می‌مانند", () => {
    const raw = JSON.stringify([
      makeProduct("A"),
      { id: 5, title: "بد" },
      "string",
      null,
    ]);
    const parsed = parseRecentlyViewed(raw);
    expect(parsed.map((p) => p.id)).toEqual(["A"]);
  });
});