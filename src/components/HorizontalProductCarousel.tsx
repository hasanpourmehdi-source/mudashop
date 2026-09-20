import { UnifiedProduct } from "@/types/product";
import { ProductCard } from "@/components/ProductCard";
import { HorizontalScroller } from "@/components/HorizontalScroller";

export function HorizontalProductCarousel({
  products,
  wishlistedIds,
}: {
  products: UnifiedProduct[];
  wishlistedIds: Set<string>;
}) {
  return (
    <HorizontalScroller>
      {products.map((p) => (
        <div key={p.id} className="w-40 sm:w-48 shrink-0">
          <ProductCard product={p} isWishlisted={wishlistedIds.has(p.id)} />
        </div>
      ))}
    </HorizontalScroller>
  );
}
