"use client";

import { useMemo, useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import type { UnifiedProduct } from "@/types/product";

type TabKey = "flash" | "discounted" | "popular" | "newest" | "fastShipping";

const TABS: { key: TabKey; label: string }[] = [
  { key: "flash", label: "فلش ⚡" },
  { key: "discounted", label: "تخفیف‌دار" },
  { key: "popular", label: "پرفروش‌ترین" },
  { key: "newest", label: "جدیدترین" },
  { key: "fastShipping", label: "ارسال فوری" },
];

export function DiscoverableProductsSection({
  products,
  popularity,
  wishlistedIds,
}: {
  products: UnifiedProduct[];
  popularity: Record<string, number>;
  wishlistedIds: string[];
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("flash");
  const wishlistSet = useMemo(() => new Set(wishlistedIds), [wishlistedIds]);

  const filteredProducts = useMemo(() => {
    switch (activeTab) {
      case "flash":
        return products.filter((p) => p.flashSale);
      case "discounted":
        return [...products].filter((p) => p.discount > 0).sort((a, b) => b.discount - a.discount);
      case "popular":
        return [...products].sort((a, b) => (popularity[b.id] ?? 0) - (popularity[a.id] ?? 0));
      case "newest":
        return [...products].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      case "fastShipping":
        return products.filter((p) => p.fastShipping);
      default:
        return products;
    }
  }, [activeTab, products, popularity]).slice(0, 10);

  if (products.length === 0) return null;

  return (
    <section className="max-w-[1600px] mx-auto px-4 py-8 border-b cut-line">
      <h2 className="text-xl font-bold mb-4">محصولات قابل کشف</h2>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-4">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium border-2 cut-line transition-colors ${
              activeTab === tab.key
                ? "bg-[var(--color-wine)] border-[var(--color-wine)] text-white"
                : "bg-white hover:border-[var(--color-wine)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filteredProducts.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">فعلاً محصولی توی این دسته نیست.</p>
      ) : (
        <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-1">
          {filteredProducts.map((p) => (
            <div key={p.id} className="w-44 sm:w-52 shrink-0">
              <ProductCard product={p} isWishlisted={wishlistSet.has(p.id)} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
