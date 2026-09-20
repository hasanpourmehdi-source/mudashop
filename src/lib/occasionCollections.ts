import { prisma } from "@/lib/prisma";
import { normalizeMazonProduct } from "@/lib/products";
import type { UnifiedProduct } from "@/types/product";

export type ActiveOccasionCollection = {
  id: string;
  title: string;
  slug: string;
  bannerImage: string;
  description: string | null;
  endsAt: Date;
  products: UnifiedProduct[];
};

// مجموعه‌های مناسبتیِ فعال همین الان (isActive + توی بازه‌ی startsAt/endsAt) --
// دقیقاً همون الگویِ fetchActiveCampaigns، بعلاوه‌ی نرمالایزِ آیتم‌های مزون/ترندیول
export async function fetchActiveOccasionCollections(): Promise<ActiveOccasionCollection[]> {
  const now = new Date();
  const collections = await prisma.occasionCollection.findMany({
    where: { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } },
    include: { items: { orderBy: { addedAt: "asc" } } },
    orderBy: { endsAt: "asc" },
  });

  const mazonIds = [
    ...new Set(
      collections.flatMap((c) => c.items.filter((i) => i.source === "MAZON" && i.productId).map((i) => i.productId!))
    ),
  ];
  const mazonProducts = mazonIds.length
    ? await prisma.product.findMany({
        where: { id: { in: mazonIds }, isActive: true },
        include: { category: true, brand: true },
      })
    : [];
  const mazonById = new Map(mazonProducts.map((p) => [p.id, normalizeMazonProduct(p)]));

  return collections
    .map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      bannerImage: c.bannerImage,
      description: c.description,
      endsAt: c.endsAt,
      products: c.items
        .map((item): UnifiedProduct | null => {
          if (item.source === "MAZON") {
            return item.productId ? mazonById.get(item.productId) ?? null : null;
          }
          if (!item.externalId) return null;
          const price = item.price ?? 0;
          const originalPrice = item.originalPrice ?? price;
          const discount = originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;
          return {
            id: `trendyol-${item.externalId}`,
            source: "TRENDYOL",
            slugOrId: item.externalId,
            externalId: item.externalId,
            title: item.title ?? "",
            brand: null,
            price,
            originalPrice,
            discount,
            image: item.image ?? "",
            images: item.image ? [item.image] : [],
            sourceUrl: item.productUrl ?? undefined,
            createdAt: item.addedAt.toISOString(),
          };
        })
        .filter((p): p is UnifiedProduct => p !== null),
    }))
    .filter((c) => c.products.length > 0);
}
