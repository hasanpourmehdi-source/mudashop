"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { UnifiedProduct } from "@/types/product";
import { CountdownTimer } from "@/components/CountdownTimer";
import { WishlistButton } from "@/components/WishlistButton";

const MAX_VISIBLE_COLORS = 4;
const LOW_STOCK_THRESHOLD = 5; // زیر این تعداد، هشدارِ «فقط N عدد باقی مونده» نشون داده می‌شه

export function ProductCard({
  product,
  isWishlisted = false,
  activeAttrsQuery,
}: {
  product: UnifiedProduct;
  isWishlisted?: boolean;
  // فیلترهای ویژگی فعلاً فعال روی صفحه‌ی لیست (همون فرمت "نام~مقدار,نام~مقدار")
  // -- اگه موجود باشه، همراه لینک صفحه‌ی محصول می‌ره تا از قبل انتخاب شده باشه
  activeAttrsQuery?: string;
}) {
  const router = useRouter();
  const baseHref =
    product.source === "MAZON"
      ? `/products/mazon/${product.slugOrId}`
      : `/products/trendyol/${product.slugOrId}`;
  const href = activeAttrsQuery
    ? `${baseHref}?attrs=${encodeURIComponent(activeAttrsQuery)}`
    : baseHref;

  // عکس‌های واقعی این محصول (بدون تکراری خالی) -- برای اسکراب با موس مثل ترندیول
  const gallery = product.images && product.images.length > 0 ? product.images : [product.image];
  const [activeIndex, setActiveIndex] = useState(0);

  // رنگ‌های موجود این محصول (مقدار رنگ -> عکس‌های اختصاصی) -- ردیف رنگ‌ها همیشه بازه، نه پشت هاور
  const colorEntries = Object.entries(product.colorImages ?? {}).filter(([, imgs]) => imgs.length > 0);
  const visibleColors = colorEntries.slice(0, MAX_VISIBLE_COLORS);
  const extraColorsCount = colorEntries.length - visibleColors.length;
  const [hoverColorImage, setHoverColorImage] = useState<string | null>(null);

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

  function goToColor(e: React.MouseEvent, colorValue: string) {
    e.preventDefault();
    e.stopPropagation();
    // فیلترهای فعلاً فعال روی لیست حفظ می‌شن، فقط توکن رنگ جایگزین/اضافه می‌شه
    const tokens = (activeAttrsQuery?.split(",").filter(Boolean) ?? []).filter(
      (t) => !t.startsWith("رنگ~")
    );
    tokens.push(`رنگ~${colorValue}`);
    router.push(`${baseHref}?attrs=${encodeURIComponent(tokens.join(","))}`);
  }

  const displayedImage = hoverColorImage ?? gallery[activeIndex];

  return (
    <Link
      href={href}
      className="group flex flex-col h-full border cut-line rounded-lg overflow-hidden bg-white hover:shadow-lg transition-shadow"
    >
      <div
        className="relative aspect-[3/4] shrink-0 bg-[var(--color-linen-dim)] overflow-hidden"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {displayedImage && (
          <Image
            src={displayedImage}
            alt={product.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 50vw, 25vw"
            unoptimized
          />
        )}
        {/* نشانگر شماره عکس -- پایین‌وسط، به شکل قرص‌های کوچیک کنار هم مثل ترندیول */}
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
        <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-1 rounded-full bg-white/90 text-[var(--color-ink)]">
          {product.source === "MAZON" ? "✦ مزون" : "ترندیول"}
        </span>
        {product.discount > 0 && (
          <span className="ribbon-tag absolute top-2 left-0 font-bold">
            {product.discount}%-
          </span>
        )}
        {product.totalStock === 0 ? (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="bg-white text-[var(--color-ink)] text-xs font-bold px-3 py-1.5 rounded-full">
              ناموجود
            </span>
          </div>
        ) : product.flashSale ? (
          <div className="absolute bottom-0 inset-x-0 bg-[var(--color-ochre)] text-white text-[10px] font-bold px-2 py-1 flex items-center justify-between">
            <span>⚡ حراج فلش</span>
            <CountdownTimer endsAt={product.flashSale.endsAt} className="font-mono" />
          </div>
        ) : (
          product.fastShipping && (
            <div className="absolute bottom-0 inset-x-0 bg-green-600 text-white text-[10px] font-bold px-2 py-1 text-center">
              🚚 ارسال فوری
            </div>
          )
        )}
        {/* علاقه‌مندی -- برای مزون با productId، برای ترندیول با snapshot (چون
            جدول محلی برای join نداریم) */}
        {product.source === "MAZON" ? (
          <WishlistButton
            productId={product.id}
            initialWishlisted={isWishlisted}
            variant="card"
            raised={!!product.flashSale || !!product.fastShipping}
          />
        ) : (
          <WishlistButton
            trendyol={{
              externalId: product.externalId ?? product.slugOrId,
              title: product.title,
              image: product.image,
              url: product.sourceUrl,
              price: product.price,
            }}
            initialWishlisted={isWishlisted}
            variant="card"
          />
        )}
      </div>

      {/* ردیف رنگ‌های موجود -- همیشه باز، بدون نیاز به هاور روی یه بج */}
      {colorEntries.length > 1 && (
        <div
          className="flex items-center gap-1.5 px-3 pt-2 shrink-0"
          onClick={(e) => e.preventDefault()}
        >
          {visibleColors.map(([colorValue, imgs]) => (
            <button
              key={colorValue}
              type="button"
              title={colorValue}
              onMouseEnter={() => setHoverColorImage(imgs[0])}
              onMouseLeave={() => setHoverColorImage(null)}
              onClick={(e) => goToColor(e, colorValue)}
              className="relative w-8 h-10 rounded-md overflow-hidden border cut-line shrink-0 hover:ring-2 hover:ring-[var(--color-wine)] transition-all"
            >
              <Image src={imgs[0]} alt={colorValue} fill className="object-cover" unoptimized />
            </button>
          ))}
          {extraColorsCount > 0 && (
            <span className="text-[10px] font-bold text-[var(--color-muted)] shrink-0">
              +{extraColorsCount.toLocaleString("fa-IR")}
            </span>
          )}
        </div>
      )}

      <div className="p-3 flex flex-col flex-1">
        {product.brand && (
          <p className="text-xs text-[var(--color-muted)] mb-0.5 flex items-center gap-1">
            {product.brand}
            <span className="text-[var(--color-wine)]" title="برند تاییدشده">
              ✓
            </span>
          </p>
        )}
        <h3 className="text-sm font-medium line-clamp-2 mb-1.5 min-h-[2.5rem]">{product.title}</h3>

        {typeof product.totalStock === "number" && product.totalStock > 0 && product.totalStock <= LOW_STOCK_THRESHOLD && (
          <p className="text-[11px] text-red-600 font-bold mb-1">
            فقط {product.totalStock.toLocaleString("fa-IR")} عدد باقی مونده!
          </p>
        )}

        {!!product.viewCount24h && product.viewCount24h > 0 && (
          <p className="text-[11px] text-[var(--color-muted)] mb-1">
            👁 در ۲۴ ساعت گذشته {product.viewCount24h.toLocaleString("fa-IR")} نفر بازدید کرده‌اند
          </p>
        )}

        {!!product.wishlistCount && product.wishlistCount > 0 && (
          <p className="text-[11px] text-[var(--color-muted)] mb-1 flex items-center gap-1">
            <span className="text-[var(--color-wine)]">♥</span>
            {product.wishlistCount.toLocaleString("fa-IR")} نفر پسندیدن!
          </p>
        )}

        {!!product.reviewCount && product.reviewCount > 0 && (
          <p className="text-[11px] text-[var(--color-muted)] mb-2 flex items-center gap-1">
            <span className="text-[var(--color-ochre)]">★</span>
            <span className="font-bold text-[var(--color-ink)]">
              {(product.rating ?? 0).toLocaleString("fa-IR", { maximumFractionDigits: 1 })}
            </span>
            <span>({product.reviewCount.toLocaleString("fa-IR")})</span>
          </p>
        )}

        {product.isLowestPrice10d && (
          <p className="text-[10px] font-bold text-emerald-700 mb-1">↘ کمترین قیمت ۱۰ روز اخیر</p>
        )}

        <div className="flex items-baseline gap-2 mt-auto pt-1">
          <span className="font-bold text-[var(--color-wine)]">
            {product.price.toLocaleString("fa-IR")} تومان
          </span>
          {product.discount > 0 && (
            <span className="text-xs text-[var(--color-muted)] line-through">
              {product.originalPrice.toLocaleString("fa-IR")}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
