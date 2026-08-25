import { prisma } from "@/lib/prisma";
import { fetchMazonProducts } from "@/lib/products";
import { extractSeoSlugFromUrl } from "@/lib/trendyolProductLink";
import type { UnifiedProduct } from "@/types/product";

// ================= توصیه‌گر محصول =================
// همکاری فیلترینگ آیتم‌محور (item-to-item collaborative filtering): محصولاتی
// که با هم «تعامل» شده‌اند (خرید، ویشلیست، نظر، اخطار قیمت) به هم شبیه‌اند.
// امتیاز هر جفت = مجموعِ تعاملاتِ مشترکِ کاربران، با وزن متفاوت هر سیگنال.
//
// این تعامل‌ها هم روی محصولات مزون (شناسه = productId خودش) هم روی محصولات
// ترندیول/میلا (شناسه = "ext:<externalId>") ثبت می‌شن -- قبلاً فقط مزون دیده
// می‌شد، یعنی برای مشتری‌ای که فقط از ترندیول خریده/پسندیده، هیچ سیگنالی
// نداشتیم. الگوریتم اصلی (buildItemToItemIndex/recommendRelated/
// recommendPersonalized) کاملاً به فرمتِ شناسه بی‌تفاوته -- فقط رشته‌ست --
// پس فقط لایه‌ی دیتابیس (جمع‌آوری تعامل‌ها + نگاشتِ نتیجه به کارت قابل‌نمایش)
// باید هر دو منبع رو بشناسه

export type InteractionPair = { userId: string; productId: string; weight: number };

// وزن سیگنال‌ها -- خرید قوی‌ترین سیگنال، اخطار قیمت ضعیف‌ترین
export const SIGNAL_WEIGHTS = {
  ORDER: 1,
  WISHLIST: 0.8,
  REVIEW: 0.6,
  ALERT: 0.5,
} as const;

// ---------- توابع خالص (تست‌پذیر) ----------

// ایندکس هم‌رخدادی: برای هر محصول، نگاشتِ محصولاتِ هم‌تعامل‌شده به امتیاز.
// امتیاز هر جفت = مجموعِ ریشه‌ی ضربِ وزن‌های دو تعامل (هر کاربر یک‌بار شمرده
// می‌شه، با حداکثرِ وزنِ سیگنالش).
export function buildItemToItemIndex(pairs: InteractionPair[]): Map<string, Map<string, number>> {
  const byUser = new Map<string, Map<string, number>>();
  for (const p of pairs) {
    if (!byUser.has(p.userId)) byUser.set(p.userId, new Map());
    const seen = byUser.get(p.userId)!;
    seen.set(p.productId, Math.max(seen.get(p.productId) ?? 0, p.weight));
  }

  const index = new Map<string, Map<string, number>>();
  const bump = (a: string, b: string, score: number) => {
    if (!index.has(a)) index.set(a, new Map());
    const m = index.get(a)!;
    m.set(b, (m.get(b) ?? 0) + score);
  };

  for (const userProducts of byUser.values()) {
    const items = Array.from(userProducts.entries());
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const [a, wa] = items[i];
        const [b, wb] = items[j];
        const score = Math.sqrt(wa * wb);
        bump(a, b, score);
        bump(b, a, score);
      }
    }
  }
  return index;
}

export type Scored = { productId: string; score: number };

