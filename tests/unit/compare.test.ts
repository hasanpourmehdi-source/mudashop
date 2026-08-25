// مقایسه محصولات -- مدیریت لیست + ساخت جدول مقایسه (هر دو خالص)
import { describe, expect, it } from "vitest";
import {
  addToCompare,
  removeFromCompare,
  containsCompare,
  MAX_COMPARE_COUNT,
  buildComparisonTable,
  orderedUnion,
  type CompareProduct,
} from "@/lib/compare";

function product(overrides: Partial<CompareProduct> = {}): CompareProduct {
  return {
    id: "p1",
    slug: "p1",
    title: "محصول یک",
    image: "/img1.jpg",
    price: 100_000,
    originalPrice: 120_000,
    discount: 10,
    brand: "برند A",
    categoryName: "پوشاک",
    fastShipping: false,
    rating: { avg: 4.5, count: 10 },
    specifications: [],
    attributes: [],
    ...overrides,
  };
}

describe("مدیریت لیست مقایسه", () => {
  it("addToCompare جدید را اول قرار می‌دهد", () => {
    expect(addToCompare(["a", "b"], "c")).toEqual(["c", "a", "b"]);
  });

  it("addToCompare تکراری را جابه‌جا می‌کند نه دوباره اضافه", () => {
    expect(addToCompare(["a", "b", "c"], "b")).toEqual(["b", "a", "c"]);
  });

  it("سقف تعداد مقایسه رعایت می‌شود", () => {
    const list = ["1", "2", "3", "4"];
    expect(addToCompare(list, "5")).toEqual(["5", "1", "2", "3"]);
    expect(addToCompare(list, "5")).toHaveLength(MAX_COMPARE_COUNT);
  });

  it("removeFromCompare و containsCompare", () => {
    expect(removeFromCompare(["a", "b"], "a")).toEqual(["b"]);
    expect(containsCompare(["a", "b"], "b")).toBe(true);
    expect(containsCompare(["a"], "x")).toBe(false);
  });
});

describe("orderedUnion", () => {
  it("ترتیب اولین ظهور بین چند لیست حفظ می‌شود", () => {
    expect(orderedUnion([["جنس", "رنگ"], ["سایز", "جنس"], ["رنگ", "وزن"]])).toEqual([
      "جنس",
      "رنگ",
      "سایز",
      "وزن",
    ]);
  });
});

describe("buildComparisonTable", () => {
  it("ردیف‌های ثابت به ترتیب ساخته می‌شوند", () => {
    const rows = buildComparisonTable([product()]);
    const keys = rows.map((r) => r.key);
    expect(keys.slice(0, 8)).toEqual([
      "image",
      "title",
      "price",
      "discount",
      "brand",
      "category",
      "rating",
      "shipping",
    ]);
  });

  it("قیمت با تخفیف به‌درستی فرمت می‌شود", () => {
    const rows = buildComparisonTable([product()]);
    const priceRow = rows.find((r) => r.key === "price")!;
    expect(priceRow.values[0]).toContain("تومان");
  });

  it("اتحاد مشخصات فنی بین محصولات ساخته می‌شود و جای خالی «—» است", () => {
    const p1 = product({ id: "p1", specifications: [{ label: "جنس", value: "کتان" }] });
    const p2 = product({
      id: "p2",
      specifications: [
        { label: "جنس", value: "پلی‌استر" },
        { label: "وزن", value: "۳۰۰ گرم" },
      ],
    });
    const rows = buildComparisonTable([p1, p2]);
    const jens = rows.find((r) => r.key === "spec:جنس")!;
    const vazn = rows.find((r) => r.key === "spec:وزن")!;
    expect(jens.values).toEqual(["کتان", "پلی‌استر"]);
    expect(vazn.values).toEqual([null, "۳۰۰ گرم"]);
  });

  it("اتحاد ویژگی‌ها (سایز/رنگ) به‌درستی ساخته می‌شود", () => {
    const p1 = product({ id: "p1", attributes: [{ name: "سایز", values: ["S", "M"] }] });
    const p2 = product({
      id: "p2",
      attributes: [
        { name: "سایز", values: ["L"] },
        { name: "رنگ", values: ["قرمز", "آبی"] },
      ],
    });
    const rows = buildComparisonTable([p1, p2]);
    const size = rows.find((r) => r.key === "attr:سایز")!;
    const color = rows.find((r) => r.key === "attr:رنگ")!;
    expect(size.values).toEqual(["S، M", "L"]);
    expect(color.values).toEqual([null, "قرمز، آبی"]);
  });
});