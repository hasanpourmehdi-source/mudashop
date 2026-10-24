import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { UnifiedProduct } from "@/types/product";
import { fetchTrendyolProducts } from "@/lib/trendyol";
import { normalizeSlug } from "@/lib/slug";
import { buildPriceHistory } from "@/lib/priceHistory";
import { extractSeoSlugFromUrl } from "@/lib/trendyolProductLink";
import type { Product, Prisma } from "@prisma/client";

type ProductWithVariants = Prisma.ProductGetPayload<{
  include: {
    category: true;
    brand: true;
    variants: { include: { values: true } };
    specifications: true;
  };
}>;

type ActiveFlashSale = {
  id: string;
  productId: string;
  discountPercent: number;
  stock: number;
  endsAt: Date;
};

export function parseImages(images: string): string[] {
  try {
    const arr = JSON.parse(images);
    return Array.isArray(arr) ? arr : [images];
  } catch {
    return [images];
  }
}

// نگاشت رنگ -> لیست عکس اختصاصی همون رنگ (برای عوض شدن گالری صفحه محصول با انتخاب رنگ)
function parseColorImages(colorImages: string | null | undefined): Record<string, string[]> {
  if (!colorImages) return {};
  try {
    const obj = JSON.parse(colorImages);
    if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj;
    return {};
  } catch {
    return {};
  }
}

