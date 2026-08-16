"use client";

import { useRef } from "react";
import { UnifiedProduct } from "@/types/product";
import { ProductCard } from "@/components/ProductCard";

export function HorizontalProductCarousel({
  products,
  wishlistedIds,
}: {
  products: UnifiedProduct[];
  wishlistedIds: Set<string>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollByAmount(amount: number) {
    scrollRef.current?.scrollBy({ left: amount, behavior: "smooth" });
  }

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        {products.map((p) => (
          <div key={p.id} className="w-40 sm:w-48 shrink-0 snap-start">
            <ProductCard product={p} isWishlisted={wishlistedIds.has(p.id)} />
          </div>
        ))}
      </div>

      {/* دکمه پیکان برای اسکرول -- چون سایت راست‌به‌چپه، پیکان سمت راست یعنی برو به آیتم‌های بعدی */}
      {products.length > 2 && (
        <button
          type="button"
          onClick={() => scrollByAmount(-260)}
          aria-label="محصولات بعدی"
          className="hidden sm:flex absolute top-1/2 -translate-y-1/2 -right-3 w-9 h-9 rounded-full bg-white shadow-lg border cut-line items-center justify-center hover:scale-105 transition-transform"
        >
          ‹
        </button>
      )}
    </div>
  );
}