// محصولات مشابه یک محصول دانه (برای صفحه‌ی محصول)
export function recommendRelated(
  seedId: string,
  index: Map<string, Map<string, number>>,
  exclude: Set<string>,
  limit: number
): Scored[] {
  const m = index.get(seedId);
  if (!m) return [];
  return Array.from(m.entries())
    .filter(([id]) => !exclude.has(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([productId, score]) => ({ productId, score }));
}

// پیشنهاد شخصی: مجموعِ امتیازهای هم‌تعاملیِ همه‌ی محصولاتِ «بذر» کاربر
export function recommendPersonalized(
  seedIds: string[],
  index: Map<string, Map<string, number>>,
  exclude: Set<string>,
  limit: number
): Scored[] {
  const agg = new Map<string, number>();
  for (const seed of seedIds) {
    const m = index.get(seed);
    if (!m) continue;
    for (const [id, score] of m) {
      if (exclude.has(id)) continue;
      agg.set(id, (agg.get(id) ?? 0) + score);
    }
  }
  return Array.from(agg.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([productId, score]) => ({ productId, score }));
}

// ---------- لایه‌ی دیتابیس ----------

// شناسه‌ی یکپارچه‌ی یک ردیف تعامل: برای مزون همون productId، برای
// ترندیول/میلا با پیشوند "ext:" (تا با cuid های مزون هیچ‌وقت تصادفی برابر نشه)
function unifiedItemKey(row: { productId?: string | null; externalId?: string | null }): string | null {
  if (row.productId) return row.productId;
  if (row.externalId) return `ext:${row.externalId}`;
  return null;
}

// همه‌ی تعامل‌های کاربر→محصول (مزون + ترندیول/میلا) با وزن سیگنال
export async function fetchInteractionPairs(): Promise<InteractionPair[]> {
  const [orderItems, wishlist, reviews, alerts] = await Promise.all([
    prisma.orderItem.findMany({
      where: {
        order: { paymentStatus: "PAID", status: { notIn: ["CANCELLED", "RETURNED"] } },
      },
      select: { productId: true, externalId: true, order: { select: { userId: true } } },
    }),
    prisma.wishlistItem.findMany({
      select: { userId: true, productId: true, externalId: true },
    }),
    prisma.review.findMany({
      where: { isApproved: true },
      select: { userId: true, productId: true, externalId: true },
    }),
    prisma.priceAlert.findMany({ select: { userId: true, productId: true } }),
  ]);

  const pairs: InteractionPair[] = [];
  for (const oi of orderItems) {
    const key = unifiedItemKey(oi);
    if (key) pairs.push({ userId: oi.order.userId, productId: key, weight: SIGNAL_WEIGHTS.ORDER });
  }
  for (const w of wishlist) {
    const key = unifiedItemKey(w);
    if (key) pairs.push({ userId: w.userId, productId: key, weight: SIGNAL_WEIGHTS.WISHLIST });
  }
  for (const r of reviews) {
    const key = unifiedItemKey(r);
    if (key) pairs.push({ userId: r.userId, productId: key, weight: SIGNAL_WEIGHTS.REVIEW });
  }
  for (const a of alerts) {
    pairs.push({ userId: a.userId, productId: a.productId, weight: SIGNAL_WEIGHTS.ALERT });
  }
  return pairs;
}

// محصولاتِ «بذر» یک کاربر: هر محصولی (مزون یا ترندیول/میلا) که با آن تعامل داشته
export async function fetchUserSeedProductIds(userId: string): Promise<string[]> {
  const [orderItems, wishlist, reviews, alerts] = await Promise.all([
    prisma.orderItem.findMany({
      where: {
        order: { userId, paymentStatus: "PAID", status: { notIn: ["CANCELLED", "RETURNED"] } },
      },
      select: { productId: true, externalId: true },
    }),
    prisma.wishlistItem.findMany({ where: { userId }, select: { productId: true, externalId: true } }),
    prisma.review.findMany({ where: { userId }, select: { productId: true, externalId: true } }),
    prisma.priceAlert.findMany({ where: { userId }, select: { productId: true } }),
  ]);
  const set = new Set<string>();
  for (const oi of orderItems) {
    const key = unifiedItemKey(oi);
    if (key) set.add(key);
  }
  for (const w of wishlist) {
    const key = unifiedItemKey(w);
    if (key) set.add(key);
  }
  for (const r of reviews) {
    const key = unifiedItemKey(r);
    if (key) set.add(key);
  }
  for (const a of alerts) set.add(a.productId);
  return Array.from(set);
}

// محصولات محبوب (پس‌افتِ سرد/کال‌استارت) -- بر اساس بازدید ۱۴ روز اخیر (فقط
// مزون؛ برای ترندیول بازدید صفحه به‌صورت محلی ثبت نمی‌شه)
export async function fetchPopularProductIds(limit: number): Promise<string[]> {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const grouped = await prisma.productView.groupBy({
    by: ["productId"],
    where: { createdAt: { gte: since } },
    _count: { productId: true },
    orderBy: { _count: { productId: "desc" } },
    take: limit * 2,
  });
  return grouped.map((g) => g.productId).filter(Boolean);
}

// نگاشتِ شناسه‌های "ext:<externalId>" به کارتِ قابل‌نمایش -- عنوان/عکس/قیمت از
// جدیدترین snapshotِ موجود (اول ویشلیست، بعد سفارش) میاد، ولی لینکِ داخلی فقط
// وقتی ساخته می‌شه که TrendyolProductUrlCache واقعاً همون contentId رو داشته
// باشه -- چون صفحه‌ی مقصد (/products/trendyol/[slug]) دقیقاً همین کش رو دوباره
// چک می‌کنه و بدونش notFound می‌ده؛ بدون لینکِ قابل‌کلیک، این محصول اصلاً پیشنهاد
// نمی‌شه (به‌جای نشون‌دادن یه کارتِ خراب)
async function resolveTrendyolSnapshots(externalIds: string[]): Promise<Map<string, UnifiedProduct>> {
  const result = new Map<string, UnifiedProduct>();
  if (externalIds.length === 0) return result;

  const [cachedUrls, wishlistRows, orderRows] = await Promise.all([
    prisma.trendyolProductUrlCache.findMany({
      where: { contentId: { in: externalIds } },
      select: { contentId: true, url: true },
    }),
    prisma.wishlistItem.findMany({
      where: { externalId: { in: externalIds } },
      select: { externalId: true, externalTitle: true, externalImage: true, externalPrice: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.orderItem.findMany({
      where: { externalId: { in: externalIds } },
      select: { externalId: true, title: true, image: true, price: true },
    }),
  ]);

  const urlByContentId = new Map(cachedUrls.map((c) => [c.contentId, c.url]));

  const snapshotByExternalId = new Map<string, { title: string; image: string | null; price: number }>();
  for (const row of wishlistRows) {
    if (row.externalId && row.externalTitle && !snapshotByExternalId.has(row.externalId)) {
      snapshotByExternalId.set(row.externalId, {
        title: row.externalTitle,
        image: row.externalImage,
        price: row.externalPrice ?? 0,
      });
    }
  }
  for (const row of orderRows) {
    if (row.externalId && !snapshotByExternalId.has(row.externalId)) {
      snapshotByExternalId.set(row.externalId, { title: row.title, image: row.image, price: row.price });
    }
  }

  for (const externalId of externalIds) {
    const url = urlByContentId.get(externalId);
    const snapshot = snapshotByExternalId.get(externalId);
    if (!url || !snapshot) continue;

    // اگه اسلاگِ سئو از URL درنیومد، به‌جای برگشتن به contentId خالی (که با
    // یه رجکسِ "فقط رقم" توی صفحه‌ی مقصد به‌اشتباه محصولِ دموی قدیمی تشخیص داده
    // می‌شه) یه پیشوندِ بی‌معنی بعد از "-" اضافه می‌کنیم تا همیشه مسیر واقعی برود
    const seoSlug = extractSeoSlugFromUrl(url);
    const slugOrId = seoSlug ? `${externalId}-${seoSlug}` : `${externalId}-x`;

    result.set(`ext:${externalId}`, {
      id: `ext:${externalId}`,
      source: "TRENDYOL",
      slugOrId,
      externalId,
      sourceUrl: url,
      title: snapshot.title,
      price: snapshot.price,
      originalPrice: snapshot.price,
      discount: 0,
      image: snapshot.image ?? "",
      images: snapshot.image ? [snapshot.image] : [],
      createdAt: new Date(0).toISOString(),
    });
  }
  return result;
}

// نگاشت امتیازها به محصولات واقعی (مزون یا ترندیول/میلا)، با پر کردن کمبود از
// پرفروش‌ترین‌های مزون
async function resolveScoredProducts(
  scored: Scored[],
  exclude: Set<string>,
  limit: number
): Promise<UnifiedProduct[]> {
  const externalIds = scored
    .filter((s) => s.productId.startsWith("ext:"))
    .map((s) => s.productId.slice(4));

  const [mazonAll, trendyolByKey] = await Promise.all([
    fetchMazonProducts(),
    resolveTrendyolSnapshots(externalIds),
  ]);
  const mazonById = new Map(mazonAll.map((p) => [p.id, p]));

  const picked: UnifiedProduct[] = [];
  const used = new Set(exclude);
  for (const s of scored) {
    if (used.has(s.productId)) continue;
    const p = s.productId.startsWith("ext:") ? trendyolByKey.get(s.productId) : mazonById.get(s.productId);
    if (p) {
      picked.push(p);
      used.add(s.productId);
    }
    if (picked.length >= limit) break;
  }

  if (picked.length < limit) {
    const popular = await fetchPopularProductIds(limit - picked.length);
    for (const id of popular) {
      const p = mazonById.get(id);
      if (p && !used.has(p.id)) {
        picked.push(p);
        used.add(p.id);
      }
      if (picked.length >= limit) break;
    }
  }
  return picked.slice(0, limit);
}

// ---------- کشِ ایندکسِ هم‌تعاملی ----------
// ساختنِ ایندکس (fetchInteractionPairs + buildItemToItemIndex) روی کل
// تعامل‌های سایت کار می‌کنه؛ ساختنش از صفر روی *هر* بازِ صفحه‌ی اصلی/صفحه‌ی
// محصول O(n^2) نسبت به تعداد تعامل‌های هر کاربره و با رشدِ سفارش/ویشلیست/نظر
// کندتر می‌شه. چون این داده لازم نیست لحظه‌به‌لحظه تازه باشه (چند دقیقه تأخیر
// برای یه پیشنهاد کاملاً قابل‌قبوله)، به‌جای محاسبه‌ی هم‌زمان با هر درخواست،
// نتیجه رو توی حافظه‌ی همین پروسه با یه TTL کش می‌کنیم -- محاسبه فقط یک‌بار در
// هر بازه انجام می‌شه و همه‌ی درخواست‌های بعدی همون نتیجه‌ی آماده رو می‌گیرن
const INDEX_CACHE_TTL_MS = 10 * 60 * 1000;
let cachedIndex: Map<string, Map<string, number>> | null = null;
let cachedIndexAt = 0;
let indexComputation: Promise<Map<string, Map<string, number>>> | null = null;

async function getItemToItemIndex(): Promise<Map<string, Map<string, number>>> {
  if (cachedIndex && Date.now() - cachedIndexAt < INDEX_CACHE_TTL_MS) return cachedIndex;
  // اگه یه درخواست دیگه هم‌زمان همین محاسبه رو شروع کرده، به جای دوباره‌کاری
  // منتظرِ همون یکی می‌مونیم
  if (indexComputation) return indexComputation;

  indexComputation = (async () => {
    try {
      const pairs = await fetchInteractionPairs();
      const index = buildItemToItemIndex(pairs);
      cachedIndex = index;
      cachedIndexAt = Date.now();
      return index;
    } finally {
      indexComputation = null;
    }
  })();
  return indexComputation;
}

// محصولات مشابه یک محصول -- برای صفحه‌ی جزئیات
export async function fetchRelatedProducts(productId: string, limit = 8): Promise<UnifiedProduct[]> {
  const index = await getItemToItemIndex();
  const scored = recommendRelated(productId, index, new Set([productId]), limit);
  if (scored.length === 0) {
    // هیچ سیگنالی نیست -- محبوب‌ترین‌ها به‌عنوان جایگزین
    const all = await fetchMazonProducts();
    const byId = new Map(all.map((p) => [p.id, p]));
    const popular = await fetchPopularProductIds(limit);
    const result: UnifiedProduct[] = [];
    const used = new Set([productId]);
    for (const id of [...popular, ...all.map((p) => p.id)]) {
      const p = byId.get(id);
      if (p && !used.has(p.id)) {
        result.push(p);
        used.add(p.id);
      }
      if (result.length >= limit) break;
    }
    return result;
  }
  return resolveScoredProducts(scored, new Set([productId]), limit);
}

// پیشنهاد شخصی برای یک کاربر -- اگه سیگنالی نداشته باشد، محبوب‌ترین‌ها
export async function fetchRecommendedForYou(userId: string | undefined, limit = 10): Promise<UnifiedProduct[]> {
  if (!userId) return resolveScoredProducts([], new Set(), limit);

  const seeds = await fetchUserSeedProductIds(userId);
  if (seeds.length === 0) return resolveScoredProducts([], new Set(), limit);

  const index = await getItemToItemIndex();
  const scored = recommendPersonalized(seeds, index, new Set(seeds), limit * 2);
  return resolveScoredProducts(scored, new Set(seeds), limit);
}
