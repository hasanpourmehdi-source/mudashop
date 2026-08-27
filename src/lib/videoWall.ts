import { prisma } from "@/lib/prisma";
import { parseImages } from "@/lib/products";
import { internalTrendyolProductHref } from "@/lib/trendyolProductLink";
import { getCachedTrendyolProductUrl } from "@/lib/trendyolProductUrlCache";

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov"];
function isVideoUrl(url: string): boolean {
  return VIDEO_EXTENSIONS.some((ext) => url.toLowerCase().endsWith(ext));
}

export type VideoWallItem = {
  id: string;
  videoUrl: string;
  title: string;
  href: string;
  kind: "official" | "review";
};

// «دیوارِ ویدیو»ی صفحه‌ی اصلی -- دو منبع رو یک‌جا می‌کنه:
//  ۱. ویدیوهای رسمیِ محصولاتِ مزون (Product.videoUrl، از پنل ادمین)
//  ۲. ویدیوهایی که مشتری‌ها ضمیمه‌ی نظرشون کردن (چه مزون چه ترندیول/میلا)
// برای اقلامِ ترندیول عمداً به Review.productTitle/productImage (اسنپ‌شاتِ لحظه‌ی
// ثبتِ نظر) تکیه می‌کنیم، نه یه فچِ زنده‌ی خارجی به‌ازای هر ویدیو -- این صفحه‌ی
// اصلیه، باید سریع رندر بشه
export async function fetchVideoWallItems(limit = 12): Promise<VideoWallItem[]> {
  const [officialProducts, videoReviews] = await Promise.all([
    prisma.product.findMany({
      where: { videoUrl: { not: null }, isActive: true },
      select: { id: true, slug: true, title: true, videoUrl: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.review.findMany({
      where: { isApproved: true, NOT: { images: "[]" } },
      select: {
        id: true,
        images: true,
        source: true,
        productId: true,
        externalId: true,
        productTitle: true,
        product: { select: { slug: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit * 3, // چون باید فیلترِ «واقعاً ویدیو داره» رو توی جاوااسکریپت بزنیم
    }),
  ]);

  const official: VideoWallItem[] = officialProducts
    .filter((p): p is typeof p & { videoUrl: string } => !!p.videoUrl)
    .map((p) => ({
      id: `product-${p.id}`,
      videoUrl: p.videoUrl,
      title: p.title,
      href: `/products/mazon/${p.slug}`,
      kind: "official",
    }));

  const reviewItems: VideoWallItem[] = [];
  for (const r of videoReviews) {
    if (reviewItems.length >= limit) break;
    const videoUrl = parseImages(r.images).find(isVideoUrl);
    if (!videoUrl) continue;

    let href: string | null = null;
    if (r.source === "MAZON" && r.product) {
      href = `/products/mazon/${r.product.slug}`;
    } else if (r.externalId) {
      const trendyolUrl = await getCachedTrendyolProductUrl(r.externalId);
      href = internalTrendyolProductHref(r.externalId, trendyolUrl);
    }
    if (!href) continue;

    reviewItems.push({
      id: `review-${r.id}`,
      videoUrl,
      title: r.productTitle ?? "محصول",
      href,
      kind: "review",
    });
  }

  return [...official, ...reviewItems].slice(0, limit);
}
