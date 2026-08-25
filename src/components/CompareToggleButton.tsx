"use client";

import { useCompare } from "@/hooks/useCompare";
import { MAX_COMPARE_COUNT, type CompareProduct } from "@/lib/compare";

// دکمه‌ی «مقایسه» صفحه محصول: افزودن/حذف از لیست مقایسه + نشان‌دادن حالت فعال
// و هشدار سقف تعداد (مثل آمازون/شیین).
export function CompareToggleButton({ product }: { product: CompareProduct }) {
  const { ids, toggle } = useCompare();
  const isIn = ids.includes(product.id);

  if (isIn) {
    return (
      <button
        onClick={() => toggle(product)}
        className="flex-1 border-2 border-[var(--color-wine)] text-[var(--color-wine)] rounded-full px-4 py-2.5 text-sm font-bold transition-colors hover:bg-[var(--color-wine)] hover:text-white"
      >
        ✓ در لیست مقایسه — حذف
      </button>
    );
  }

  const full = ids.length >= MAX_COMPARE_COUNT;
  return (
    <button
      onClick={() => toggle(product)}
      disabled={full}
      title={full ? `حداکثر ${MAX_COMPARE_COUNT.toLocaleString("fa-IR")} محصول قابل مقایسه است` : undefined}
      className="flex-1 border cut-line rounded-full px-4 py-2.5 text-sm font-medium bg-white transition-colors hover:bg-[var(--color-linen-dim)] disabled:opacity-50 disabled:cursor-not-allowed"
    >
      ⚖ مقایسه ({ids.length.toLocaleString("fa-IR")}/{MAX_COMPARE_COUNT.toLocaleString("fa-IR")})
    </button>
  );
}