import { prisma } from "@/lib/prisma";
import { UnifiedProduct } from "@/types/product";

export type ProductFacetMap = Record<string, string[]>; // attributeName -> distinct values

// برای هر محصول مزون، مقادیر مؤثر ویژگی‌هاشو حساب می‌کنه:
// - ویژگی‌های ثابتی که از دسته‌بندی (و والدهاش) ارث می‌بره -- مثلا جنسیت: زنانه
// - ویژگی‌های وارینتی که خود محصول واقعاً ازشون داره -- مثلا رنگ: قرمز/سبز (چند مقداره)
// محصولات ترندیول اصلاً پشتیبانی نمی‌شن (facet خالی برمی‌گردونن) چون این سیستم فقط برای مزونه
export async function fetchProductFacets(
  products: UnifiedProduct[]
): Promise<Record<string, ProductFacetMap>> {
  const mazonIds = products.filter((p) => p.source === "MAZON").map((p) => p.id);
  if (mazonIds.length === 0) return {};

  const [productsWithCategory, variantValues, categoryAttrs, allCategories, allAttributes] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: mazonIds } },
      select: { id: true, categoryId: true },
    }),
    prisma.productVariantValue.findMany({
      where: { variant: { productId: { in: mazonIds } } },
      select: { attribute: true, value: true, variant: { select: { productId: true } } },
    }),
    prisma.categoryAttribute.findMany({
      where: { fixedValue: { not: null } },
      select: {
        fixedValue: true,
        categoryId: true,
        attribute: { select: { name: true } },
      },
    }),
    prisma.category.findMany({ select: { id: true, parentId: true } }),
    prisma.attribute.findMany({
      select: { name: true, group: { select: { name: true } } },
    }),
  ]);

  // نگاشت نام ویژگی -> نام سرگروه (اگه عضو یه AttributeGroup باشه). مثلا "سایز لباس"
  // و "سایز کفش" هر دو زیر سرگروه "سایز" میان -- توی فیلتر باید یکی بشن، نه دوتا بخش جدا
  // (دقیقا مثل ترندیول که همه‌ی سایزها زیر یک فیلتر واحد "Beden" جمع می‌شن)
  const groupNameByAttribute = new Map<string, string>();
  for (const attr of allAttributes) {
    if (attr.group) groupNameByAttribute.set(attr.name, attr.group.name);
  }
  const facetKeyFor = (attributeName: string) => groupNameByAttribute.get(attributeName) ?? attributeName;

  const parentOf = new Map(allCategories.map((c) => [c.id, c.parentId]));

  function ancestorChain(categoryId: string): string[] {
    const chain: string[] = [];
    let current: string | null | undefined = categoryId;
    const visited = new Set<string>();
    while (current && !visited.has(current)) {
      visited.add(current);
      chain.push(current);
      current = parentOf.get(current);
    }
    return chain;
  }

  // کش: برای هر دسته، لیست {attributeName, fixedValue} با ارث‌بری (نزدیک‌ترین به خود دسته برنده‌ست)
  const fixedByCategory = new Map<string, { attributeName: string; fixedValue: string }[]>();
  function resolveFixedForCategory(categoryId: string) {
    const cached = fixedByCategory.get(categoryId);
    if (cached) return cached;

    const chain = ancestorChain(categoryId);
    const seen = new Map<string, string>();
    for (const catId of chain) {
      for (const ca of categoryAttrs) {
        if (ca.categoryId === catId && ca.fixedValue && !seen.has(ca.attribute.name)) {
          seen.set(ca.attribute.name, ca.fixedValue);
        }
      }
    }
    const result = Array.from(seen.entries()).map(([attributeName, fixedValue]) => ({
      attributeName,
      fixedValue,
    }));
    fixedByCategory.set(categoryId, result);
    return result;
  }

  const variantValuesByProduct = new Map<string, { attribute: string; value: string }[]>();
  for (const vv of variantValues) {
    const pid = vv.variant.productId;
    if (!variantValuesByProduct.has(pid)) variantValuesByProduct.set(pid, []);
    variantValuesByProduct.get(pid)!.push({ attribute: vv.attribute, value: vv.value });
  }

  const result: Record<string, ProductFacetMap> = {};
  for (const p of productsWithCategory) {
    const facets: ProductFacetMap = {};

    for (const { attributeName, fixedValue } of resolveFixedForCategory(p.categoryId)) {
      const key = facetKeyFor(attributeName);
      if (!facets[key]) facets[key] = [];
      if (!facets[key].includes(fixedValue)) facets[key].push(fixedValue);
    }

    for (const { attribute, value } of variantValuesByProduct.get(p.id) ?? []) {
      const key = facetKeyFor(attribute);
      if (!facets[key]) facets[key] = [];
      if (!facets[key].includes(value)) facets[key].push(value);
    }

    result[p.id] = facets;
  }

  return result;
}

// از روی facet هر محصول، لیست همه‌ی مقادیر ممکن هر ویژگی رو جمع می‌کنه -- برای ساخت چک‌باکس‌های فیلتر
export function buildAvailableFacets(
  facetsByProduct: Record<string, ProductFacetMap>
): ProductFacetMap {
  const available: Record<string, Set<string>> = {};
  for (const facets of Object.values(facetsByProduct)) {
    for (const [name, values] of Object.entries(facets)) {
      if (!available[name]) available[name] = new Set();
      for (const v of values) available[name].add(v);
    }
  }
  const result: ProductFacetMap = {};
  for (const [name, set] of Object.entries(available)) {
    result[name] = Array.from(set);
  }
  return result;
}

// ویژگی‌های ثابت مؤثر یک دسته‌بندی (خودش + ارث‌بری از والدها تا ریشه) -- برای نمایش
// «جنسیت: زنانه» به‌صورت ثابت و غیرقابل‌تغییر روی صفحه‌ی محصول
export async function fetchFixedAttributesForCategory(
  categoryId: string
): Promise<{ name: string; value: string }[]> {
  const [categoryAttrs, allCategories] = await Promise.all([
    prisma.categoryAttribute.findMany({
      where: { fixedValue: { not: null } },
      select: {
        fixedValue: true,
        categoryId: true,
        attribute: { select: { name: true } },
      },
    }),
    prisma.category.findMany({ select: { id: true, parentId: true } }),
  ]);

  const parentOf = new Map(allCategories.map((c) => [c.id, c.parentId]));

  const chain: string[] = [];
  let current: string | null | undefined = categoryId;
  const visited = new Set<string>();
  while (current && !visited.has(current)) {
    visited.add(current);
    chain.push(current);
    current = parentOf.get(current);
  }

  const seen = new Map<string, string>();
  for (const catId of chain) {
    for (const ca of categoryAttrs) {
      if (ca.categoryId === catId && ca.fixedValue && !seen.has(ca.attribute.name)) {
        seen.set(ca.attribute.name, ca.fixedValue);
      }
    }
  }

  return Array.from(seen.entries()).map(([name, value]) => ({ name, value }));
}
