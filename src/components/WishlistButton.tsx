"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Spinner } from "@/components/Spinner";

function HeartIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.8}
    >
      <path d="M12 20.5s-7.5-4.6-10-9.3C.5 8 1.8 4.5 5 3.4c2.2-.8 4.5.1 6 2.1 1.5-2 3.8-2.9 6-2.1 3.2 1.1 4.5 4.6 3 7.8-2.5 4.7-10 9.3-10 9.3Z" />
    </svg>
  );
}

export function WishlistButton({
  productId,
  trendyol,
  initialWishlisted = false,
  variant = "card",
  raised = false,
}: {
  productId?: string;
  // برای محصولات ترندیول: چون جدول محلی نداریم، اطلاعات نمایشی رو مستقیم
  // پاس می‌دیم تا سرور به‌عنوان snapshot ذخیره‌شون کنه
  trendyol?: {
    externalId: string;
    title?: string;
    image?: string;
    url?: string;
    price?: number;
  };
  initialWishlisted?: boolean;
  variant?: "card" | "detail" | "icon" | "trendyol-card";
  raised?: boolean; // برای وقتی که نوار حراج فلش پایین کارت رو گرفته
}) {
  const { status } = useSession();
  const router = useRouter();
  const [wishlisted, setWishlisted] = useState(initialWishlisted);
  const [loading, setLoading] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    // این دکمه داخل Link کارت محصول هم استفاده می‌شه، پس نباید ناوبری رو ترigger کنه
    e.preventDefault();
    e.stopPropagation();

    if (status === "unauthenticated") {
      router.push("/auth/login");
      return;
    }

    if (loading) return;
    setLoading(true);

    // آپدیت خوش‌بینانه - سریع‌تر حس می‌شه
    const next = !wishlisted;
    setWishlisted(next);

    const body = trendyol
      ? {
          source: "TRENDYOL",
          externalId: trendyol.externalId,
          title: trendyol.title,
          image: trendyol.image,
          url: trendyol.url,
          price: trendyol.price,
        }
      : { productId };

    try {
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        setWishlisted(!next); // برگردون اگه شکست خورد
        if (res.status === 401) router.push("/auth/login");
        return;
      }

      const data = await res.json();
      setWishlisted(data.added);

      // اگه تازه اضافه شد (نه حذف)، آدرس کامل ترندیول رو کش کن -- وگرنه بعداً
      // از صفحه‌ی wishlist که فقط بر اساس contentId لینک می‌سازه، صفحه‌ی
      // جزئیات 404 می‌ده (دقیقاً همون کاری که TrendyolProductLink هم می‌کنه)
      if (data.added && trendyol?.url) {
        fetch("/api/trendyol/cache-product-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentId: trendyol.externalId, url: trendyol.url }),
        }).catch(() => {});
      }
    } catch {
      setWishlisted(!next);
    } finally {
      setLoading(false);
    }
  }

  if (variant === "detail") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-2 border cut-line rounded-full px-4 py-2.5 text-sm font-medium bg-white hover:border-[var(--color-wine)] transition-colors disabled:opacity-60"
      >
        <span className={wishlisted ? "text-[var(--color-wine)]" : "text-[var(--color-muted)]"}>
          {loading ? <Spinner className="w-4 h-4" /> : <HeartIcon filled={wishlisted} className="w-4 h-4" />}
        </span>
        {wishlisted ? "در لیست علاقه‌مندی" : "افزودن به لیست علاقه‌مندی"}
      </button>
    );
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        aria-label={wishlisted ? "حذف از علاقه‌مندی" : "افزودن به علاقه‌مندی"}
        className="shrink-0 w-12 h-12 rounded-full border cut-line bg-white flex items-center justify-center hover:border-[var(--color-wine)] transition-colors disabled:opacity-60"
      >
        <span className={wishlisted ? "text-[var(--color-wine)]" : "text-[var(--color-muted)]"}>
          {loading ? <Spinner className="w-5 h-5" /> : <HeartIcon filled={wishlisted} className="w-5 h-5" />}
        </span>
      </button>
    );
  }

  if (variant === "trendyol-card") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        aria-label={wishlisted ? "حذف از علاقه‌مندی" : "افزودن به علاقه‌مندی"}
        className="absolute top-2 right-2 z-20 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow-sm hover:scale-105 transition-transform disabled:opacity-60"
      >
        <span className={wishlisted ? "text-[var(--color-wine)]" : "text-[var(--color-ink)]"}>
          {loading ? <Spinner className="w-4 h-4" /> : <HeartIcon filled={wishlisted} className="w-4 h-4" />}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      aria-label={wishlisted ? "حذف از علاقه‌مندی" : "افزودن به علاقه‌مندی"}
      className={`absolute ${
        raised ? "bottom-9" : "bottom-2"
      } left-2 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow-sm hover:scale-105 transition-transform disabled:opacity-60`}
    >
      <span className={wishlisted ? "text-[var(--color-wine)]" : "text-[var(--color-ink)]"}>
        <HeartIcon filled={wishlisted} className="w-4 h-4" />
      </span>
    </button>
  );
}
