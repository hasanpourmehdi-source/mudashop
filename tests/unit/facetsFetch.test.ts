import { afterEach, describe, expect, it, vi } from "vitest";

function setupPrismaMock(overrides: Record<string, unknown>) {
  const mock = {
    product: {
      findMany: vi.fn().mockResolvedValue([]),
      ...(overrides.product ?? {}),
    },
    productVariantValue: {
      findMany: vi.fn().mockResolvedValue([]),
      ...(overrides.productVariantValue ?? {}),
    },
    categoryAttribute: {
      findMany: vi.fn().mockResolvedValue([]),
      ...(overrides.categoryAttribute ?? {}),
    },
    category: {
      findMany: vi.fn().mockResolvedValue([]),
      ...(overrides.category ?? {}),
    },
    attribute: {
      findMany: vi.fn().mockResolvedValue([]),
      ...(overrides.attribute ?? {}),
    },
  };
  vi.doMock("@/lib/prisma", () => ({ prisma: mock }));
}

async function importFresh() {
  return await import("@/lib/facets");
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/prisma");
});

describe("fetchProductFacets", () => {
  it("محصولات ترندیول نادیده گرفته می‌شوند و نتیجه خالی است", async () => {
    setupPrismaMock({});
    const { fetchProductFacets } = await importFresh();
    const result = await fetchProductFacets([{ id: "ty-1", source: "TRENDYOL" }] as never);
    expect(result).toEqual({});
  });

  it("ویژگی ثابتِ ارث‌برده از والدِ دسته، به محصول می‌رسد", async () => {
    setupPrismaMock({
      product: { findMany: vi.fn().mockResolvedValue([{ id: "p1", categoryId: "child" }]) },
      productVariantValue: { findMany: vi.fn().mockResolvedValue([]) },
      categoryAttribute: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { fixedValue: "زنانه", categoryId: "parent", attribute: { name: "جنسیت" } },
          ]),
      },
      category: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "child", parentId: "parent" }, { id: "parent", parentId: null }]),
      },
      attribute: { findMany: vi.fn().mockResolvedValue([]) },
    });

    const { fetchProductFacets } = await importFresh();
    const result = await fetchProductFacets([{ id: "p1", source: "MAZON" }] as never);
    expect(result.p1).toEqual({ جنسیت: ["زنانه"] });
  });

  it("نزدیک‌ترین سطحِ ارث‌بری برنده است", async () => {
    setupPrismaMock({
      product: { findMany: vi.fn().mockResolvedValue([{ id: "p1", categoryId: "child" }]) },
      productVariantValue: { findMany: vi.fn().mockResolvedValue([]) },
      categoryAttribute: {
        findMany: vi.fn().mockResolvedValue([
          { fixedValue: "زنانه", categoryId: "parent", attribute: { name: "جنسیت" } },
          { fixedValue: "مردانه", categoryId: "child", attribute: { name: "جنسیت" } },
        ]),
      },
      category: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "child", parentId: "parent" }, { id: "parent", parentId: null }]),
      },
      attribute: { findMany: vi.fn().mockResolvedValue([]) },
    });

    const { fetchProductFacets } = await importFresh();
    const result = await fetchProductFacets([{ id: "p1", source: "MAZON" }] as never);
    expect(result.p1).toEqual({ جنسیت: ["مردانه"] });
  });

  it("مقادیر وارینتیِ محصول به facet اضافه می‌شوند", async () => {
    setupPrismaMock({
      product: { findMany: vi.fn().mockResolvedValue([{ id: "p1", categoryId: "leaf" }]) },
      productVariantValue: {
        findMany: vi.fn().mockResolvedValue([
          { attribute: "رنگ", value: "قرمز", variant: { productId: "p1" } },
          { attribute: "رنگ", value: "سبز", variant: { productId: "p1" } },
        ]),
      },
      categoryAttribute: { findMany: vi.fn().mockResolvedValue([]) },
      category: { findMany: vi.fn().mockResolvedValue([{ id: "leaf", parentId: null }]) },
      attribute: { findMany: vi.fn().mockResolvedValue([]) },
    });

    const { fetchProductFacets } = await importFresh();
    const result = await fetchProductFacets([{ id: "p1", source: "MAZON" }] as never);
    expect(result.p1).toEqual({ رنگ: ["قرمز", "سبز"] });
  });

  it("ویژگی‌های عضو گروه زیر نامِ گروه جمع می‌شوند", async () => {
    setupPrismaMock({
      product: { findMany: vi.fn().mockResolvedValue([{ id: "p1", categoryId: "leaf" }]) },
      productVariantValue: {
        findMany: vi.fn().mockResolvedValue([
          { attribute: "سایز لباس", value: "M", variant: { productId: "p1" } },
          { attribute: "سایز کفش", value: "42", variant: { productId: "p1" } },
        ]),
      },
      categoryAttribute: { findMany: vi.fn().mockResolvedValue([]) },
      category: { findMany: vi.fn().mockResolvedValue([{ id: "leaf", parentId: null }]) },
      attribute: {
        findMany: vi.fn().mockResolvedValue([
          { name: "سایز لباس", group: { name: "سایز" } },
          { name: "سایز کفش", group: { name: "سایز" } },
        ]),
      },
    });

    const { fetchProductFacets } = await importFresh();
    const result = await fetchProductFacets([{ id: "p1", source: "MAZON" }] as never);
    expect(result.p1["سایز"]).toContain("M");
    expect(result.p1["سایز"]).toContain("42");
    expect(result.p1["سایز لباس"]).toBeUndefined();
  });

  it("فرزندِ چرخه‌ای در درخت، حلقه‌ی بی‌پایان نمی‌سازد", async () => {
    setupPrismaMock({
      product: { findMany: vi.fn().mockResolvedValue([{ id: "p1", categoryId: "a" }]) },
      productVariantValue: { findMany: vi.fn().mockResolvedValue([]) },
      categoryAttribute: {
        findMany: vi.fn().mockResolvedValue([
          { fixedValue: "X", categoryId: "a", attribute: { name: "ف" } },
        ]),
      },
      category: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "a", parentId: "b" }, { id: "b", parentId: "a" }]),
      },
      attribute: { findMany: vi.fn().mockResolvedValue([]) },
    });

    const { fetchProductFacets } = await importFresh();
    const result = await fetchProductFacets([{ id: "p1", source: "MAZON" }] as never);
    expect(result.p1).toEqual({ ف: ["X"] });
  });
});