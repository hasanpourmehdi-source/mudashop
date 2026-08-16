"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { TrendyolProductDetail } from "@/lib/trendyolProductDetail";
import type { TrendyolLiveProduct } from "@/lib/trendyol";
import { useCart } from "@/hooks/useCart";
import { internalTrendyolProductHref } from "@/components/TrendyolProductLink";
import { StarRating, VerifiedBadge, getStripBadgeLabel } from "@/components/TrendyolBadges";
import { WishlistButton } from "@/components/WishlistButton";
import { AdminOriginalTitleCopy } from "@/components/AdminOriginalTitleCopy";

// «نگاه سریع» -- مثل Hızlı Bakış ترندیول: بدون رفتن به صفحه‌ی جدا، جزئیات کامل
// (رنگ‌ها، سایزها، قیمت دقیق) رو توی یه مودال نشون می‌ده و امکان افزودن به
// سبد رو می‌ده. initialProduct همون داده‌ی سبک کارت گریده (برای نمایش فوری
// قبل از رسیدن جزئیات کامل)؛ detail جزئیات کامله که async میاد.
export function TrendyolQuickView({
  initialProduct,
  isWishlisted = false,
  onClose,
}: {
  initialProduct: TrendyolLiveProduct;
  isWishlisted?: boolean;
  onClose: () => void;
}) {
  const { addItem } = useCart();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [activeUrl, setActiveUrl] = useState(initialProduct.url);
  const [detail, setDetail] = useState<TrendyolProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!activeUrl) {
      setError("لینک این محصول در دسترس نیست");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    setGalleryIndex(0);
    setSelectedSize(null);
    setAdded(false);

    fetch(`/api/trendyol/quick-view?url=${encodeURIComponent(activeUrl)}`)
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "خطا در دریافت اطلاعات محصول");
          return;
        }
        setDetail(data);
        // آدرس واقعی رو کش می‌کنیم تا اگه بعداً کاربر رفت صفحه‌ی کامل محصول
        // (یا از سبد خرید)، 404 نگیره -- دقیقاً همون کاری که TrendyolProductLink می‌کنه
        fetch("/api/trendyol/cache-product-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentId: String(data.contentId), url: activeUrl }),
        }).catch(() => {});
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
  }, [activeUrl]);

  function handleAdd() {
    if (!detail || !detail.inStock) return;
    if (detail.sizes.length > 0 && !selectedSize) return;

    const variantSuffix = selectedSize ? `-${selectedSize}` : "";
    addItem({
      id: `trendyol-${detail.contentId}${variantSuffix}`,
      source: "TRENDYOL",
      productId: detail.contentId,
      title: detail.nameFa,
      image: detail.images[0] ?? "",
      price: detail.price ?? 0,
      originalPrice: discountPercent > 0 ? detail.originalPrice ?? undefined : undefined,
      quantity: 1,
      variantLabel: selectedSize ? `سایز: ${selectedSize}` : undefined,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  const discountPercent =
    detail?.originalPrice && detail?.price && detail.originalPrice > detail.price
      ? Math.round(((detail.originalPrice - detail.price) / detail.originalPrice) * 100)
      : 0;

  const canAdd = !!detail && detail.inStock && (detail.sizes.length === 0 || !!selectedSize);
  const detailHref = detail ? internalTrendyolProductHref(detail.contentId, activeUrl) : null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
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
              {initialProduct.campaignSeal && (
                <span
                  className="absolute top-2 left-2 z-10 flex items-center justify-center text-center rounded-full text-white text-[9px] font-extrabold w-14 h-14 leading-tight p-1 shadow-md"
                  style={{ background: initialProduct.campaignSeal.color }}
                >
                  {initialProduct.campaignSeal.label}
                </span>
              )}
              {detail.images[galleryIndex] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={detail.images[galleryIndex]}
                  alt={detail.nameFa}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              {detail.images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setGalleryIndex((i) => (i - 1 + detail.images.length) % detail.images.length)
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow"
                    aria-label="عکس قبلی"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() => setGalleryIndex((i) => (i + 1) % detail.images.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow"
                    aria-label="عکس بعدی"
                  >
                    ›
                  </button>
                </>
              )}
            </div>

            {/* اطلاعات */}
            <div className="flex flex-col">
              {/* ردیف بالا: دسته‌بندی + بج رتبه‌ای (مثل «Kadın Sütyen kategorisinde En Çok Ziyaret Edile..») */}
              {(initialProduct.category || (initialProduct.stripBadge && getStripBadgeLabel(initialProduct.stripBadge.type, initialProduct.stripBadge.title))) && (
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {initialProduct.category && (
                    <span className="text-xs text-[var(--color-muted)]">
                      در دسته‌ی {initialProduct.category}
                    </span>
                  )}
                  {initialProduct.stripBadge && getStripBadgeLabel(initialProduct.stripBadge.type, initialProduct.stripBadge.title) && (
                    <span
                      className="text-[10px] font-bold text-white rounded-full px-2 py-0.5"
                      style={{ background: initialProduct.stripBadge.color }}
                    >
                      {getStripBadgeLabel(initialProduct.stripBadge.type, initialProduct.stripBadge.title)}
                    </span>
                  )}
                </div>
              )}

              {detail.brand && (
                <p className="text-xs font-bold text-[var(--color-muted)] mb-1 flex items-center gap-1" dir="ltr">
                  {detail.brand}
                  {initialProduct.hasOfficialSellerBadge && (
                    <span title="فروشنده‌ی رسمی/تاییدشده">
                      <VerifiedBadge className="w-3.5 h-3.5 shrink-0" />
                    </span>
                  )}
                </p>
              )}
              <h2 className="text-lg font-bold mb-2">{detail.nameFa}</h2>
              <AdminOriginalTitleCopy originalTitle={detail.name} isAdmin={isAdmin} alwaysVisible />

              {!!initialProduct.reviewCount && initialProduct.reviewCount > 0 && (
                <p className="text-[13px] text-[var(--color-muted)] mb-1.5 flex items-center gap-1.5">
                  <StarRating rating={initialProduct.rating ?? 0} />
                  <span className="font-bold text-[var(--color-ink)]">
                    {(initialProduct.rating ?? 0).toLocaleString("fa-IR", { maximumFractionDigits: 1 })}
                  </span>
                  <span>({initialProduct.reviewCount.toLocaleString("fa-IR")} نظر)</span>
                </p>
              )}

              {initialProduct.socialProofFavoriteCount && (
                <p className="text-[13px] text-[var(--color-muted)] mb-3 flex items-center gap-1.5">
                  <span className="text-[var(--color-wine)]">♥</span>
                  {initialProduct.socialProofFavoriteCount} نفر پسندیدن!
                </p>
              )}

              {detail.images.length > 1 && (
                <div className="flex items-center gap-2 mb-4">
                  {detail.images.slice(0, 5).map((img, i) => (
                    <button
                      key={img + i}
                      type="button"
                      onClick={() => setGalleryIndex(i)}
                      className={`relative w-12 h-14 rounded-md overflow-hidden border-2 shrink-0 ${
                        i === galleryIndex
                          ? "border-[var(--color-wine)]"
                          : "border-transparent hover:border-[var(--color-muted)]"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {detail.colorVariants.length > 1 && (
                <div className="mb-4">
                  <p className="text-xs text-[var(--color-muted)] mb-1.5">رنگ</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {detail.colorVariants.map((v) => (
                      <button
                        key={v.contentId}
                        type="button"
                        title={v.colorName}
                        onClick={() => v.url && setActiveUrl(v.url)}
                        className={`relative w-12 h-14 rounded-md overflow-hidden border-2 shrink-0 ${
                          v.contentId === detail.contentId
                            ? "border-[var(--color-wine)]"
                            : "border-transparent hover:border-[var(--color-muted)]"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={v.image} alt={v.colorName} className="absolute inset-0 w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {detail.sizes.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-[var(--color-muted)] mb-1.5">سایز</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {detail.sizes.map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setSelectedSize(size)}
                        className={`px-3 py-1.5 rounded-lg border text-sm ${
                          selectedSize === size
                            ? "border-[var(--color-wine)] bg-[var(--color-wine)] text-white"
                            : "cut-line hover:border-[var(--color-wine)]"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-baseline gap-2 mb-4">
                {discountPercent > 0 && (
                  <span
                    dir="ltr"
                    className="text-[11px] font-bold text-white bg-[var(--color-wine)] rounded px-1.5 py-0.5"
                  >
                    ٪-{discountPercent.toLocaleString("fa-IR")}
                  </span>
                )}
                {detail.price != null && (
                  <span className="text-xl font-bold text-[var(--color-wine)]">
                    {detail.price.toLocaleString("fa-IR")} تومان
                  </span>
                )}
                {detail.originalPrice != null && detail.price != null && detail.originalPrice > detail.price && (
                  <span className="text-xs text-[var(--color-muted)] line-through">
                    {detail.originalPrice.toLocaleString("fa-IR")}
                  </span>
                )}
              </div>

              {!detail.inStock && (
                <p className="text-sm text-red-600 mb-3">این محصول موجود نیست</p>
              )}
              {detail.inStock && detail.sizes.length > 0 && !selectedSize && (
                <p className="text-xs text-[var(--color-muted)] mb-3">اول سایز رو انتخاب کن</p>
              )}

              <div className="mt-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!canAdd}
                  className="flex-1 bg-[var(--color-wine)] text-white rounded-full py-2.5 font-medium disabled:opacity-50 hover:bg-[var(--color-wine-dark)] transition-colors"
                >
                  {added ? "افزوده شد ✓" : "افزودن به سبد"}
                </button>
                <WishlistButton
                  trendyol={{
                    externalId: String(initialProduct.id),
                    title: detail.nameFa,
                    image: detail.images[0] ?? "",
                    url: activeUrl ?? "",
                    price: detail.price ?? 0,
                  }}
                  initialWishlisted={isWishlisted}
                  variant="icon"
                />
              </div>

              {detailHref && (
                <a href={detailHref} className="text-xs text-center text-[var(--color-muted)] hover:underline mt-3">
                  رفتن به صفحه‌ی کامل محصول ←
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
