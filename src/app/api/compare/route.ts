import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseImages } from "@/lib/products";
import { MAX_COMPARE_COUNT, type CompareProduct } from "@/lib/compare";

// بارگذاری محصولات مقایسه بر اساس شناسه‌ها (فقط مزون) -- ترتیب پاسخ دقیقاً
// مطابق ترتیب درخواستی است. تعداد محدود به MAX_COMPARE_COUNT.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const rawIds: unknown = body?.ids;
  if (!Array.isArray(rawIds)) {
    return NextResponse.json({ error: "شناسه‌های محصول لازم است" }, { status: 400 });
  }

  const ids = rawIds.filter((x): x is string => typeof x === "string").slice(0, MAX_COMPARE_COUNT);
  if (ids.length === 0) return NextResponse.json({ products: [] });

  const [products, activeFlashSales, reviewStats] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: ids }, isActive: true },
      include: {
        category: { select: { name: true } },
        brand: { select: { name: true } },
        specifications: { orderBy: { order: "asc" }, select: { label: true, value: true } },
        variants: { include: { values: true } },
      },
    }),
    prisma.flashSale.findMany({
      where: {
        isActive: true,
        stock: { gt: 0 },
        startsAt: { lte: new Date() },
        endsAt: { gte: new Date() },
      },
      select: { productId: true, discountPercent: true },
    }),
    prisma.review.groupBy({
      by: ["productId"],
      where: { productId: { in: ids }, isApproved: true },
      _avg: { rating: true },
      _count: { rating: true },
    }),
  ]);

  const flashMap = new Map(activeFlashSales.map((f) => [f.productId, f.discountPercent]));
  const reviewMap = new Map(reviewStats.map((r) => [r.productId, { avg: r._avg.rating ?? 0, count: r._count.rating }]));
  const productMap = new Map(products.map((p) => [p.id, p]));

  const compareProducts: CompareProduct[] = [];
  for (const id of ids) {
    const p = productMap.get(id);
    if (!p) continue;
    const discount = flashMap.get(id) ?? p.discount;
    const price = Math.round(p.basePrice * (1 - discount / 100));
    const images = parseImages(p.images);

    // ویژگی‌ها (سایز/رنگ و...) از مقادیر واقعی variant ها
    const attrMap = new Map<string, Set<string>>();
    for (const v of p.variants) {
      for (const vv of v.values) {
        if (!attrMap.has(vv.attribute)) attrMap.set(vv.attribute, new Set());
        attrMap.get(vv.attribute)!.add(vv.value);
      }
    }

    const rating = reviewMap.get(id);
    compareProducts.push({
      id,
      slug: p.slug,
      title: p.title,
      image: images[0] ?? "",
      price,
      originalPrice: p.basePrice,
      discount,
      brand: p.brand?.name ?? null,
      categoryName: p.category?.name ?? null,
      fastShipping: p.fastShipping,
      rating: rating ? { avg: rating.avg, count: rating.count } : { avg: 0, count: 0 },
      specifications: p.specifications.map((s) => ({ label: s.label, value: s.value })),
      attributes: [...attrMap.entries()].map(([name, values]) => ({ name, values: [...values] })),
    });
  }

  return NextResponse.json({ products: compareProducts });
}