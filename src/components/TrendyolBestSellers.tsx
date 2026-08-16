import { TrendyolProductLink } from "@/components/TrendyolProductLink";
import { VerifiedBadge } from "@/components/TrendyolBadges";
import { AdminOriginalTitleCopy } from "@/components/AdminOriginalTitleCopy";
import type { TrendyolLiveProduct } from "@/lib/trendyol";

// جای‌گزین ما برای ویجت «Popüler Ürünler» صفحه‌ی محصول ترندیول -- اون ویجت با
// یه فچ جدای سمت کلاینت خودِ ترندیول میاد که توی HTML اولیه‌ی صفحه نیست و
// قابل رهگیری از سمت ما نیست، پس به‌جاش پرفروش‌ترین‌های همون دسته رو از جست‌وجوی
// زنده‌ی خودمون (sst=BEST_SELLER) می‌آریم -- همون داده، از یه مسیر مطمئن‌تر
export function TrendyolBestSellers({
  products,
  isAdmin = false,
}: {
  products: TrendyolLiveProduct[];
  isAdmin?: boolean;
}) {
  if (products.length === 0) return null;

  return (
    <div className="mt-8 pt-6 border-t cut-line">
      <h2 className="font-bold mb-4">پرفروش‌ترین‌های همین دسته</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-thin">
        {products.map((p) => (
          <TrendyolProductLink
            key={p.id}
            contentId={p.id}
            trendyolUrl={p.url}
            title={p.nameFa}
            className="group flex flex-col shrink-0 w-36 sm:w-44 snap-start border cut-line rounded-lg overflow-hidden bg-white hover:shadow-lg transition-shadow"
          >
            <div className="relative aspect-[3/4] shrink-0 bg-[var(--color-linen-dim)] overflow-hidden">
              {p.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.image}
                  alt={p.nameFa}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              )}
            </div>

            <div className="p-3 flex flex-col flex-1">
              {p.brand && (
                <p className="text-xs font-bold text-[var(--color-muted)] mb-0.5 flex items-center gap-1">
                  {p.brand}
                  {p.hasOfficialSellerBadge && (
                    <span title="فروشنده‌ی رسمی/تاییدشده">
                      <VerifiedBadge className="w-3.5 h-3.5 shrink-0" />
                    </span>
                  )}
                </p>
              )}
              <h3 className="text-sm font-medium line-clamp-2 mb-1.5 min-h-[2.5rem]">{p.nameFa}</h3>
              <AdminOriginalTitleCopy originalTitle={p.name} isAdmin={isAdmin} />

              {!!p.reviewCount && p.reviewCount > 0 && (
                <p className="text-[11px] text-[var(--color-muted)] mb-2 flex items-center gap-1">
                  <span className="text-[var(--color-ochre)]">★</span>
                  <span className="font-bold text-[var(--color-ink)]">
                    {(p.rating ?? 0).toLocaleString("fa-IR", { maximumFractionDigits: 1 })}
                  </span>
                  <span>({p.reviewCount.toLocaleString("fa-IR")})</span>
                </p>
              )}

              <div className="flex items-baseline gap-2 mt-auto pt-1">
                {p.price != null && (
                  <span className="font-bold text-[var(--color-wine)]">
                    {p.price.toLocaleString("fa-IR")} تومان
                  </span>
                )}
                {p.originalPrice != null && p.price != null && p.originalPrice > p.price && (
                  <span className="text-xs text-[var(--color-muted)] line-through">
                    {p.originalPrice.toLocaleString("fa-IR")}
                  </span>
                )}
              </div>
            </div>
          </TrendyolProductLink>
        ))}
      </div>
    </div>
  );
}