// حراج‌های فعال الان (برای override قیمت محصول در بازه زمانی)
export async function fetchActiveFlashSales(): Promise<ActiveFlashSale[]> {
  const now = new Date();
  return prisma.flashSale.findMany({
    where: {
      isActive: true,
      stock: { gt: 0 },
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
    select: { id: true, productId: true, discountPercent: true, stock: true, endsAt: true },
  });
}

export function normalizeMazonProduct(
  p: Product & { category?: { slug: string; name: string } | null; brand?: { name: string } | null },
  flashSale?: ActiveFlashSale
): UnifiedProduct {
  const images = parseImages(p.images);
  // حراج فلش (اگه فعال باشه) جایگزین تخفیف عادی می‌شه، نه جمع باهاش
  const effectiveDiscount = flashSale ? flashSale.discountPercent : p.discount;
  const finalPrice = Math.round(p.basePrice * (1 - effectiveDiscount / 100));

  return {
    id: p.id,
    source: "MAZON",
    slugOrId: p.slug,
    title: p.title,
    brand: p.brand?.name ?? null,
    price: finalPrice,
    originalPrice: p.basePrice,
    discount: effectiveDiscount,
    image: images[0] ?? "",
    images,
    categorySlug: p.category?.slug,
    categoryName: p.category?.name,
    description: p.description,
    createdAt: p.createdAt.toISOString(),
    fastShipping: p.fastShipping,
    isReturnable: p.isReturnable,
    defectNote: p.defectNote,
    defectImage: p.defectImage,
    careInstructions: p.careInstructions,
    videoUrl: p.videoUrl,
    colorImages: parseColorImages(p.colorImages),
    flashSale: flashSale
      ? {
          id: flashSale.id,
          endsAt: flashSale.endsAt.toISOString(),
          stock: flashSale.stock,
          discountPercent: flashSale.discountPercent,
        }
      : undefined,
  };
}

// امتیاز میانگین، تعداد نظرات تاییدشده، و تعداد علاقه‌مندی هر محصول رو یه‌جا (بدون N+1 query)
// روی لیستی از محصولات می‌شونه -- محصولات ترندیول دست‌نخورده می‌مونن چون این آمار فقط برای مزونه
async function attachSocialStats(products: UnifiedProduct[]): Promise<UnifiedProduct[]> {
  const mazonIds = products.filter((p) => p.source === "MAZON").map((p) => p.id);
  if (mazonIds.length === 0) return products;

  const [reviewStats, wishlistCounts] = await Promise.all([
    prisma.review.groupBy({
      by: ["productId"],
      where: { productId: { in: mazonIds }, isApproved: true },
      _avg: { rating: true },
      _count: { rating: true },
    }),
    prisma.wishlistItem.groupBy({
      by: ["productId"],
      where: { productId: { in: mazonIds } },
      _count: { productId: true },
    }),
  ]);

  const reviewMap = new Map(
    reviewStats.map((r) => [r.productId, { avg: r._avg.rating ?? 0, count: r._count.rating }])
  );
  const wishlistMap = new Map(wishlistCounts.map((w) => [w.productId, w._count.productId]));

  return products.map((p) => {
    if (p.source !== "MAZON") return p;
    const stats = reviewMap.get(p.id);
    return {
      ...p,
      rating: stats?.avg ?? p.rating,
      reviewCount: stats?.count ?? 0,
      wishlistCount: wishlistMap.get(p.id) ?? 0,
    };
  });
}

// تعداد بازدید ۲۴ ساعت اخیر + آیا قیمت فعلی کمترین قیمت ۱۰ روز اخیره -- یه‌جا و
// بدون N+1 روی لیستی از محصولات (مثل attachSocialStats بالا)
async function attachInsightStats(products: UnifiedProduct[]): Promise<UnifiedProduct[]> {
  const mazonIds = products.filter((p) => p.source === "MAZON").map((p) => p.id);
  if (mazonIds.length === 0) return products;

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since10d = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

  const [viewCounts, priceMins] = await Promise.all([
    prisma.productView.groupBy({
      by: ["productId"],
      where: { productId: { in: mazonIds }, createdAt: { gte: since24h } },
      _count: { _all: true },
    }),
    prisma.priceSnapshot.groupBy({
      by: ["productId"],
      where: { productId: { in: mazonIds }, recordedAt: { gte: since10d } },
      _min: { price: true },
    }),
  ]);

  const viewMap = new Map(viewCounts.map((v) => [v.productId, v._count._all]));
  const minPriceMap = new Map(priceMins.map((m) => [m.productId, m._min.price ?? Infinity]));

  return products.map((p) => {
    if (p.source !== "MAZON") return p;
    const minPrice = minPriceMap.get(p.id);
    return {
      ...p,
      viewCount24h: viewMap.get(p.id) ?? 0,
      isLowestPrice10d: minPrice !== undefined ? p.price <= minPrice : false,
    };
  });
}

// ثبت یک بازدید صفحه‌ی محصول (برای «در ۲۴ ساعت گذشته X نفر بازدید کرده‌اند»)
export async function recordProductView(productId: string) {
  await prisma.productView.create({ data: { productId } }).catch(() => {});
}

// حداکثر یک عکس قیمت در روز برای هر محصول ثبت می‌شه (برای بج «کمترین قیمت ۱۰ روز اخیر»)
export async function recordPriceSnapshotIfNeeded(productId: string, price: number) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const existing = await prisma.priceSnapshot.findFirst({
    where: { productId, recordedAt: { gte: startOfDay } },
    select: { id: true },
  });
  if (!existing) {
    await prisma.priceSnapshot.create({ data: { productId, price } }).catch(() => {});
  }
}

// صفحه‌ی اصلی هم مستقیم و هم از مسیرِ recommend.ts این رو صدا می‌زنه -- cache()
// توی یه رندرِ سرور یک بار کوئری می‌زنه (بیرون از رندر، مثلاً route handler، بی‌اثره)
export const fetchMazonProducts = cache(fetchMazonProductsUncached);

