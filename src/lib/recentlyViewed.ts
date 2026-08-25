// «اخیراً دیدهاید» -- لیست محصولاتی که کاربر دیده، ذخیره‌شده سمت کلاینت
// (localStorage، مثل سبد). برای مهمان و لاگین‌شده یکسان کار می‌کنه و چون فقط
// یک snapshot سبک است، تاریخ/قیمت ممکنه کمی قدیمی باشه -- که برای یه نوار
// «اخیراً دیدید» کافیه.
export type RecentlyViewedProduct = {
  id: string; // مزون: cuid ، ترندیول: "trendyol-<contentId>" -- برای dedupe یکتاست
  source: "MAZON" | "TRENDYOL";
  slugOrId: string; // برای لینک به صفحه‌ی جزئیات
  title: string;
  image: string;
  price: number; // قیمت نهایی (با تخفیف) به تومان
  originalPrice: number;
  discount: number; // درصد
  href: string;
  viewedAt: string; // ISO -- جدیدترین در ابتدای لیست
};

export const MAX_RECENTLY_VIEWED = 16;

export function addRecentlyViewed(
  list: RecentlyViewedProduct[],
  product: RecentlyViewedProduct
): RecentlyViewedProduct[] {
  const rest = list.filter((p) => p.id !== product.id);
  return [{ ...product, viewedAt: new Date().toISOString() }, ...rest].slice(0, MAX_RECENTLY_VIEWED);
}

export function removeRecentlyViewed(list: RecentlyViewedProduct[], id: string): RecentlyViewedProduct[] {
  return list.filter((p) => p.id !== id);
}

function isRecentlyViewedProduct(v: unknown): v is RecentlyViewedProduct {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    (p.source === "MAZON" || p.source === "TRENDYOL") &&
    typeof p.slugOrId === "string" &&
    typeof p.title === "string" &&
    typeof p.image === "string" &&
    typeof p.price === "number" &&
    typeof p.originalPrice === "number" &&
    typeof p.discount === "number" &&
    typeof p.href === "string" &&
    typeof p.viewedAt === "string"
  );
}

export function parseRecentlyViewed(raw: string | null | undefined): RecentlyViewedProduct[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentlyViewedProduct);
  } catch {
    return [];
  }
}

export function serializeRecentlyViewed(list: RecentlyViewedProduct[]): string {
  return JSON.stringify(list);
}