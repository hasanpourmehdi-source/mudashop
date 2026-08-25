"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/hooks/useCart";
import { HorizontalProductCarousel } from "@/components/HorizontalProductCarousel";
import { CartProforma } from "@/components/CartProforma";
import { setAppliedCouponCode } from "@/lib/appliedCoupon";
import { internalTrendyolProductHref } from "@/lib/trendyolProductLink";
import type { UnifiedProduct } from "@/types/product";
import type { CartItem } from "@/store/cart";

type CouponResult = {
  valid: boolean;
  code: string;
  type: "PERCENT" | "FIXED" | "FREE_SHIP" | "FIRST_BUY";
  discountAmount: number;
  freeShipping: boolean;
};

// موجودی به این تعداد یا کمتر رسیده باشه، بج «فقط N عدد باقی مانده» نشون داده می‌شه
const LOW_STOCK_THRESHOLD = 2;

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <path
        d="M4 6h12M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6m-6 0 .6 9.4A1.5 1.5 0 0 0 8.1 17h3.8a1.5 1.5 0 0 0 1.5-1.6L14 6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function CartPage() {
  const { items, removeItem, updateQuantity, total, clear } = useCart();

  const [couponInput, setCouponInput] = useState("");
  const [cachedTrendyolUrls, setCachedTrendyolUrls] = useState<Record<string, string>>({});

  // کش کردن آدرس کامل ترندیول (حتماًslug SEO داره) هر محصول توی سبد
  // هنگام تغییر لیست محصولات -- از API سرور استفاده می‌کنیم تا Prisma
  // در بافر مرورگر اجرا نشود (خطای EADDRINUSE / browser environment)
  useEffect(() => {
    async function loadCachedUrls() {
      try {
        const res = await fetch("/api/cart/product-urls", {
          cache: "no-store",
        });
        if (res.ok) {
          const { urlMap } = await res.json();
          setCachedTrendyolUrls(urlMap);
        }
      } catch (err) {
        console.error("Failed to load cart product URLs:", err);
      }
    }
    loadCachedUrls();
  }, [items]);

  // لینک صفحه‌ی محصول همین قلمِ سبد -- از کش شده شده URL استفاده می‌کنیم
  // تا slug SEO داشته باشیم و 404 ندهیم
  function cartItemHref(item: CartItem): string {
    return item.source === "MAZON"
      ? `/products/mazon/${item.productId}`
      : internalTrendyolProductHref(item.productId, cachedTrendyolUrls[item.productId] ?? undefined);
  }
  const [coupon, setCoupon] = useState<CouponResult | null>(null);
  const [couponError, setCouponError] = useState("");
  const [checkingCoupon, setCheckingCoupon] = useState(false);

  const [recommended, setRecommended] = useState<UnifiedProduct[]>([]);

  const subtotal = total();
  const totalSavings = items.reduce(
    (sum, i) => sum + (i.originalPrice ? (i.originalPrice - i.price) * i.quantity : 0),
    0
  );
  const discountAmount = coupon?.discountAmount ?? 0;
  const currentTotal = Math.max(0, subtotal - discountAmount);

  // پیشنهاد بر اساس همه‌ی محصولات موجود توی سبد -- فقط وقتی ترکیب محصولات
  // واقعاً عوض بشه دوباره fetch می‌شه، نه با هر تغییر تعداد
  const distinctProductIds = Array.from(new Set(items.map((i) => i.productId))).sort().join(",");
  useEffect(() => {
    if (!distinctProductIds) {
      setRecommended([]);
      return;
    }
    let cancelled = false;
    fetch("/api/cart/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productIds: distinctProductIds.split(","),
        excludeIds: items.map((i) => i.productId),
      }),
    })
      .then((res) => (res.ok ? res.json() : { products: [] }))
      .then((data) => {
        if (!cancelled) setRecommended(data.products ?? []);
      })
      .catch(() => {
        if (!cancelled) setRecommended([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distinctProductIds]);

  async function handleApplyCoupon() {
    setCouponError("");
    setCoupon(null);
    setAppliedCouponCode("");
    if (!couponInput.trim()) return;
    setCheckingCoupon(true);
    const res = await fetch("/api/coupons/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: couponInput.trim(), subtotal }),
    });
    const data = await res.json();
    setCheckingCoupon(false);
    if (!res.ok) {
      setCouponError(data.error ?? "کد تخفیف نامعتبر است");
      return;
    }
    setCoupon(data);
    setAppliedCouponCode(data.code);
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <h1 className="text-xl font-bold mb-2">سبد خرید شما خالی است</h1>
        <p className="text-[var(--color-muted)] mb-6">
          هنوز محصولی به سبد خرید اضافه نکرده‌اید.
        </p>
        <Link
          href="/products"
          className="inline-block bg-[var(--color-wine)] text-white px-6 py-3 rounded-full font-medium"
        >
          مشاهده محصولات
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 grid md:grid-cols-[1fr_320px] gap-8">
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold">سبد خرید</h1>
          {/* پاک‌کردنِ یکجای کل سبد -- جدا از حذفِ تک‌تک اقلام */}
          <button
            onClick={() => {
              if (confirm("کل سبد خرید حذف شود؟ این کار برگشت‌پذیر نیست.")) {
                clear();
                setAppliedCouponCode("");
              }
            }}
            className="flex items-center gap-1.5 text-sm text-red-600 border border-red-200 rounded-full px-4 py-1.5 hover:bg-red-50 transition-colors"
          >
            <TrashIcon className="w-4 h-4" />
            حذف کل سبد
          </button>
        </div>

        <div className="space-y-4">
          {items.map((item) => {
            const lowStock =
              item.maxStock !== undefined && item.maxStock > 0 && item.maxStock <= LOW_STOCK_THRESHOLD;
            const savingPerItem = item.originalPrice ? item.originalPrice - item.price : 0;
            const href = cartItemHref(item);

            return (
              <div
                key={item.id}
                className="flex gap-4 border cut-line rounded-lg p-3 bg-white items-center"
              >
                <Link
                  href={href}
                  className="relative w-20 h-20 shrink-0 bg-[var(--color-linen-dim)] rounded overflow-hidden"
                >
                  {item.image && (
                    <Image src={item.image} alt={item.title} fill className="object-cover" unoptimized />
                  )}
                  {lowStock && (
                    <span className="absolute bottom-0 inset-x-0 bg-red-600 text-white text-[9px] font-bold text-center py-0.5">
                      فقط {item.maxStock!.toLocaleString("fa-IR")} عدد باقی مانده
                    </span>
                  )}
                </Link>
                <div className="flex-1 min-w-0">
                  {item.siteLabel && (
                    <span className="inline-block text-[10px] font-bold text-[var(--color-wine)] bg-[var(--color-wine)]/10 rounded-full px-2 py-0.5 mb-1 ml-1">
                      {item.siteLabel}
                    </span>
                  )}
                  {item.fastShipping && (
                    <span className="inline-block text-[10px] font-bold text-green-700 bg-green-50 rounded-full px-2 py-0.5 mb-1">
                      🚚 ارسال فوری
                    </span>
                  )}
                  <Link href={href} className="text-sm font-medium truncate hover:text-[var(--color-wine)] hover:underline block">
                    {item.title}
                  </Link>
                  {item.variantLabel && (
                    <p className="text-xs text-[var(--color-muted)]">{item.variantLabel}</p>
                  )}
                  <div className="flex items-baseline gap-2 mt-1">
                    <p className="text-sm text-[var(--color-wine)] font-bold">
                      {item.price.toLocaleString("fa-IR")} تومان
                    </p>
                    {item.originalPrice !== undefined && item.originalPrice > item.price && (
                      <p className="text-xs text-[var(--color-muted)] line-through">
                        {item.originalPrice.toLocaleString("fa-IR")}
                      </p>
                    )}
                  </div>
                  {savingPerItem > 0 && (
                    <p className="text-[11px] text-green-700 mt-0.5">
                      سود شما: {(savingPerItem * item.quantity).toLocaleString("fa-IR")} تومان
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="w-7 h-7 border cut-line rounded-full flex items-center justify-center"
                      aria-label="کاهش تعداد"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      disabled={item.maxStock !== undefined && item.quantity >= item.maxStock}
                      className="w-7 h-7 border cut-line rounded-full flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="افزایش تعداد"
                    >
                      +
                    </button>
                  </div>
                  {item.maxStock !== undefined && item.quantity >= item.maxStock && (
                    <span className="text-[10px] text-[var(--color-ochre)]">حداکثر موجودی</span>
                  )}
                </div>
                <button
                  onClick={() => removeItem(item.id)}
                  aria-label="حذف از سبد"
                  title="حذف از سبد"
                  className="text-[var(--color-muted)] hover:text-red-600 p-1"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              </div>
            );
          })}
        </div>

        {recommended.length > 0 && (
          <section className="mt-10 pt-6 border-t cut-line">
            <h2 className="font-bold mb-4">شاید این‌ها رو هم بخوای</h2>
            <HorizontalProductCarousel products={recommended} wishlistedIds={new Set()} />
          </section>
        )}
      </div>

      {/* خلاصه سبد */}
      <aside className="border cut-line rounded-lg p-5 bg-white h-fit space-y-3 text-sm">
        <h2 className="font-bold mb-2">خلاصه سبد</h2>
        <div className="flex justify-between">
          <span className="text-[var(--color-muted)]">جمع اقلام</span>
          <span>{subtotal.toLocaleString("fa-IR")} تومان</span>
        </div>
        {totalSavings > 0 && (
          <div className="flex justify-between text-green-700">
            <span>جمع سود شما</span>
            <span>{totalSavings.toLocaleString("fa-IR")} تومان</span>
          </div>
        )}
        {discountAmount > 0 && (
          <div className="flex justify-between text-green-700">
            <span>تخفیف کوپن</span>
            <span>−{discountAmount.toLocaleString("fa-IR")} تومان</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-[var(--color-muted)]">هزینه ارسال</span>
          <span className="text-xs text-[var(--color-muted)]">در مرحله‌ی بعد مشخص می‌شود</span>
        </div>

        <div className="border-t cut-line pt-3">
          <div className="flex gap-2">
            <input
              placeholder="کد تخفیف"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value)}
              className="border cut-line rounded-lg px-3 py-2 bg-white flex-1 text-sm"
            />
            <button
              onClick={handleApplyCoupon}
              disabled={checkingCoupon}
              className="border cut-line px-3 py-2 rounded-full text-xs font-medium bg-white disabled:opacity-50 shrink-0"
            >
              {checkingCoupon ? "..." : "اعمال"}
            </button>
          </div>
          {couponError && <p className="text-xs text-red-600 mt-1.5">{couponError}</p>}
          {coupon && (
            <p className="text-xs text-green-700 mt-1.5">
              کد «{coupon.code}» اعمال شد{coupon.freeShipping && " — ارسال رایگان"}
            </p>
          )}
        </div>

        <div className="flex justify-between font-bold text-base border-t cut-line pt-3">
          <span>جمع فعلی</span>
          <span className="text-[var(--color-wine)]">{currentTotal.toLocaleString("fa-IR")} تومان</span>
        </div>

        <Link
          href="/checkout"
          className="block w-full text-center bg-[var(--color-wine)] text-white py-3 rounded-full font-medium hover:bg-[var(--color-wine-dark)] transition-colors"
        >
          تکمیل خرید
        </Link>

        <CartProforma
          items={items}
          subtotal={subtotal}
          discountAmount={discountAmount}
          couponCode={coupon?.code ?? null}
          currentTotal={currentTotal}
        />
      </aside>
    </div>
  );
}
