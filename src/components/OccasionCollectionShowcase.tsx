import type { ActiveOccasionCollection } from "@/lib/occasionCollections";
import { ProductCard } from "@/components/ProductCard";
import { HorizontalScroller } from "@/components/HorizontalScroller";

// «مجموعه‌های مناسبتی» -- کالکشنِ زمان‌دارِ ادمین‌ساخته از هر برند/دسته‌ای
// (یلدا، روزِ مادر، بلک‌فرایدی و ...)؛ ممکنه چند مجموعه هم‌زمان فعال باشن،
// هرکدوم یه بخشِ جدا
export function OccasionCollectionShowcase({ collections }: { collections: ActiveOccasionCollection[] }) {
  if (collections.length === 0) return null;

  return (
    <>
      {collections.map((collection) => (
        <section key={collection.id} className="max-w-[1600px] mx-auto px-4 py-8 border-b cut-line">
          <div className="mb-6 rounded-2xl overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={collection.bannerImage} alt={collection.title} className="w-full h-auto object-cover" />
          </div>
          <h2 className="text-xl font-bold mb-1">{collection.title}</h2>
          {collection.description && (
            <p className="text-sm text-[var(--color-muted)] mb-4">{collection.description}</p>
          )}
          <HorizontalScroller>
            {collection.products.map((p) => (
              <div key={p.id} className="w-44 sm:w-52 shrink-0">
                <ProductCard product={p} />
              </div>
            ))}
          </HorizontalScroller>
        </section>
      ))}
    </>
  );
}
