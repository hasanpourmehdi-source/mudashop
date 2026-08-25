"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import type { TrendyolLiveProduct } from "@/lib/trendyol";
import { TrendyolProductLink } from "@/components/TrendyolProductLink";
import { TrendyolQuickView } from "@/components/TrendyolQuickView";
import { WishlistButton } from "@/components/WishlistButton";
import { StarRating, VerifiedBadge, EyeIcon, getStripBadgeLabel } from "@/components/TrendyolBadges";
import { AdminOriginalTitleCopy } from "@/components/AdminOriginalTitleCopy";
import { AdminOriginalLinkCopy } from "@/components/AdminOriginalLinkCopy";

// میلا/ترندیول در مرز صفحه‌ها محصولات تکراری برمی‌گردونن (همان id) -- dedup
// به‌جای append خام، تا کلید React تکراری نشه (که باعث می‌شد کارت‌ها dup
// شوند و ارور console بده) و عدد کارت‌ها دقیق بمونه
export function dedupeProducts(
  current: TrendyolLiveProduct[],
  incoming: TrendyolLiveProduct[]
): TrendyolLiveProduct[] {
  const seen = new Set(current.map((p) => String(p.id)));
  const fresh = incoming.filter((p) => !seen.has(String(p.id)));
  return [...current, ...fresh];
}

