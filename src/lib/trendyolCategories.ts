// دسته‌بندی‌های ترندیول از یه API عمومی (بدون نیاز به احراز هویت) میان که مهدی
// پیدا کرده -- چون این درخت ممکنه هر روز عوض بشه (دسته جدید اضافه بشه، آیدی
// عوض بشه، ...)، این‌جا کش می‌کنیمش (نه توی دیتابیس) و یه دکمه‌ی «تازه‌سازی»
// توی پنل ادمین می‌ذاریم که کش رو دور بریزه و دوباره از ترندیول بگیره.

export type TrendyolCategory = {
  id: number;
  name: string;
  parentId: number | null;
  subCategories?: TrendyolCategory[];
};

export type FlatTrendyolCategory = {
  id: number;
  parentId: number | null;
  name: string;
  // مسیر کامل برای نمایش، مثلا "Kadın > Giyim > Elbise" -- چون اسم تنها
  // ممکنه بین چندتا زیردسته‌ی مختلف تکراری باشه
  path: string;
};

const TRENDYOL_CATEGORIES_URL = "https://apigw.trendyol.com/integration/product/product-categories";

// کش در حافظه (نه دیتابیس) -- ۱۲ ساعته، چون به گفته‌ی مهدی این درخت ممکنه
// هر روز تغییر کنه و نباید خیلی بمونه، ولی هر بار هم لازم نیست از نو بگیریم
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
let cachedTree: TrendyolCategory[] | null = null;
let cachedAt = 0;

export async function fetchTrendyolCategoryTree(forceRefresh = false): Promise<TrendyolCategory[]> {
  const isFresh = cachedTree !== null && Date.now() - cachedAt < CACHE_TTL_MS;
  if (isFresh && !forceRefresh) return cachedTree!;

  // خیلی از APIهای پشت Cloudflare/Akamai (که این احتمالاً یکیشونه) بدون
  // User-Agent واقعی، یا جواب خالی می‌دن یا کلاً بلاک می‌کنن -- fetch سمت سرور
  // Node.js به‌صورت پیش‌فرض هیچ‌کدوم از این هدرها رو نمی‌فرسته
  const res = await fetch(TRENDYOL_CATEGORIES_URL, {
    ...(forceRefresh ? { cache: "no-store" as const } : { next: { revalidate: CACHE_TTL_MS / 1000 } }),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
    },
  });
  if (!res.ok) {
    throw new Error(`دریافت دسته‌بندی‌های ترندیول ناموفق بود (${res.status})`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  const rawText = await res.text();
  if (!contentType.includes("json")) {
    throw new Error(
      `پاسخ ترندیول JSON نبود (content-type: ${contentType || "نامشخص"}). این معمولاً یعنی یه صفحه‌ی محافظتی/چالش (مثل Cloudflare) به‌جای داده‌ی واقعی برگشته. ۳۰۰ کاراکتر اول پاسخ: ${rawText.slice(0, 300)}`
    );
  }

  let data: unknown;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`پارس JSON پاسخ ترندیول ناموفق بود. ۳۰۰ کاراکتر اول: ${rawText.slice(0, 300)}`);
  }
  // ساختار واقعی ترندیول: { categories: [ { id, name, parentId, subCategories: [...] } ] }
  const dataObj = data as { categories?: TrendyolCategory[] } | TrendyolCategory[] | null;
  const tree: TrendyolCategory[] = Array.isArray(dataObj) ? dataObj : dataObj?.categories ?? [];

  // اگه آرایه خالی درومد، احتمالاً حدسمون روی ساختار JSON غلطه (مثلاً کلید
  // "categories" یا "subCategories" اسم دیگه‌ای داره) -- به‌جای شکست خاموش، دقیقاً
  // نشون می‌دیم پاسخ واقعی چه شکلیه تا بشه پارسر رو درست کرد
  if (tree.length === 0) {
    const topLevelKeys = Array.isArray(dataObj)
      ? "(خودِ پاسخ یه آرایه‌ی خالیه)"
      : Object.keys(dataObj ?? {}).join(", ");
    const sample = JSON.stringify(data).slice(0, 500);
    throw new Error(
      `پاسخ ترندیول رو گرفتیم ولی نتونستیم آرایه‌ی دسته‌بندی‌ها رو توش پیدا کنیم. کلیدهای سطح بالا: [${topLevelKeys}]. نمونه‌ی خام: ${sample}`
    );
  }

  cachedTree = tree;
  cachedAt = Date.now();
  return tree;
}

// درخت تودرتو رو به یه لیست تخت با مسیر کامل تبدیل می‌کنه -- برای سرچ راحت‌تره
export function flattenTrendyolCategories(tree: TrendyolCategory[]): FlatTrendyolCategory[] {
  const flat: FlatTrendyolCategory[] = [];

  function walk(nodes: TrendyolCategory[], parentPath: string) {
    for (const node of nodes) {
      const path = parentPath ? `${parentPath} > ${node.name}` : node.name;
      flat.push({ id: node.id, parentId: node.parentId ?? null, name: node.name, path });
      if (node.subCategories && node.subCategories.length > 0) {
        walk(node.subCategories, path);
      }
    }
  }

  walk(tree, "");
  return flat;
}

// سرچ ساده -- هم روی مسیر کامل (اسم فارسی/ترکی) هم روی خودِ آیدی، چون بعضی
// وقتا مهدی می‌خواد مستقیم یه آیدی خاص رو پیدا کنه
export function searchTrendyolCategories(
  flat: FlatTrendyolCategory[],
  query: string,
  limit = 40
): FlatTrendyolCategory[] {
  const q = query.trim().toLowerCase();
  if (!q) return flat.slice(0, limit);
  return flat.filter((c) => c.path.toLowerCase().includes(q) || String(c.id) === q).slice(0, limit);
}
