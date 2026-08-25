import { describe, expect, it } from "vitest";
import {
  collectDescendantSlugs,
  expandSelectedSlugs,
  findNodeBySlug,
  type CategoryNode,
} from "@/lib/categories";

function node(id: string, slug: string, children: CategoryNode[] = []): CategoryNode {
  return { id, name: slug, slug, icon: null, children };
}

const tree: CategoryNode[] = [
  node("c1", "پوشاک", [
    node("c2", "مردانه", [node("c3", "پیراهن"), node("c4", "تی‌شرت")]),
    node("c5", "زنانه"),
  ]),
  node("c6", "کفش", [node("c7", "کفش مردانه")]),
];

describe("collectDescendantSlugs -- خود + همه‌ی زیرمجموعه‌ها", () => {
  it("به‌صورت DFS جمع می‌کند", () => {
    const node = tree[0];
    expect(collectDescendantSlugs(node)).toEqual([
      "پوشاک",
      "مردانه",
      "پیراهن",
      "تی‌شرت",
      "زنانه",
    ]);
  });

  it("گره بدون فرزند فقط خودش را دارد", () => {
    expect(collectDescendantSlugs(node("x", "تنها"))).toEqual(["تنها"]);
  });
});

describe("findNodeBySlug", () => {
  it("گره تودرتو را پیدا می‌کند", () => {
    const found = findNodeBySlug(tree, "پیراهن");
    expect(found?.id).toBe("c3");
  });

  it("برای اسلاگ ناموجود null برمی‌گرداند", () => {
    expect(findNodeBySlug(tree, "کیف")).toBeNull();
  });
});

describe("expandSelectedSlugs -- گسترش انتخاب به فرزندان", () => {
  it("هر انتخاب + همه‌ی فرزندانش، یکتا", () => {
    expect(expandSelectedSlugs(tree, ["مردانه"])).toEqual(["مردانه", "پیراهن", "تی‌شرت"]);
  });

  it("چند انتخاب می‌تواند هم‌پوشانی داشته باشد (dedupe)", () => {
    expect(expandSelectedSlugs(tree, ["پوشاک", "مردانه"])).toEqual([
      "پوشاک",
      "مردانه",
      "پیراهن",
      "تی‌شرت",
      "زنانه",
    ]);
  });

  it("اسلاگ پیدا‌نشده همان‌طور می‌ماند", () => {
    expect(expandSelectedSlugs(tree, ["کفش", "متفرقه"])).toEqual(["کفش", "کفش مردانه", "متفرقه"]);
  });

  it("ورودی خالی خروجی خالی دارد", () => {
    expect(expandSelectedSlugs(tree, [])).toEqual([]);
  });
});