export type TreeCategory = {
  id: string;
  name: string;
  parentId: string | null;
};

// دسته‌بندی‌های flat رو به ترتیب درختی (DFS) با عمق هر آیتم می‌چینه
export function flattenCategoryTree<T extends TreeCategory>(
  categories: T[]
): (T & { depth: number })[] {
  const byParent = new Map<string | null, T[]>();
  for (const c of categories) {
    const key = c.parentId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(c);
  }

  const result: (T & { depth: number })[] = [];
  function visit(parentId: string | null, depth: number) {
    const children = byParent.get(parentId) ?? [];
    for (const child of children) {
      result.push({ ...child, depth });
      visit(child.id, depth + 1);
    }
  }
  visit(null, 0);

  const visited = new Set(result.map((c) => c.id));
  for (const c of categories) {
    if (!visited.has(c.id)) result.push({ ...c, depth: 0 });
  }

  return result;
}

// چک می‌کنه آیا candidateId یکی از فرزندان (در هر عمقی) ancestorId هست یا نه
export function isDescendantCategory<T extends TreeCategory>(
  categories: T[],
  ancestorId: string,
  candidateId: string
): boolean {
  const children = categories.filter((c) => c.parentId === ancestorId);
  for (const child of children) {
    if (child.id === candidateId) return true;
    if (isDescendantCategory(categories, child.id, candidateId)) return true;
  }
  return false;
}

// مسیر کامل یک دسته از ریشه تا خودش، مثلا "پوشاک مردانه › پیراهن › آستین کوتاه"
export function categoryPath<T extends TreeCategory>(categories: T[], id: string): string {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const parts: string[] = [];
  let current: T | undefined = byId.get(id);
  while (current) {
    parts.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return parts.join(" › ");
}

// ویژگی‌های مؤثر یک دسته = ویژگی‌های خودش + همه‌ی ویژگی‌های ارث‌بری‌شده از والدها (تا ریشه)
// یعنی زیردسته‌ها نیازی نیست ویژگی‌های پدرشون رو دوباره وصل کنن؛ خودکار می‌گیرنش
export function effectiveCategoryAttributes<
  C extends TreeCategory & { attributes: { attribute: { id: string } }[] }
>(categories: C[], categoryId: string): C["attributes"][number]["attribute"][] {
  type A = C["attributes"][number]["attribute"];
  const byId = new Map(categories.map((c) => [c.id, c]));
  const seen = new Map<string, A>();
  const visited = new Set<string>();
  let current = byId.get(categoryId);

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    for (const ca of current.attributes) {
      if (!seen.has(ca.attribute.id)) seen.set(ca.attribute.id, ca.attribute);
    }
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return Array.from(seen.values());
}

// مثل effectiveCategoryAttributes، ولی fixedValue رو هم نگه می‌داره -- برای این‌که بفهمیم
// کدوم ویژگی‌ها روی این دسته (با ارث‌بری از والدها) مقدار ثابت دارن (مثلا جنسیت: زنانه)
// نزدیک‌ترین سطح به خود دسته (نه ریشه) برنده‌ست، چون ابتدا از خود دسته شروع می‌کنیم
export function effectiveCategoryAttributeSettings<
  C extends TreeCategory & {
    attributes: { attribute: { id: string; name: string }; fixedValue: string | null }[];
  }
>(
  categories: C[],
  categoryId: string
): { attributeId: string; attributeName: string; fixedValue: string | null }[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const seen = new Map<
    string,
    { attributeId: string; attributeName: string; fixedValue: string | null }
  >();
  const visited = new Set<string>();
  let current = byId.get(categoryId);

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    for (const ca of current.attributes) {
      if (!seen.has(ca.attribute.id)) {
        seen.set(ca.attribute.id, {
          attributeId: ca.attribute.id,
          attributeName: ca.attribute.name,
          fixedValue: ca.fixedValue,
        });
      }
    }
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return Array.from(seen.values());
}
