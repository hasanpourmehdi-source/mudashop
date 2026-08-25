import Link from "next/link";
import type { Category } from "@prisma/client";
import type { UnifiedProduct } from "@/types/product";
import { categoryIcon } from "@/lib/categoryIcon";
import { HorizontalScroller } from "@/components/HorizontalScroller";

// «کشف تخفیف‌ها بر اساس دسته‌بندی» -- مثل ردیف دسته‌بندی ترندیول با بج قرمز درصد،
// ولی فقط دسته‌هایی که واقعاً محصول مزون تخفیف‌دار دارن نشون داده می‌شن
export function CategoryDiscountShowcase({
  categories,
  products,
}: {
  categories: Category[];
  products: UnifiedProduct[];
}) {
  const cards = categories
    .map((cat) => {
      const discounted = products.filter(
        (p) => p.categorySlug === cat.slug && p.discount > 0
      );
      if (discounted.length === 0) return null;
      const representative = [...discounted].sort((a, b) => b.discount - a.discount)[0];
      const image = cat.imageUrl ?? representative.image;
      const { color } = categoryIcon(cat.name);
      return { category: cat, image, color };
    })
    .filter((c): c is { category: Category; image: string; color: string } => c !== null);

  if (cards.length === 0) return null;

  return (
    <section className="max-w-[1600px] mx-auto px-4 py-8 border-b cut-line">
      <h2 className="text-xl font-bold mb-6">کشف تخفیف‌ها بر اساس دسته‌بندی</h2>
      <HorizontalScroller>
        {cards.map(({ category, image, color }) => (
          <Link
            key={category.id}
            href={`/products?sources=MAZON&categories=${category.slug}&minDiscount=1`}
            className="flex flex-col items-center gap-2 shrink-0 w-28 group"
          >
            <div className="relative w-28 h-28 rounded-2xl overflow-hidden bg-[var(--color-linen-dim)] border cut-line group-hover:border-[var(--color-wine)] transition-colors">
              <div
                className="absolute inset-3 rounded-full"
                style={{ background: color }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image}
                alt=""
                className="absolute inset-0 w-full h-full object-contain p-4"
              />
              <span className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-[var(--color-wine)] text-white text-xs font-bold flex items-center justify-center shadow">
                %
              </span>
            </div>
            <span className="text-xs font-medium text-center leading-tight">
              {category.name}
            </span>
          </Link>
        ))}
      </HorizontalScroller>
    </section>
  );
}
