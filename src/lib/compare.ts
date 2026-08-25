// ================= مقایسه محصولات =================
// لیست مقایسه روی کلاینت (localStorage، مثل سبد/اخیراً دیده‌شده) فقط شناسه‌های
// محصول مزون را نگه می‌دارد. این فایل توابع خالصی دارد که بدون DB تست‌پذیرند:
// مدیریت لیست + ساخت جدول مقایسه از روی محصولات دریافتی.

export const MAX_COMPARE_COUNT = 4;

export function addToCompare(list: string[], id: string): string[] {
  const without = list.filter((x) => x !== id);
  return [id, ...without].slice(0, MAX_COMPARE_COUNT);
}

export function removeFromCompare(list: string[], id: string): string[] {
  return list.filter((x) => x !== id);
}

export function containsCompare(list: string[], id: string): boolean {
  return list.includes(id);
}

// ---- ورودی خام مقایسه (همون چیزی که /api/compare برمی‌گرداند) ----

export type CompareSpec = { label: string; value: string };

export type CompareAttribute = { name: string; values: string[] };

export type CompareProduct = {
  id: string;
  slug: string;
  title: string;
  image: string;
  price: number;
  originalPrice: number;
  discount: number;
  brand: string | null;
  categoryName: string | null;
  fastShipping: boolean;
  rating: { avg: number; count: number };
  specifications: CompareSpec[];
  attributes: CompareAttribute[];
};

// ---- ردیف‌های جدول مقایسه ----

export type CompareRow =
  | { key: string; label: string; kind: "field" | "spec" | "attribute"; values: (string | null)[] };

// ردیف‌های ثابت (تصویر/عنوان/قیمت/...) + ردیف مشخصات فنی و ویژگی‌ها -- همه‌ی
// برچسب‌ها با اتحادِ مرتبِ اولین-ظهور از بین محصولات ساخته می‌شوند تا جدول
// همه‌ی محصولات را با هم پوشش دهد و جای خالی «—» باشد. خالص برای تست.
export function buildComparisonTable(products: CompareProduct[]): CompareRow[] {
  const rows: CompareRow[] = [
    { key: "image", label: "تصویر", kind: "field", values: products.map((p) => p.image) },
    { key: "title", label: "عنوان", kind: "field", values: products.map((p) => p.title) },
    {
      key: "price",
      label: "قیمت",
      kind: "field",
      values: products.map((p) =>
        p.discount > 0
          ? `${p.price.toLocaleString("fa-IR")} تومان (قیمت قبلی: ${p.originalPrice.toLocaleString("fa-IR")})`
          : `${p.price.toLocaleString("fa-IR")} تومان`
      ),
    },
    {
      key: "discount",
      label: "تخفیف",
      kind: "field",
      values: products.map((p) => (p.discount > 0 ? `٪${p.discount.toLocaleString("fa-IR")}` : null)),
    },
    { key: "brand", label: "برند", kind: "field", values: products.map((p) => p.brand) },
    { key: "category", label: "دسته‌بندی", kind: "field", values: products.map((p) => p.categoryName) },
    {
      key: "rating",
      label: "امتیاز",
      kind: "field",
      values: products.map((p) =>
        p.rating.count > 0 ? `${p.rating.avg.toFixed(1)} از ۵ (${p.rating.count.toLocaleString("fa-IR")} نظر)` : null
      ),
    },
    {
      key: "shipping",
      label: "ارسال",
      kind: "field",
      values: products.map((p) => (p.fastShipping ? "فوری" : null)),
    },
  ];

  // مشخصات فنی -- اتحاد برچسب‌ها به ترتیب اولین ظاهر
  const specLabels = orderedUnion(products.map((p) => p.specifications.map((s) => s.label)));
  for (const label of specLabels) {
    rows.push({
      key: `spec:${label}`,
      label,
      kind: "spec",
      values: products.map((p) => {
        const found = p.specifications.find((s) => s.label === label);
        return found?.value ?? null;
      }),
    });
  }

  // ویژگی‌ها (سایز/رنگ و...) -- اتحاد نام ویژگی به ترتیب اولین ظاهر
  const attrNames = orderedUnion(products.map((p) => p.attributes.map((a) => a.name)));
  for (const name of attrNames) {
    rows.push({
      key: `attr:${name}`,
      label: name,
      kind: "attribute",
      values: products.map((p) => {
        const found = p.attributes.find((a) => a.name === name);
        return found && found.values.length > 0 ? found.values.join("، ") : null;
      }),
    });
  }

  return rows;
}

// اتحاد مرتب: ترتیبِ اولین-ظهورِ مقدارها را بین چند لیست حفظ می‌کند
export function orderedUnion(lists: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const item of list) {
      if (!seen.has(item)) {
        seen.add(item);
        out.push(item);
      }
    }
  }
  return out;
}