async function fetchMazonProductsUncached(): Promise<UnifiedProduct[]> {
  const [products, activeFlashSales, stockGroups] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      include: { category: true, brand: true },
      orderBy: { createdAt: "desc" },
    }),
    fetchActiveFlashSales(),
    // مجموع موجودیِ همه‌ی ترکیب‌های هر محصول -- برای بجِ کمبودِ موجودی روی
    // کارتِ لیست («فقط N عدد باقی مونده»/«ناموجود»)
    prisma.productVariant.groupBy({ by: ["productId"], _sum: { stock: true } }),
  ]);

  const flashByProductId = new Map(activeFlashSales.map((f) => [f.productId, f]));
  const stockByProductId = new Map(stockGroups.map((g) => [g.productId, g._sum.stock ?? 0]));
  const unified = products.map((p) => ({
    ...normalizeMazonProduct(p, flashByProductId.get(p.id)),
    totalStock: stockByProductId.get(p.id) ?? 0,
  }));
  return attachInsightStats(await attachSocialStats(unified));
}

// نسخه‌ی تک‌محصولی (برای صفحه‌ی جزئیات، نه لیست) -- بدون نیاز به batch
export async function fetchViewCount24h(productId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return prisma.productView.count({ where: { productId, createdAt: { gte: since } } });
}

// تعدادِ بازدیدهای همین محصول توی N دقیقه‌ی اخیر -- برای «نشانه‌ی اجتماعیِ
// لحظه‌ای» روی صفحه‌ی محصول (جدا از fetchViewCount24h که بازه‌ش ۲۴ساعته و
// برای حسِ «همین الان» گسترده‌ست)
export async function fetchRecentViewersCount(
  productId: string,
  windowMinutes: number,
): Promise<number> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);
  return prisma.productView.count({ where: { productId, createdAt: { gte: since } } });
}

export async function fetchIsLowestPrice10d(productId: string, currentPrice: number): Promise<boolean> {
  const since = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
  const result = await prisma.priceSnapshot.aggregate({
    where: { productId, recordedAt: { gte: since } },
    _min: { price: true },
  });
  const minPrice = result._min.price;
  return minPrice !== null ? currentPrice <= minPrice : false;
}

// تاریخچه‌ی قیمت برای نمودار -- ۹۰ روز اخیر، صعودی، با آمار کمترین/بیشترین/میانگین
export async function fetchPriceHistory(
  productId: string,
  currentPrice: number
): Promise<ReturnType<typeof buildPriceHistory>> {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const snapshots = await prisma.priceSnapshot.findMany({
    where: { productId, recordedAt: { gte: since } },
    select: { price: true, recordedAt: true },
    orderBy: { recordedAt: "asc" },
  });
  return buildPriceHistory(
    snapshots.map((s) => ({ price: s.price, recordedAt: s.recordedAt.toISOString() })),
    currentPrice
  );
}

// کدهای تخفیفی که ادمین صراحتاً برای نمایش به‌عنوان بجِ تبلیغاتی روی صفحه‌ی
// محصولاتِ مزون علامت زده (Coupon.showcaseOnProducts) -- فقط اونایی که هنوز
// واقعاً قابل‌استفاده‌ان (فعال، منقضی نشده، ظرفیتش تموم نشده)
export async function fetchShowcasedCoupons(): Promise<
  { code: string; type: string; value: number }[]
> {
  const now = new Date();
  const coupons = await prisma.coupon.findMany({
    where: {
      showcaseOnProducts: true,
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
    },
    select: { code: true, type: true, value: true, maxUses: true, usedCount: true },
  });
  return coupons
    .filter((c) => c.maxUses === null || c.usedCount < c.maxUses)
    .map((c) => ({ code: c.code, type: c.type, value: c.value }));
}

export async function fetchMazonProductBySlug(slug: string): Promise<
  | (UnifiedProduct & {
      variants: ProductWithVariants["variants"];
      specifications: ProductWithVariants["specifications"];
      attributeGroupMap: Record<string, string>; // نام ویژگی -> نام گروهش (اگه عضو گروهی باشه)
      colorImages: Record<string, string[]>; // مقدار رنگ -> عکس‌های اختصاصی اون رنگ
      categoryId: string; // برای محاسبه‌ی ویژگی‌های ثابت ارث‌بری‌شده (مثلا جنسیت)
      brandId: string | null; // برای پیدا کردن راهنمای سایز مخصوص این دسته‌بندی+برند
    })
  | null
