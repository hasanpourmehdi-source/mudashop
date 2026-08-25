import Link from "next/link";
import { auth } from "@/lib/auth";
import { fetchDiscoveredCampaignsForHomepage } from "@/lib/trendyolCampaigns";
import { AdminClickToTranslate } from "@/components/AdminClickToTranslate";

// همه‌ی کمپین‌های کشف‌شده (نه فقط ۸ تای اولِ صفحه‌ی اصلی) -- کشف به‌مرورِ
// محصولاتی که کاربران روی خودِ سایت دیده‌اند، نه یک کرالِ کامل
const MAX_CAMPAIGNS = 200;

export default async function CampaignsPage() {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";
  const campaigns = await fetchDiscoveredCampaignsForHomepage(MAX_CAMPAIGNS);

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8">
      <h1 className="text-xl font-bold mb-1">🏷️ کمپین‌های ترندیول</h1>
      <p className="text-sm text-[var(--color-muted)] mb-6">
        کمپین‌های واقعی که تا الان از محصولاتِ دیده‌شده روی سایت پیدا شده‌اند.
      </p>

      {campaigns.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">هنوز کمپینی پیدا نشده — با گشتن بین محصولات، کمپین‌های واقعی خودکار پیدا می‌شوند.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {campaigns.map((c) => (
            <Link
              key={`${c.siteSlug}-${c.campaignId}`}
              href={`/marketplaces/${c.siteSlug}/campaign/${c.campaignId}?text=${encodeURIComponent(c.text)}`}
              className="rounded-xl overflow-hidden bg-white border cut-line hover:border-[var(--color-wine)] transition-colors"
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
        </div>
      )}
    </div>
  );
}
