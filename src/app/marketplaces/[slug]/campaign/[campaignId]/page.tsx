import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { fetchWishlistedTrendyolIds } from "@/lib/wishlist";
import { fetchTrendyolProductsFromUrl } from "@/lib/trendyol";
import { logTrendyolFetchFailure } from "@/lib/trendyolFetchLog";
import { TrendyolLiveGrid } from "@/components/TrendyolLiveGrid";

// صفحه‌ی داخلیِ خودمون برای «همه‌ی محصولاتِ یک کمپین» -- به‌جای لینک مستقیم
// به ترندیول. پارامتر `prm=` روی همون endpoint سرچِ خودِ ترندیول (`/sr?...`)
// دقیقاً همون کاری رو می‌کنه که وقتی خودِ کاربر روی کمپین کلیک می‌کند و به
// `trendyol.com/sr?prm={id}` می‌رود انجام می‌شود (تأیید‌شده با تستِ واقعی) --
// این‌جا با همون مکانیزمِ fetchTrendyolProductsFromUrl که برای صفحه‌ی فروشگاه
// (`store/[merchantId]`) هم استفاده می‌شه، فقط با پارامترِ `prm` به‌جای `mid`
export default async function TrendyolCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; campaignId: string }>;
  searchParams: Promise<{ text?: string }>;
}) {
  const { slug, campaignId } = await params;
  const { text } = await searchParams;

  const site = await prisma.externalSite.findUnique({ where: { slug } });
  if (!site || !site.isActive) notFound();
  if (!/^\d+$/.test(campaignId)) notFound();

  const session = await auth();
  const wishlistedTrendyolIds = await fetchWishlistedTrendyolIds(session?.user?.id);

  let initialProducts: Awaited<ReturnType<typeof fetchTrendyolProductsFromUrl>>["products"] = [];
  let initialNextUrl: string | null = null;
  try {
    const searchUrl = `${site.baseUrl}prm=${campaignId}`;
    const result = await fetchTrendyolProductsFromUrl(searchUrl);
    initialProducts = result.products;
    initialNextUrl = result.nextUrl;
  } catch (err) {
    console.warn("خطا در واکشی محصولات کمپین ترندیول:", err);
    await logTrendyolFetchFailure({
      url: `sr?prm=${campaignId}`,
      error: String(err),
      source: "search",
      siteSlug: slug,
    });
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8">
      <div className="mb-6 flex items-center gap-2">
        <span className="text-2xl">🏷️</span>
        <h1 className="text-xl font-bold">{text ? text : "محصولاتِ این کمپین"}</h1>
      </div>

      {initialProducts.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">محصولی برای این کمپین پیدا نشد.</p>
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