> {
  const product: ProductWithVariants | null = await prisma.product.findUnique({
    where: { slug: normalizeSlug(slug) },
    include: {
      category: true,
      brand: true,
      variants: { include: { values: true } },
      specifications: { orderBy: { order: "asc" } },
    },
  });
  if (!product) return null;

  const activeFlashSales = await fetchActiveFlashSales();
  const flashSale = activeFlashSales.find((f) => f.productId === product.id);

  // به‌جای مقایسه متنی اسم ویژگی (که با کاراکترهای نامرئی فارسی می‌تونه به‌ظاهر یکی
  // ولی از نظر بایت متفاوت باشه)، از جدول ProductAttribute که موقع ساخت محصول با
  // شناسه واقعی ویژگی پر شده استفاده می‌کنیم -- این دقیق و قابل‌اتکاست
  const productAttributes = await prisma.productAttribute.findMany({
    where: { productId: product.id },
    include: { attribute: { include: { group: true } } },
  });

  const attributeGroupMap: Record<string, string> = {};
  for (const pa of productAttributes) {
    if (pa.attribute.group) attributeGroupMap[pa.attribute.name] = pa.attribute.group.name;
  }

  return {
    ...normalizeMazonProduct(product, flashSale),
    variants: product.variants,
    specifications: product.specifications,
    attributeGroupMap,
    colorImages: parseColorImages(product.colorImages),
    categoryId: product.categoryId,
    brandId: product.brandId,
  };
}

// راهنمای سایز مخصوص ترکیب دسته‌بندی+برند این محصول -- اگه تعریف نشده باشه null برمی‌گردونه.
// id هم برمی‌گردونه تا ویجتِ «پیشنهاد سایز بر اساس قد/وزن» بتونه ردیف‌های عددی‌ش رو بگیره
export async function fetchSizeGuideImage(
  categoryId: string,
  brandId: string | null
): Promise<{ id: string; imageUrl: string } | null> {
  if (!brandId) return null;
  const guide = await prisma.sizeGuide.findUnique({
    where: { categoryId_brandId: { categoryId, brandId } },
    select: { id: true, imageUrl: true },
  });
  return guide;
}

// ترکیب هر دو منبع - برای صفحه اصلی/لیست محصولات
export async function fetchAllProducts(): Promise<UnifiedProduct[]> {
  const [mazon, trendyol] = await Promise.all([
    fetchMazonProducts(),
    fetchTrendyolProducts(),
  ]);
  return [...mazon, ...trendyol];
}

// تعداد فروش هر محصول مزون (بر اساس OrderItem) - برای مرتب‌سازی "پرفروش‌ترین"
// محصولات ترندیول فروش واقعی ثبت نمی‌شه، پس همیشه صفر می‌گیرن
export async function fetchPopularityMap(): Promise<Record<string, number>> {
  const grouped = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: { productId: { not: null } },
    _sum: { quantity: true },
  });

  const map: Record<string, number> = {};
  for (const g of grouped) {
    if (g.productId) map[g.productId] = g._sum.quantity ?? 0;
  }
  return map;
}

// میانگین امتیاز نظرات هر محصول مزون - برای فیلتر «حداقل امتیاز»
export async function fetchRatingMap(): Promise<Record<string, number>> {
  const grouped = await prisma.review.groupBy({
    by: ["productId"],
    where: { isApproved: true, productId: { not: null } },
    _avg: { rating: true },
  });

  const map: Record<string, number> = {};
  for (const g of grouped) {
    if (g.productId) map[g.productId] = g._avg.rating ?? 0;
  }
  return map;
}

// وزن تازگی: خریدِ جدیدتر در «هم‌خریدی» وزن بیشتری داره تا پیشنهادهای داغ و
// فعلی بالاتر بیان. هر روز به این ضریب ضرب می‌شه (۰.۹۸۵ ≈ نیمه‌عمر ~۴۶ روز)
export const RECENCY_DECAY_PER_DAY = 0.985;

