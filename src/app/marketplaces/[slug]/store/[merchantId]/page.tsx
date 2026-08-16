import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { fetchWishlistedTrendyolIds } from "@/lib/wishlist";
import { fetchTrendyolSellerInfo } from "@/lib/trendyolSellerStore";
import { fetchTrendyolProductsFromUrl } from "@/lib/trendyol";
import { logTrendyolFetchFailure } from "@/lib/trendyolFetchLog";
import { VerifiedBadge } from "@/components/TrendyolBadges";
import { TrendyolLiveGrid } from "@/components/TrendyolLiveGrid";

export default async function TrendyolStorePage({
  params,
}: {
  params: Promise<{ slug: string; merchantId: string }>;
}) {
  const { slug, merchantId } = await params;

  const site = await prisma.externalSite.findUnique({ where: { slug } });
  if (!site || !site.isActive) notFound();

  const host = new URL(site.baseUrl).host;

  let seller;
  try {
    seller = await fetchTrendyolSellerInfo(host, merchantId, "magaza");
  } catch (err) {
    console.warn("خطا در واکشی اطلاعات فروشگاه ترندیول:", err);
    await logTrendyolFetchFailure({
      url: `magaza/-m-${merchantId}`,
      error: String(err),
      source: "best-sellers",
      siteSlug: slug,
    });
    seller = null;
  }
  if (!seller) notFound();

  const session = await auth();
  const wishlistedTrendyolIds = await fetchWishlistedTrendyolIds(session?.user?.id);

  let initialProducts: Awaited<ReturnType<typeof fetchTrendyolProductsFromUrl>>["products"] = [];
  let initialNextUrl: string | null = null;
  try {
    // پارامتر mid روی endpoint سرچ خودِ ترندیول -- تأیید‌شده با تست واقعی
    // (توی feedingSourceDataKey/deeplink ویجت‌های خودِ صفحه‌ی فروشگاه دیده شد)
    const searchUrl = `${site.baseUrl}mid=${merchantId}`;
    const result = await fetchTrendyolProductsFromUrl(searchUrl);
    initialProducts = result.products;
    initialNextUrl = result.nextUrl;
  } catch (err) {
    console.warn("خطا در واکشی محصولات فروشگاه ترندیول:", err);
    await logTrendyolFetchFailure({
      url: `sr?mid=${merchantId}`,
      error: String(err),
      source: "search",
      siteSlug: slug,
    });
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8">
      <div className="border cut-line rounded-xl overflow-hidden bg-white mb-8">
        {seller.bannerImage && (
          <div className="relative h-32 sm:h-48 bg-[var(--color-linen-dim)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={seller.bannerImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
          </div>
        )}
        <div className="p-5 flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold flex items-center gap-2" dir="ltr">
            {seller.name}
            {seller.verified && <VerifiedBadge className="w-5 h-5 shrink-0" />}
          </h1>
          {seller.score !== null && (
            <span className="text-xs font-bold bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full">
              امتیاز {seller.score.toLocaleString("fa-IR")}
            </span>
          )}
          <span className="text-xs text-[var(--color-muted)]">
            {seller.productCount.toLocaleString("fa-IR")} محصول
          </span>
          {seller.rankingText && (
            <span className="text-xs font-bold text-[var(--color-ochre)]">{seller.rankingText}</span>
          )}
        </div>
      </div>

      {initialProducts.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">محصولی از این فروشگاه پیدا نشد.</p>
      ) : (
        <TrendyolLiveGrid
          initialProducts={initialProducts}
          initialNextUrl={initialNextUrl}
          initialWishlistedIds={Array.from(wishlistedTrendyolIds)}
        />
      )}
    </div>
  );
}
