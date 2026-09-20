"use client";

import { useEffect, useState } from "react";
import type { UnifiedProduct } from "@/types/product";
import { AddToCartForm } from "@/components/AddToCartForm";

type QuickViewVariant = {
  id: string;
  stock: number;
  priceDiff: number;
  values: { attribute: string; value: string }[];
  measurements: { label: string; cm: number }[];
};

type QuickViewDetail = {
  id: string;
  slugOrId: string;
  title: string;
  image: string;
  images: string[];
  price: number;
  originalPrice: number;
  discount: number;
  fastShipping: boolean;
  flashSaleId: string | null;
  variants: QuickViewVariant[];
  attributeGroupMap: Record<string, string>;
  colorImages: Record<string, string[]>;
  sizeGuideImage: string | null;
  sizeGuideId: string | null;
};

// «نگاه سریع» برای محصولاتِ مزون -- معادلِ TrendyolQuickView، ولی به‌جای
// بازسازیِ منطقِ انتخابِ ترکیب/افزودن‌به‌سبد، مستقیم همون AddToCartFormِ خودِ
// صفحه‌ی محصول رو دوباره استفاده می‌کنه (شاملِ ویشلیست، پیشنهادِ ارزون‌ترین
// ترکیب، اندازه‌ی هر سایز، و...) -- تا هیچ رفتاری بینِ صفحه‌ی کامل و مودال فرق نکنه
export function MazonQuickView({
  initialProduct,
  isWishlisted = false,
  onClose,
}: {
  initialProduct: UnifiedProduct;
  isWishlisted?: boolean;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<QuickViewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [galleryIndex, setGalleryIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    fetch(`/api/products/mazon/${initialProduct.slugOrId}/quick-view`)
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "خطا در دریافت اطلاعات محصول");
          return;
        }
        setDetail(data);
      })
      .catch(() => {
        if (!cancelled) setError("خطا در دریافت اطلاعات محصول");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialProduct.slugOrId]);

  const gallery = detail && detail.images.length > 0 ? detail.images : [initialProduct.image];
  const detailHref = `/products/mazon/${initialProduct.slugOrId}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto grid md:grid-cols-2 gap-6 p-5 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 left-3 w-8 h-8 rounded-full bg-[var(--color-linen-dim)] hover:bg-[var(--color-line)] flex items-center justify-center text-lg z-10"
          aria-label="بستن"
        >
          ×
        </button>

        {loading && !detail && (
          <div className="md:col-span-2 py-20 text-center text-sm text-[var(--color-muted)]">
            در حال دریافت اطلاعات محصول...
          </div>
        )}

        {error && !detail && (
          <div className="md:col-span-2 py-20 text-center text-sm text-red-600">{error}</div>
        )}

        {detail && (
          <>
            {/* گالری */}
            <div className="relative aspect-[3/4] bg-[var(--color-linen-dim)] rounded-lg overflow-hidden">
              {gallery[galleryIndex] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={gallery[galleryIndex]}
                  alt={detail.title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              {gallery.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setGalleryIndex((i) => (i - 1 + gallery.length) % gallery.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow"
                    aria-label="عکس قبلی"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() => setGalleryIndex((i) => (i + 1) % gallery.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow"
                    aria-label="عکس بعدی"
                  >
                    ›
                  </button>
                </>
              )}
            </div>

            {/* اطلاعات + فرمِ خرید (دقیقاً همون چیزی که صفحه‌ی کاملِ محصول داره) */}
            <div className="flex flex-col">
              <h2 className="text-lg font-bold mb-3">{detail.title}</h2>
              <AddToCartForm
                productId={detail.id}
                slugOrId={detail.slugOrId}
                source="MAZON"
                title={detail.title}
                image={detail.image}
                basePrice={detail.price}
                originalPrice={detail.originalPrice}
                discount={detail.discount}
                variants={detail.variants}
                flashSaleId={detail.flashSaleId ?? undefined}
                attributeGroupMap={detail.attributeGroupMap}
                colorImages={detail.colorImages}
                isWishlisted={isWishlisted}
                fastShipping={detail.fastShipping}
                sizeGuideImage={detail.sizeGuideImage ?? undefined}
                sizeGuideId={detail.sizeGuideId ?? undefined}
              />

              <a
                href={detailHref}
                className="text-xs text-center text-[var(--color-muted)] hover:underline mt-4"
              >
                رفتن به صفحه‌ی کامل محصول ←
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