// رتبه‌بندی محصولات هم‌خرید: از لیست {productId, createdAt} یک امتیاز تازگی‌دار
// می‌سازه و مرتب‌شده برمی‌گردونه. خالص و بدون DB -- برای تست.
export type CoPurchaseOccurrence = { productId: string; createdAt: Date };

export function rankFrequentlyBoughtTogether(
  occurrences: CoPurchaseOccurrence[],
  limit = 4,
  now: Date = new Date()
): { productId: string; score: number }[] {
  const scoreByProduct = new Map<string, number>();
  for (const { productId, createdAt } of occurrences) {
    const days = Math.max(0, (now.getTime() - createdAt.getTime()) / 86_400_000);
    const weight = Math.pow(RECENCY_DECAY_PER_DAY, days);
    scoreByProduct.set(productId, (scoreByProduct.get(productId) ?? 0) + weight);
  }
  return Array.from(scoreByProduct.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([productId, score]) => ({ productId, score }));
}

// فقط سفارش‌هایی که واقعاً پرداخت شده‌اند و لغو/برگشتی نیستند -- وگرنه
// سفارش‌های رها/لغوشده هم توی پیشنهاد «هم‌خریدی» حساب می‌شدن
const RECOMMENDABLE_ORDER_FILTER: Prisma.OrderWhereInput = {
  paymentStatus: "PAID",
  status: { notIn: ["CANCELLED", "RETURNED"] },
};

