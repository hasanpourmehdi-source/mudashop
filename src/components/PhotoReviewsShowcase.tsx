import Link from "next/link";
import type { PhotoReview } from "@/lib/reviews";
import { HorizontalScroller } from "@/components/HorizontalScroller";

// «نظرات عکس‌دار محبوب» -- مثل بخش ترندیول، ولی بر پایه‌ی نظرات واقعی تاییدشده‌ی
// خودمون که کاربر عکس ضمیمه‌شون کرده
export function PhotoReviewsShowcase({ reviews }: { reviews: PhotoReview[] }) {
  if (reviews.length === 0) return null;

  return (
    <section className="max-w-[1600px] mx-auto px-4 py-8">
      <div
        className="rounded-2xl overflow-hidden p-4 sm:p-5"
        style={{ background: "linear-gradient(90deg, #f2a71a, #f27a1a)" }}
      >
        <h2 className="text-white font-extrabold text-lg mb-4">نظرات عکس‌دار محبوب</h2>
        <HorizontalScroller>
          {reviews.map((r) => (
            <Link
              key={r.id}
              href={`/products/mazon/${r.productSlug}#reviews`}
              className="shrink-0 w-40 sm:w-48 rounded-xl overflow-hidden bg-white group"
            >
              <div className="relative aspect-[3/4] bg-[var(--color-linen-dim)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.image}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2.5 pt-8 pb-2.5">
                  <p className="text-white text-xs font-medium line-clamp-2 leading-snug">
                    {r.comment}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.productImage}
                  alt=""
                  className="w-8 h-8 rounded object-cover shrink-0 border cut-line"
                />
                <div className="min-w-0">
                  {r.brandName && (
                    <p className="text-[11px] font-bold truncate">{r.brandName}</p>
                  )}
                  <p className="text-[11px] text-[var(--color-muted)] truncate">
                    {r.productTitle}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </HorizontalScroller>
      </div>
    </section>
  );
}
