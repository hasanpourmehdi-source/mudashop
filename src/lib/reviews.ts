import { prisma } from "@/lib/prisma";

export type PhotoReview = {
  id: string;
  comment: string;
  rating: number;
  image: string; // اولین عکسی که کاربر ضمیمه‌ی نظرش کرده
  productTitle: string;
  productSlug: string;
  productImage: string;
  brandName: string | null;
};

function parseImageArray(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === "string") : [];
  } catch {
    return [];
  }
}

// نظرات تاییدشده‌ای که عکس دارن -- برای بخش «نظرات عکس‌دار محبوب» صفحه‌ی اصلی.
// چون سیستم لایک روی نظرات نداریم، «محبوب» یعنی امتیاز بالاتر و بعد تازه‌تر بودن.
// فقط نظرات مزون (source: MAZON) -- چون این ویجت به صفحه‌ی محصول با slug/برند
// محلی لینک می‌ده که برای محصولات ترندیول (بدون رکورد محلی) معنی نداره
export async function fetchPopularPhotoReviews(limit = 10): Promise<PhotoReview[]> {
  const reviews = await prisma.review.findMany({
    where: { isApproved: true, NOT: { images: "[]" }, source: "MAZON" },
    include: { product: { include: { brand: true } } },
    orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
    take: limit * 2, // چند تا رزرو اضافه چون بعضی‌ها ممکنه بعد از parse عکس معتبر نداشته باشن
  });

  return reviews
    .filter((r): r is typeof r & { product: NonNullable<(typeof r)["product"]> } => r.product !== null)
    .map((r) => {
      const images = parseImageArray(r.images);
      if (images.length === 0) return null;
      const productImages = parseImageArray(r.product.images);

      return {
        id: r.id,
        comment: r.comment,
        rating: r.rating,
        image: images[0],
        productTitle: r.product.title,
        productSlug: r.product.slug,
        productImage: productImages[0] ?? images[0],
        brandName: r.product.brand?.name ?? null,
      };
    })
    .filter((r): r is PhotoReview => r !== null)
    .slice(0, limit);
}