// نگاشتِ contentId های ترندیول/میلا به کارتِ قابل‌نمایش -- عین همون منطقِ
// resolveTrendyolSnapshots که قبلاً فقط توی recommend.ts بود؛ چون
// fetchFrequentlyBoughtTogether (پایین) هم به همین نیاز داره، اینجا (لایه‌ی
// پایین‌تر) منتقل و export شده تا recommend.ts از همینجا دوباره استفاده کنه
// (recommend.ts از قبل fetchMazonProducts رو از همین فایل import می‌کنه، پس
// جهتِ وابستگی همینه -- برعکسش import چرخه‌ای می‌ساخت)
export async function resolveTrendyolProductSnapshots(externalIds: string[]): Promise<Map<string, UnifiedProduct>> {
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

// "این محصولات هم با هم خریده می‌شن" -- بر اساس اینکه چه محصولات دیگه‌ای توی
// همون سفارش‌های پرداخت‌شده‌ای بودن که این محصول توشون بوده، با وزن‌دهی به
// تازگی خرید. هم محصولاتِ مزون هم ترندیول/میلا رو (چه به‌عنوانِ seed، چه
// به‌عنوانِ پیشنهاد) پوشش می‌ده -- قبلاً فقط مزون بود که چون فعلاً هیچ محصولِ
// مزونی روی سایت نیست، عملاً این فیچر برای کل کاتالوگِ واقعی (ترندیول) مرده بود
export async function fetchFrequentlyBoughtTogether(seed: string, limit = 4): Promise<UnifiedProduct[]> {
  // seed می‌تونه cuid یا اسلاگِ یه محصولِ مزون باشه (صفحه‌ی محصول cuid می‌فرسته،
  // ولی سبدِ خرید فقط اسلاگ رو نگه می‌داره -- store/cart.ts) یا contentId یه
  // محصولِ ترندیول/میلا؛ اول ببینیم seed به کدوم محصولِ مزون می‌خوره (اگه اصلاً بخوره)
  const mazonProduct = await prisma.product.findFirst({
    where: { OR: [{ id: seed }, { slug: seed }] },
    select: { id: true },
  });
  const mazonSeedId = mazonProduct?.id ?? null;
  const seedFilter = [...(mazonSeedId ? [{ productId: mazonSeedId }] : []), { externalId: seed }];

  // سفارش‌های پرداخت‌شده‌ای که این محصول توشونه
  const ordersWithProduct = await prisma.orderItem.findMany({
    where: { OR: seedFilter, order: RECOMMENDABLE_ORDER_FILTER },
    select: { orderId: true },
  });
  const orderIds = Array.from(new Set(ordersWithProduct.map((o) => o.orderId)));
  if (orderIds.length === 0) return [];

  // سایر آیتم‌های همون سفارش‌ها (به‌جز خود این محصول) -- به‌همراه تاریخ سفارش
  // برای وزن تازگی. عمداً فیلترِ حذفِ خودِ seed رو توی SQL (با NOT) انجام
  // نمی‌دیم -- چون productId/externalId هرکدوم برای نصفِ ردیف‌ها NULL هستن
  // (یکی مزونه یکی ترندیول)، و "NOT {field: value}"ِ پرایزما روی فیلدِ NULL
  // طبقِ سه‌مقداریِ SQL نتیجه‌ی نامعلوم می‌ده و کلِ ردیف رو (حتی وقتی واقعاً
  // seed نیست) از خروجی می‌ندازه -- قبلاً دقیقاً همین باعث می‌شد این بخش برای
  // محصولاتِ مزون همیشه خالی برگرده. برای همین همه‌ی آیتم‌ها رو می‌گیریم و
  // خودِ seed رو توی جاوااسکریپت فیلتر می‌کنیم
  const isSeedItem = (i: { productId: string | null; externalId: string | null }) =>
    (mazonSeedId !== null && i.productId === mazonSeedId) || i.externalId === seed;

  const coItems = await prisma.orderItem.findMany({
    where: {
      orderId: { in: orderIds },
      order: RECOMMENDABLE_ORDER_FILTER,
    },
    select: { productId: true, externalId: true, order: { select: { createdAt: true } } },
  });

  // شناسه‌ی یکپارچه: مزون همون productId، ترندیول/میلا با پیشوند "ext:" (تا
  // هیچ‌وقت با cuid های مزون تصادفی برابر نشه)
  const occurrences: CoPurchaseOccurrence[] = coItems
    .filter((i) => !isSeedItem(i))
    .map((i) => ({
      productId: i.productId ?? (i.externalId ? `ext:${i.externalId}` : null),
      createdAt: i.order.createdAt,
    }))
    .filter((o): o is CoPurchaseOccurrence => !!o.productId);

  const topIds = rankFrequentlyBoughtTogether(occurrences, limit).map((r) => r.productId);
  if (topIds.length === 0) return [];

  const mazonIds = topIds.filter((id) => !id.startsWith("ext:"));
  const externalIds = topIds.filter((id) => id.startsWith("ext:")).map((id) => id.slice(4));

  const [mazonProducts, activeFlashSales, trendyolByKey] = await Promise.all([
    mazonIds.length > 0
      ? prisma.product.findMany({ where: { id: { in: mazonIds }, isActive: true }, include: { category: true, brand: true } })
      : Promise.resolve([]),
    fetchActiveFlashSales(),
    resolveTrendyolProductSnapshots(externalIds),
  ]);
  const flashByProductId = new Map(activeFlashSales.map((f) => [f.productId, f]));
  const mazonByKey = new Map(
    mazonProducts.map((p) => [p.id, normalizeMazonProduct(p, flashByProductId.get(p.id))])
  );

  // ترتیب رو طبق فراوانی هم‌خریدی حفظ می‌کنیم
  const unified = topIds
    .map((id) => (id.startsWith("ext:") ? trendyolByKey.get(id) : mazonByKey.get(id)))
    .filter((p): p is UnifiedProduct => !!p);
  return attachInsightStats(await attachSocialStats(unified));
}

// کد نمایشی کوتاه محصول (چیزی شبیه CH3888 توی مدیسه) -- از روی id ساخته می‌شه، نیازی به فیلد جدید توی دیتابیس نیست
export function productDisplayCode(id: string): string {
  const alnum = id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `MZ-${alnum.slice(-6)}`;
}

// زنجیره‌ی دسته‌بندی از ریشه تا برگ -- برای بردکرامب صفحه محصول (با اسلاگ دسته‌ی برگ صدا زده می‌شه)
export async function fetchCategoryBreadcrumb(
  categorySlug: string
): Promise<{ name: string; slug: string }[]> {
  const leaf = await prisma.category.findUnique({
    where: { slug: categorySlug },
    select: { id: true },
  });
  if (!leaf) return [];

  const chain: { name: string; slug: string }[] = [];
  let currentId: string | null = leaf.id;

  // حداکثر ۵ سطح بالا می‌ریم تا از حلقه بی‌نهایت در داده خراب جلوگیری بشه
  for (let i = 0; i < 5 && currentId; i++) {
    const category: { id: string; name: string; slug: string; parentId: string | null } | null =
      await prisma.category.findUnique({
        where: { id: currentId },
        select: { id: true, name: true, slug: true, parentId: true },
      });
    if (!category) break;
    chain.unshift({ name: category.name, slug: category.slug });
    currentId = category.parentId;
  }

  return chain;
}

// خلاصه امتیاز یک محصول -- میانگین و تعداد نظرات (برای نمایش ستاره بالای صفحه محصول)
export async function fetchProductRatingSummary(
  productId: string
): Promise<{ avg: number; count: number }> {
  const agg = await prisma.review.aggregate({
    where: { productId, isApproved: true },
    _avg: { rating: true },
    _count: { rating: true },
  });
  return { avg: agg._avg.rating ?? 0, count: agg._count.rating };
}

// تعداد نفراتی که این محصول رو واقعا خریدن (سفارش‌های پرداخت‌شده و لغونشده) -- برای شمارنده اجتماعی
export async function fetchProductPurchaseCount(productId: string): Promise<number> {
  const count = await prisma.orderItem.findMany({
    where: {
      productId,
      order: {
        paymentStatus: "PAID",
        status: { not: "CANCELLED" },
      },
    },
    select: { orderId: true },
  });
  return new Set(count.map((c) => c.orderId)).size;
}

// تعداد سوال‌های ثبت‌شده برای این محصول -- برای شمارنده‌ی «X سوال‌وپاسخ» بالای صفحه محصول
export async function fetchProductQuestionCount(productId: string): Promise<number> {
  return prisma.productQuestion.count({ where: { productId } });
}

// «محصولات مزیت‌دار» -- بر خلاف بج‌های بازاریابی ترندیول («İyi Fiyat»، «Avantajlı
// Ürün») که دستی/الگوریتم داخلی‌ان و ما معادل واقعی‌شون رو نداریم، این تابع صرفاً
// روی سیگنال‌های واقعی خودمون حساب می‌کنه: امتیاز بالا (با حداقل چند نظر واقعی)،
// کمترین قیمت ۱۰ روز اخیر، داشتن تخفیف، و تعداد قابل توجه پسندیدن. محصولی که
// حداقل ۲ تا از این سیگنال‌ها رو داشته باشه «مزیت‌دار» حساب می‌شه.
function countAdvantageSignals(p: UnifiedProduct): number {
  let signals = 0;
  if ((p.rating ?? 0) >= 4.3 && (p.reviewCount ?? 0) >= 3) signals += 1;
  if (p.isLowestPrice10d) signals += 1;
  if (p.discount > 0) signals += 1;
  if ((p.wishlistCount ?? 0) >= 5) signals += 1;
  return signals;
}

export function pickAdvantageousProducts(products: UnifiedProduct[], limit = 10): UnifiedProduct[] {
  return products
    .map((p) => ({ product: p, signals: countAdvantageSignals(p) }))
    .filter((x) => x.signals >= 2)
    .sort((a, b) => {
      if (b.signals !== a.signals) return b.signals - a.signals;
      return (b.product.wishlistCount ?? 0) - (a.product.wishlistCount ?? 0);
    })
    .slice(0, limit)
    .map((x) => x.product);
}
