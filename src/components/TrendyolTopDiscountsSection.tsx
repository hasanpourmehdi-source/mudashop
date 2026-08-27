import { TrendyolProductLink } from "@/components/TrendyolProductLink";
import { discountPercent } from "@/lib/trendyolTopDiscounts";
import type { TrendyolLiveProduct } from "@/lib/trendyol";

// «پرتخفیف‌ترین‌های ترندیول» -- برای کسی که دنبال چیز خاصی نیست ولی یه تخفیف
// خوب می‌تونه ترغیبش کنه بخره
export function TrendyolTopDiscountsSection({
  products,
  siteLabel,
}: {
  products: TrendyolLiveProduct[];
  siteLabel: string;
}) {
  if (products.length === 0) return null;

  return (
    <section className="max-w-[1600px] mx-auto px-4 py-8">
      <h2 className="font-bold text-lg mb-4">🔥 پرتخفیف‌ترین‌های {siteLabel}</h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {products.map((p) => (
          <TrendyolProductLink
            key={p.id}
            contentId={p.id}
            trendyolUrl={p.url}
            title={p.nameFa}
            className="group flex flex-col shrink-0 w-36 sm:w-44 border cut-line rounded-lg overflow-hidden bg-white hover:shadow-lg transition-shadow"
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
              <span className="ribbon-tag absolute top-2 left-0 font-bold">
                {discountPercent(p)}%-
              </span>
            </div>
            <div className="p-3 flex flex-col flex-1">
              <h3 className="text-sm font-medium line-clamp-2 mb-1.5 min-h-[2.5rem]">{p.nameFa}</h3>
              <div className="mt-auto">
                <span className="text-sm font-bold">{p.price?.toLocaleString("fa-IR")} تومان</span>
                {p.originalPrice != null && (
                  <span className="block text-xs text-[var(--color-muted)] line-through">
                    {p.originalPrice.toLocaleString("fa-IR")}
                  </span>
                )}
              </div>
            </div>
          </TrendyolProductLink>
        ))}
      </div>
    </section>
  );
}