function TrendyolProductCard({
  p,
  onQuickView,
  isWishlisted,
  attrsQuery,
}: {
  p: TrendyolLiveProduct;
  onQuickView: (p: TrendyolLiveProduct) => void;
  isWishlisted: boolean;
  attrsQuery?: string;
}) {
  const gallery = p.images.length > 0 ? p.images : p.image ? [p.image] : [];
  const [activeIndex, setActiveIndex] = useState(0);
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (gallery.length <= 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeX = (e.clientX - rect.left) / rect.width; // 0 تا 1
    const index = Math.min(gallery.length - 1, Math.max(0, Math.floor(relativeX * gallery.length)));
    setActiveIndex(index);
  }

  function handleMouseLeave() {
    setActiveIndex(0);
  }

  const displayedImage = gallery[activeIndex];

  return (
    <TrendyolProductLink
      contentId={p.id}
      trendyolUrl={p.url}
      attrsQuery={attrsQuery}
      className="group flex flex-col h-full border cut-line rounded-lg overflow-hidden bg-white hover:shadow-lg transition-shadow"
    >
      <div
        className="relative aspect-[3/4] shrink-0 bg-[var(--color-linen-dim)] overflow-hidden"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {displayedImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayedImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        )}

        {/* قلب علاقه‌مندی -- گوشه‌ی بالا-راست، جای خالی روی عکس (مهر بالا-چپه،
            نگاه سریع پایین-چپ، اسپانسری/نقاط پایین-وسط/راست) */}
        <WishlistButton
          trendyol={{
            externalId: String(p.id),
            title: p.nameFa,
            image: p.image ?? "",
            url: p.url ?? "",
            price: p.price ?? 0,
          }}
          initialWishlisted={isWishlisted}
          variant="trendyol-card"
        />

        {/* مهر دایره‌ای گوشه‌ی بالا-چپ -- طراحی خودمونه (رنگ+متن فارسی)، نه
            کپی دقیق گرافیک ترندیول، چون خودِ آدرس تصویر مهرشون توی داده‌ی خام
            همیشه خالی برمی‌گرده (stamps:{}) */}
        {p.campaignSeal && (
          <span
            className="absolute top-2 left-2 z-10 flex items-center justify-center text-center rounded-full text-white text-[9px] font-extrabold w-14 h-14 leading-tight p-1 shadow-md"
            style={{ background: p.campaignSeal.color }}
          >
            {p.campaignSeal.label}
          </span>
        )}

        {/* نشانگر شماره عکس -- پایین‌وسط، مثل ProductCard مزون */}
        {gallery.length > 1 && (
          <div className="absolute bottom-2 inset-x-0 flex items-center justify-center gap-1 z-10">
            {gallery.map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all ${
                  i === activeIndex ? "w-3 bg-white" : "w-1 bg-white/50"
                }`}
              />
            ))}
          </div>
        )}

        {p.isAd && (
          <span className="absolute bottom-2 right-2 text-[9px] font-medium px-1.5 py-0.5 rounded bg-black/60 text-white">
            اسپانسری
          </span>
        )}

        {/* دکمه‌ی «نگاه سریع» -- فقط موقع هاور روی عکس ظاهر می‌شه، مثل Hızlı Bakış
            ترندیول. preventDefault+stopPropagation لازمه چون این دکمه داخل
            TrendyolProductLink (یه <a>) هست و نباید ناوبری رو راه بندازه.
            hover:bg/hover:text تغییر رنگ موقع هاور مستقیم روی خودِ دکمه رو
            تضمین می‌کنه (نه فقط ظاهرشدنش موقع هاور روی عکس) */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onQuickView(p);
          }}
          className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-colors bg-white/95 hover:bg-[var(--color-wine)] text-[var(--color-ink)] hover:text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow flex items-center gap-1.5 z-20 cursor-pointer"
        >
          <EyeIcon className="w-3.5 h-3.5" />
          نگاه سریع
        </button>
      </div>

      {/* بج نواری زیر عکس -- فقط برای type هایی که واقعاً از داده‌ی خام ترندیول
          تأیید کردیم (پرفروش‌ترین/پربازدیدترین/بیشترین‌امتیاز/محبوب‌ترین با
          رتبه، یا فروشنده‌ی موفق/مجاز/انتخاب اینفلوئنسر/با‌هم‌بخر با متن
          مستقیم) -- type های ناشناخته مخفی می‌مونن، نه یه متن ثابت اشتباه */}
      {p.stripBadge && getStripBadgeLabel(p.stripBadge.type, p.stripBadge.title) && (
        <div
          className="flex items-center gap-1 px-3 py-1 text-[10px] font-bold text-white shrink-0"
          style={{ background: p.stripBadge.color }}
        >
          {p.stripBadge.icon && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.stripBadge.icon} alt="" className="w-3 h-3" />
          )}
          <span>{getStripBadgeLabel(p.stripBadge.type, p.stripBadge.title)}</span>
        </div>
      )}

      <div className="p-3 flex flex-col flex-1">
        {p.brand && (
          <p className="text-xs font-bold text-[var(--color-muted)] mb-0.5 flex items-center gap-1" dir="ltr">
            {p.brand}
            {p.hasOfficialSellerBadge && (
              <span title="فروشنده‌ی رسمی/تاییدشده">
                <VerifiedBadge className="w-3.5 h-3.5 shrink-0" />
              </span>
            )}
          </p>
        )}
        <h3
          className="text-sm font-medium line-clamp-2 mb-1.5 min-h-[2.5rem]"
          dir="rtl"
        >
          {p.nameFa}
        </h3>
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <AdminOriginalTitleCopy originalTitle={p.name} isAdmin={isAdmin} />
          {p.url && <AdminOriginalLinkCopy url={p.url} isAdmin={isAdmin} alwaysVisible={false} />}
        </div>

        {p.socialProofOrderCount && (
          <p className="text-[11px] text-[var(--color-muted)] mb-1">
            🛍 {p.socialProofOrderCount} کاربر اخیراً خریده‌اند
          </p>
        )}

        {p.socialProofFavoriteCount && (
          <p className="text-[11px] text-[var(--color-muted)] mb-1 flex items-center gap-1">
            <span className="text-[var(--color-wine)]">♥</span>
            {p.socialProofFavoriteCount} نفر پسندیدن!
          </p>
        )}

        {!!p.reviewCount && p.reviewCount > 0 && (
          <p className="text-[11px] text-[var(--color-muted)] mb-2 flex items-center gap-1">
            <StarRating rating={p.rating ?? 0} />
            <span className="font-bold text-[var(--color-ink)]">
              {(p.rating ?? 0).toLocaleString("fa-IR", { maximumFractionDigits: 1 })}
            </span>
            <span>({p.reviewCount.toLocaleString("fa-IR")})</span>
            {p.hasReviewPhoto && <span title="نظرات دارای عکس">📷</span>}
          </p>
        )}

        {p.lowestPriceDurationDays && (
          <p className="text-[10px] font-bold text-emerald-700 mb-1">
            ↘ کمترین قیمت {p.lowestPriceDurationDays.toLocaleString("fa-IR")} روز اخیر
          </p>
        )}

        <div className="flex items-baseline gap-2 mt-auto pt-1">
          {p.originalPrice != null && p.price != null && p.originalPrice > p.price && (
            <span
              dir="ltr"
              className="text-[11px] font-bold text-white bg-[var(--color-wine)] rounded px-1.5 py-0.5"
            >
              ٪-{Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100).toLocaleString("fa-IR")}
            </span>
          )}
          {p.price != null && (
            <span className="font-bold text-[var(--color-wine)]">
              {p.price.toLocaleString("fa-IR")} تومان
            </span>
          )}
          {p.originalPrice != null && p.price != null && p.originalPrice > p.price && (
            <span className="text-xs text-[var(--color-muted)] line-through">
              {p.originalPrice.toLocaleString("fa-IR")}
            </span>
          )}
        </div>

        {/* دکمه‌ی خرید -- چون سایز/رنگ دقیق و موجودی واقعی رو فقط بعد از فچ
            جزئیات کامل داریم (نه توی همین کارت سبک گرید)، کلیک همون مودال
            «نگاه سریع» رو باز می‌کنه که انتخاب سایز + افزودن واقعی به سبد
            اونجا انجام می‌شه -- دقیقاً جایی که ترندیول هم دکمه‌ش رو می‌ذاره */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onQuickView(p);
          }}
          className="mt-3 w-full border cut-line rounded-full py-2 text-sm font-medium hover:border-[var(--color-wine)] hover:text-[var(--color-wine)] transition-colors cursor-pointer"
        >
          افزودن به سبد
        </button>
      </div>
    </TrendyolProductLink>
  );
}

export function TrendyolLiveGrid({
  initialProducts,
  initialNextUrl,
  initialWishlistedIds = [],
  activeAttrsQuery,
}: {
  initialProducts: TrendyolLiveProduct[];
  initialNextUrl: string | null;
  initialWishlistedIds?: string[];
  activeAttrsQuery?: string;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [nextUrl, setNextUrl] = useState(initialNextUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const wishlistedIds = useMemo(() => new Set(initialWishlistedIds), [initialWishlistedIds]);
  // فقط یه instance از مودال «نگاه سریع» برای کل گرید -- نه یکی برای هر کارت --
  // تا هم DOM سنگین نشه هم مطمئن باشیم دو مودال همزمان باز نمی‌شه
  const [quickViewProduct, setQuickViewProduct] = useState<TrendyolLiveProduct | null>(null);

  // محصولات تبلیغاتی/اسپانسری ترندیول رو نشون نمی‌دیم -- نمایش جایگاه تبلیغاتی
  // یه سایت دیگه توی سایت خودمون گمراه‌کننده‌ست
  const visibleProducts = products.filter((p) => !p.isAd);

  async function loadMore() {
    if (!nextUrl || loading) return;
    setLoading(true);
    setError("");
    const res = await fetch(`/api/trendyol/live?url=${encodeURIComponent(nextUrl)}`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      const detail = typeof data.detail === "string" ? data.detail : "";
      setError(`${data.error ?? "خطا در بارگذاری محصولات بیشتر"}${detail ? `\nجزئیات: ${detail}` : ""}`);
      return;
    }
    setProducts((prev) => dedupeProducts(prev, data.products as TrendyolLiveProduct[]));
    setNextUrl(data.nextUrl);
  }

  // بارگذاری خودکار با اسکرول -- مثل خودِ ترندیول، دیگه نیازی به دکمه‌ی
  // «بارگذاری بیشتر» نیست. یه سنتینل نامرئی ته لیست می‌ذاریم؛ هر وقت وارد
  // viewport بشه (با ۶۰۰px حاشیه‌ی جلوتر، که کاربر اصلاً منتظر نمونه) صفحه‌ی
  // بعدی خودکار fetch می‌شه. rootMargin باعث می‌شه واکشی کمی زودتر از رسیدن
  // دقیق به ته صفحه شروع بشه، تجربه‌ای روان‌تر بدون پرش/تاخیر محسوس.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!nextUrl) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "600px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextUrl]);

  if (visibleProducts.length === 0) {
    return <p className="text-sm text-[var(--color-muted)]">محصولی پیدا نشد.</p>;
  }

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {visibleProducts.map((p) => (
          <TrendyolProductCard
            key={p.id}
            p={p}
            onQuickView={setQuickViewProduct}
            isWishlisted={wishlistedIds.has(String(p.id))}
            attrsQuery={activeAttrsQuery}
          />
        ))}
      </div>

      {quickViewProduct && (
        <TrendyolQuickView
          initialProduct={quickViewProduct}
          isWishlisted={wishlistedIds.has(String(quickViewProduct.id))}
          onClose={() => setQuickViewProduct(null)}
        />
      )}

      {error && (
        <div className="mt-4 text-center">
          <p className="text-sm text-red-600 whitespace-pre-wrap mb-2">{error}</p>
          <button
            type="button"
            onClick={loadMore}
            className="border cut-line rounded-full px-6 py-2 text-sm font-medium hover:border-[var(--color-wine)] cursor-pointer"
          >
            تلاش دوباره
          </button>
        </div>
      )}

      {/* سنتینل نامرئی برای تشخیص رسیدن به ته صفحه -- فقط وقتی صفحه‌ی بعدی
          واقعاً وجود داره رندر می‌شه، وگرنه نیازی به observer نیست */}
      {nextUrl && !error && (
        <div ref={sentinelRef} className="h-10 flex items-center justify-center mt-6">
          {loading && (
            <span className="text-sm text-[var(--color-muted)]">در حال بارگذاری...</span>
          )}
        </div>
      )}
    </div>
  );
}
