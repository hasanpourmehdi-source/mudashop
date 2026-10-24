import { prisma } from "@/lib/prisma";
import { parseImages } from "@/lib/products";
import { internalTrendyolProductHref } from "@/lib/trendyolProductLink";

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

  const picked: { r: (typeof videoReviews)[number]; videoUrl: string }[] = [];
  for (const r of videoReviews) {
    if (picked.length >= limit) break;
    const videoUrl = parseImages(r.images).find(isVideoUrl);
    if (!videoUrl) continue;
    if (!(r.source === "MAZON" && r.product) && !r.externalId) continue;
    picked.push({ r, videoUrl });
  }

  // آدرسِ کاملِ ترندیول همه‌ی ویدیوها با یه کوئری (قبلاً به‌ازای هر ویدیو یه کوئریِ پشت‌سرِهم بود)
  const externalIds = picked
    .filter(({ r }) => !(r.source === "MAZON" && r.product) && r.externalId)
    .map(({ r }) => r.externalId as string);
  const urlRows = externalIds.length
    ? await prisma.trendyolProductUrlCache.findMany({
        where: { contentId: { in: externalIds } },
        select: { contentId: true, url: true },
      })
    : [];
  const urlById = new Map(urlRows.map((row) => [row.contentId, row.url]));

  const reviewItems: VideoWallItem[] = picked.map(({ r, videoUrl }) => ({
    id: `review-${r.id}`,
    videoUrl,
    title: r.productTitle ?? "محصول",
    href:
      r.source === "MAZON" && r.product
        ? `/products/mazon/${r.product.slug}`
        : internalTrendyolProductHref(r.externalId as string, urlById.get(r.externalId as string)),
    kind: "review",
  }));

  return [...official, ...reviewItems].slice(0, limit);
}
