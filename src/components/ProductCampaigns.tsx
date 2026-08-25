import Link from "next/link";
import { AdminClickToTranslate } from "@/components/AdminClickToTranslate";

// کارت‌های کمپینِ واقعیِ محصول -- عین چیدمانِ خودِ ترندیول («ÜRÜNÜN
// KAMPANYALARI»): آیکون + متن + فلش، نه روی خودِ عکس (اون فقط برای پوستر
// اینستاگرامه). به‌جای لینک مستقیم به ترندیول، به صفحه‌ی داخلیِ خودمون
// (`/marketplaces/[slug]/campaign/[campaignId]`) می‌رود -- همون فهرستِ کاملِ
// محصولاتِ این کمپین، فقط داخلِ خودِ سایت‌مون رندر شده
export function ProductCampaigns({
  badges,
  siteSlug,
  isAdmin,
}: {
  badges: { id: number; text: string }[];
  siteSlug: string;
  isAdmin: boolean;
}) {
  if (badges.length === 0) return null;

  return (
    <div className="mb-4">
      <p className="text-xs font-bold text-[var(--color-muted)] mb-2">کمپین‌های این محصول</p>
      <div className="flex flex-col gap-2">
        {badges.map((badge) => {
          const isShipping = badge.text.includes("ارسال");
          return (
            <Link
              key={badge.id}
              href={`/marketplaces/${siteSlug}/campaign/${badge.id}?text=${encodeURIComponent(badge.text)}`}
              className="flex items-center gap-2 border cut-line rounded-xl px-3 py-2.5 hover:bg-[var(--color-linen-dim)] transition-colors"
            >
              <span className="text-lg shrink-0">{isShipping ? "📦" : "🏷️"}</span>
              <span className="flex-1 text-sm font-medium">
                <AdminClickToTranslate text={badge.text} isAdmin={isAdmin} />
              </span>
              <span className="text-[var(--color-muted)]">‹</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
