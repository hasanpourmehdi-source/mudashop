// امکانات نقد -- توزیع امتیاز + فیلتر/مرتب‌سازی + آمار «مفید بود» (خالص)
import { describe, expect, it } from "vitest";
import { buildRatingBreakdown, filterAndSortReviews, computeHelpfulStats } from "@/lib/reviewStats";

function review(id: string, rating: number, createdAt: string, isApproved = true) {
  return { id, rating, createdAt, isApproved };
}

describe("buildRatingBreakdown", () => {
  it("توزیع از ۵ به ۱ با درصد درست محاسبه می‌شود", () => {
    const out = buildRatingBreakdown([
      review("a", 5, "2026-08-01"),
      review("b", 5, "2026-08-02"),
      review("c", 4, "2026-08-03"),
      review("d", 1, "2026-08-04"),
    ]);
    expect(out.map((b) => b.star)).toEqual([5, 4, 3, 2, 1]);
    expect(out.find((b) => b.star === 5)?.count).toBe(2);
    expect(out.find((b) => b.star === 5)?.pct).toBe(50);
    expect(out.find((b) => b.star === 1)?.pct).toBe(25);
    expect(out.find((b) => b.star === 3)?.pct).toBe(0);
  });

  it("نظرات تاییدنشده در توزیع محاسبه نمی‌شوند", () => {
    const out = buildRatingBreakdown([
      review("a", 5, "2026-08-01"),
      review("b", 1, "2026-08-02", false),
    ]);
    expect(out.find((b) => b.star === 5)?.count).toBe(1);
    expect(out.find((b) => b.star === 5)?.pct).toBe(100);
    expect(out.find((b) => b.star === 1)?.count).toBe(0);
  });

  it("بدون نظر -> همه‌ی درصدها صفر", () => {
    const out = buildRatingBreakdown([]);
    expect(out.every((b) => b.count === 0 && b.pct === 0)).toBe(true);
  });
});

describe("filterAndSortReviews", () => {
  const reviews = [
    review("a", 5, "2026-08-10"),
    review("b", 2, "2026-08-05"),
    review("c", 4, "2026-08-08"),
    review("d", 3, "2026-08-12"),
  ];

  it("فیلتر حداقل امتیاز", () => {
    const out = filterAndSortReviews(reviews, { minRating: 4, sort: "newest" });
    expect(out.map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("minRating=0 یعنی همه", () => {
    expect(filterAndSortReviews(reviews, { minRating: 0, sort: "newest" })).toHaveLength(4);
  });

  it("مرتب‌سازی جدیدترین/قدیمی‌ترین", () => {
    expect(filterAndSortReviews(reviews, { minRating: 0, sort: "newest" }).map((r) => r.id)).toEqual([
      "d",
      "a",
      "c",
      "b",
    ]);
    expect(filterAndSortReviews(reviews, { minRating: 0, sort: "oldest" }).map((r) => r.id)).toEqual([
      "b",
      "c",
      "a",
      "d",
    ]);
  });

  it("مرتب‌سازی بیشترین/کمترین امتیاز", () => {
    expect(filterAndSortReviews(reviews, { minRating: 0, sort: "highest" }).map((r) => r.id)).toEqual([
      "a",
      "c",
      "d",
      "b",
    ]);
    expect(filterAndSortReviews(reviews, { minRating: 0, sort: "lowest" }).map((r) => r.id)).toEqual([
      "b",
      "d",
      "c",
      "a",
    ]);
  });

  it("آرایه‌ی ورودی دست‌نخورده می‌ماند", () => {
    const copy = [...reviews];
    filterAndSortReviews(reviews, { minRating: 0, sort: "highest" });
    expect(reviews.map((r) => r.id)).toEqual(copy.map((r) => r.id));
  });
});

describe("computeHelpfulStats", () => {
  it("تعداد رأی + رأی کاربر فعلی", () => {
    const votes = [{ userId: "u1" }, { userId: "u2" }];
    expect(computeHelpfulStats(votes, "u1")).toEqual({ helpfulCount: 2, votedByMe: true });
    expect(computeHelpfulStats(votes, "u3")).toEqual({ helpfulCount: 2, votedByMe: false });
    expect(computeHelpfulStats(votes, null)).toEqual({ helpfulCount: 2, votedByMe: false });
  });

  it("بدون رأی", () => {
    expect(computeHelpfulStats([], "u1")).toEqual({ helpfulCount: 0, votedByMe: false });
  });
});