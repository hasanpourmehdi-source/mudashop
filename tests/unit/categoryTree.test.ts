import { describe, expect, it } from "vitest";
import {
  categoryPath,
  effectiveCategoryAttributes,
  effectiveCategoryAttributeSettings,
  flattenCategoryTree,
  isDescendantCategory,
  type TreeCategory,
} from "@/lib/categoryTree";

// درخت نمونه:
// پوشاک (root)
// ├─ مردانه        <- depth 1
// │  └─ پیراهن     <- depth 2
// └─ زنانه         <- depth 1
// بچگانه (root دوم)
type Cat = { id: string; name: string; parentId: string | null };
const tree: Cat[] = [
  { id: "clothes", name: "پوشاک", parentId: null },
  { id: "men", name: "مردانه", parentId: "clothes" },
  { id: "shirt", name: "پیراهن", parentId: "men" },
  { id: "women", name: "زنانه", parentId: "clothes" },
  { id: "kids", name: "بچگانه", parentId: null },
];

describe("flattenCategoryTree -- نظم DFS با عمق", () => {
  it("مطابق ترتیب درختی (DFS) و depth صحیح ردیف می‌شود", () => {
    const flat = flattenCategoryTree(tree);
    expect(flat.map((c) => c.id)).toEqual(["clothes", "men", "shirt", "women", "kids"]);
    const depth = Object.fromEntries(flat.map((c) => [c.id, c.depth]));
    expect(depth).toEqual({ clothes: 0, men: 1, shirt: 2, women: 1, kids: 0 });
  });

  it("دسته با parentId ناموجود (یتیم) در انتها با depth=0 می‌ماند", () => {
    const withOrphan: Cat[] = [
      { id: "a", name: "A", parentId: null },
      { id: "b", name: "B", parentId: "missing" },
    ];
    const flat = flattenCategoryTree(withOrphan);
    expect(flat.map((c) => c.id)).toEqual(["a", "b"]);
    expect(flat.find((c) => c.id === "b")?.depth).toBe(0);
  });

  it("ورودی خالی درخت خالی برمی‌گرداند", () => {
    expect(flattenCategoryTree([])).toEqual([]);
  });
});

describe("isDescendantCategory", () => {
  it("فرزندِ مستقیم یا غیرمستقیم true است", () => {
    expect(isDescendantCategory(tree, "clothes", "men")).toBe(true);
    expect(isDescendantCategory(tree, "clothes", "shirt")).toBe(true);
  });

  it("خودِ دسته یا رقبا/شاخه‌های دیگر false هستند", () => {
    expect(isDescendantCategory(tree, "men", "men")).toBe(false);
    expect(isDescendantCategory(tree, "clothes", "kids")).toBe(false);
    expect(isDescendantCategory(tree, "men", "women")).toBe(false);
  });

  it("برای ancestor یا candidate ناموجود false است", () => {
    expect(isDescendantCategory(tree, "nope", "shirt")).toBe(false);
    expect(isDescendantCategory(tree, "clothes", "nope")).toBe(false);
  });
});

describe("categoryPath", () => {
  it("مسیر ریشه‌تا-خود را با جداکننده می‌سازد", () => {
    expect(categoryPath(tree, "shirt")).toBe("پوشاک › مردانه › پیراهن");
    expect(categoryPath(tree, "men")).toBe("پوشاک › مردانه");
    expect(categoryPath(tree, "clothes")).toBe("پوشاک");
  });

  it("برای دسته‌ی ناشناخته رشته‌ی خالی برمی‌گرداند", () => {
    expect(categoryPath(tree, "nope")).toBe("");
  });
});

describe("effectiveCategoryAttributes -- ارث‌بری ویژگی از والدها", () => {
  type ACat = TreeCategory & { attributes: { attribute: { id: string } }[] };
  const cats: ACat[] = [
    { id: "clothes", name: "پوشاک", parentId: null, attributes: [{ attribute: { id: "gender" } }] },
    { id: "men", name: "مردانه", parentId: "clothes", attributes: [{ attribute: { id: "size" } }] },
    { id: "shirt", name: "پیراهن", parentId: "men", attributes: [{ attribute: { id: "size" } }] },
  ];

  it("ویژگی‌های خود + والدها جمع می‌شوند و تکراری حذف می‌شود", () => {
    const ids = effectiveCategoryAttributes(cats, "shirt").map((a) => a.id);
    expect(ids).toEqual(["size", "gender"]);
  });

  it("دسته بدون والد فقط ویژگی‌های خودش را دارد", () => {
    const ids = effectiveCategoryAttributes(cats, "clothes").map((a) => a.id);
    expect(ids).toEqual(["gender"]);
  });

  it("برای دسته ناشناخته خالی برمی‌گرداند", () => {
    expect(effectiveCategoryAttributes(cats, "nope")).toEqual([]);
  });
});

describe("effectiveCategoryAttributeSettings -- مقدار ثابت، نزدیک‌ترین سطح برنده است", () => {
  type SCat = TreeCategory & {
    attributes: { attribute: { id: string; name: string }; fixedValue: string | null }[];
  };
  const cats: SCat[] = [
    {
      id: "clothes",
      name: "پوشاک",
      parentId: null,
      attributes: [{ attribute: { id: "gender", name: "جنسیت" }, fixedValue: "زنانه" }],
    },
    {
      id: "men",
      name: "مردانه",
      parentId: "clothes",
      attributes: [{ attribute: { id: "gender", name: "جنسیت" }, fixedValue: "مردانه" }],
    },
    {
      id: "shirt",
      name: "پیراهن",
      parentId: "men",
      attributes: [{ attribute: { id: "size", name: "سایز" }, fixedValue: null }],
    },
  ];

  it("مقدار ثابتِ نزدیک‌ترین سطح به خود دسته برنده می‌شود", () => {
    const settings = effectiveCategoryAttributeSettings(cats, "shirt");
    const gender = settings.find((s) => s.attributeId === "gender");
    expect(gender?.fixedValue).toBe("مردانه");
    expect(settings.find((s) => s.attributeId === "size")?.fixedValue).toBeNull();
  });

  it("دسته‌ی ریشه فقط مقدار خودش را دارد", () => {
    const settings = effectiveCategoryAttributeSettings(cats, "clothes");
    expect(settings).toHaveLength(1);
    expect(settings[0]).toMatchObject({ attributeId: "gender", fixedValue: "زنانه" });
  });
});