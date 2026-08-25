import Link from "next/link";
import type { DiscoveredCampaignForDisplay } from "@/lib/trendyolCampaigns";
import { AdminClickToTranslate } from "@/components/AdminClickToTranslate";
import { HorizontalScroller } from "@/components/HorizontalScroller";

// «کمپین‌های ترندیول» -- کشف‌شده به‌مرور از محصولاتی که کاربران روی خودِ سایتِ
// ما دیده‌اند (نه یک کرالِ کامل)، پس کاربر مستقیم از صفحه‌ی اصلی وارد لیستِ
// کاملِ محصولاتِ یک کمپین می‌شود، بدون این‌که اول باید یک محصولِ خاص را باز کند
export function TrendyolCampaignsShowcase({
  campaigns,
  isAdmin,
}: {
  campaigns: DiscoveredCampaignForDisplay[];
  isAdmin: boolean;
}) {
  if (campaigns.length === 0) return null;

  return (
    <section className="max-w-[1600px] mx-auto px-4 py-8 border-b cut-line">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">🏷️ کمپین‌های ترندیول</h2>
        <Link
          href="/campaigns"
          className="text-sm font-medium text-[var(--color-wine)] hover:underline flex items-center gap-1"
        >
          مشاهده همه ‹
        </Link>
      </div>
      <HorizontalScroller>
        {campaigns.map((c) => (
          <Link
            key={`${c.siteSlug}-${c.campaignId}`}
            href={`/marketplaces/${c.siteSlug}/campaign/${c.campaignId}?text=${encodeURIComponent(c.text)}`}
            className="shrink-0 w-40 sm:w-48 rounded-xl overflow-hidden bg-white border cut-line hover:border-[var(--color-wine)] transition-colors"
          >
            <div className="relative aspect-square bg-[var(--color-linen-dim)]">
              {c.sampleImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.sampleImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
              )}
              <span className="absolute top-1.5 right-1.5 text-[10px] font-bold bg-black/60 text-white rounded-full px-2 py-0.5">
                {c.siteLabel}
              </span>
            </div>
            <div className="p-2.5">
              <p className="text-xs font-bold line-clamp-2 leading-snug">
                <AdminClickToTranslate text={c.text} isAdmin={isAdmin} />
              </p>
            </div>
          </Link>
        ))}
      </HorizontalScroller>
    </section>
  );
}
