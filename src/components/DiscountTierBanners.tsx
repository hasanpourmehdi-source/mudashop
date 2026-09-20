import Link from "next/link";
import type { UnifiedProduct } from "@/types/product";

// بازه‌های درصد تخفیف -- مثل بنرهای «کشف بر اساس درصد تخفیف» ترندیول، ولی فقط
// روی محصولات مزون (طبق اولویت فروش موجودی مزون)
const TIERS: { threshold: number; bg: string; imgBg: string; text: string }[] = [
  { threshold: 5, bg: "#fdeee0", imgBg: "#fbdfc4", text: "#c2570f" },
  { threshold: 10, bg: "#e6f5ea", imgBg: "#cdead7", text: "#1f7a3d" },
  { threshold: 30, bg: "#e5eefc", imgBg: "#cfe0fa", text: "#1c5fc2" },
  { threshold: 50, bg: "#fbe6ee", imgBg: "#f5cddf", text: "#b3134f" },
];

export function DiscountTierBanners({ products }: { products: UnifiedProduct[] }) {
  const tiers = TIERS.map((tier) => {
    const matches = products.filter((p) => p.discount >= tier.threshold);
    if (matches.length === 0) return null;
    // بهترین تخفیف این بازه به عنوان تصویر شاخص کارت
    const representative = [...matches].sort((a, b) => b.discount - a.discount)[0];
    return { ...tier, count: matches.length, image: representative.image };
  }).filter((t): t is (typeof TIERS)[number] & { count: number; image: string } => t !== null);

  if (tiers.length === 0) return null;

  return (
    <section className="max-w-[1600px] mx-auto px-4 py-8 border-b cut-line">
      <h2 className="text-xl font-bold mb-6">بهترین تخفیف‌ها</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {tiers.map((tier) => (
          <Link
            key={tier.threshold}
            href={`/products?sources=MAZON&minDiscount=${tier.threshold}`}
            className="flex items-stretch rounded-2xl overflow-hidden border cut-line hover:border-[var(--color-wine)] transition-colors"
            style={{ background: tier.bg }}
          >
            <div
              className="w-1/2 aspect-square flex items-center justify-center p-3 shrink-0"
              style={{ background: tier.imgBg }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={tier.image}
                alt=""
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </div>
            <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
              <p className="text-2xl sm:text-3xl font-extrabold leading-tight" style={{ color: tier.text }}>
                {tier.threshold}%
              </p>
              <p className="text-xs font-medium leading-tight" style={{ color: tier.text }}>
                و بالاتر تخفیف
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
