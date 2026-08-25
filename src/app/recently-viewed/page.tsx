"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";

// نسخه‌ی «مشاهده همه»ی همون چیزی که توی صفحه‌ی اصلی به‌صورت اسکرولِ افقی
// نشون داده می‌شه -- همون دیتای localStorage، فقط این‌بار توی یک گرید کامل
export default function RecentlyViewedPage() {
  const { items, remove } = useRecentlyViewed();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8">
      <h1 className="text-xl font-bold mb-6">🕘 اخیراً دیده‌اید</h1>

      {!mounted ? null : items.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">هنوز محصولی ندیده‌اید.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {items.map((p) => (
            <div key={p.id} className="relative group">
              <Link
                href={p.href}
                className="flex flex-col h-full border cut-line rounded-lg overflow-hidden bg-white hover:shadow-lg transition-shadow"
              >
                <div className="relative aspect-[3/4] shrink-0 bg-[var(--color-linen-dim)] overflow-hidden">
                  {p.image && (
                    <Image
                      src={p.image}
                      alt={p.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="220px"
                      unoptimized
                    />
                  )}
                  {p.discount > 0 && (
                    <span className="ribbon-tag absolute top-2 left-0 font-bold">{p.discount}%-</span>
                  )}
                </div>
                <div className="p-3 flex flex-col flex-1">
                  <h3 className="text-sm font-medium line-clamp-2 mb-1.5 min-h-[2.5rem]">{p.title}</h3>
                  <div className="flex items-baseline gap-2 mt-auto">
                    <span className="font-bold text-[var(--color-wine)] text-sm">
                      {p.price.toLocaleString("fa-IR")} تومان
                    </span>
                    {p.discount > 0 && (
                      <span className="text-xs text-[var(--color-muted)] line-through">
                        {p.originalPrice.toLocaleString("fa-IR")}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => remove(p.id)}
                aria-label="حذف از اخیراً دیده‌اید"
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/90 border cut-line text-[var(--color-muted)] text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 hover:text-[var(--color-wine)] transition-opacity"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
