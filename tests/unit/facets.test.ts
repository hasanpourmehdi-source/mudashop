import { describe, expect, it } from "vitest";
import { buildAvailableFacets } from "@/lib/facets";

describe("buildAvailableFacets -- ادغام مقادیر فیلتر روی چند محصول", () => {
  it("مقادیر کسرشده از چند محصول را جمع می‌کند و تکراری حذف می‌کند", () => {
    const facets = buildAvailableFacets({
      p1: { جنسیت: ["زنانه"], "سایز لباس": ["M", "L"] },
      p2: { جنسیت: ["زنانه"], "سایز لباس": ["M"] },
      p3: { جنسیت: ["مردانه"], رنگ: ["مشکی"] },
    });
    expect(facets).toEqual({
      جنسیت: ["زنانه", "مردانه"],
      "سایز لباس": ["M", "L"],
      رنگ: ["مشکی"],
    });
  });

  it("ورودی خالی خروجی خالی دارد", () => {
    expect(buildAvailableFacets({})).toEqual({});
  });

  it("محصول بدون facet (صرفاً یه implicit empty) اثری ندارد", () => {
    expect(buildAvailableFacets({ a: {}, b: { جنسیت: ["زنانه"] } })).toEqual({
      جنسیت: ["زنانه"],
    });
  });
});